import type { Scraper, RawListing } from "./types";
import { sleep, mapFuel, mapGearbox, safeYear } from "./json-ld-dealer";
import type { MotoType } from "../types";

// AutoScout24 — section motos (vehicle_type=M).
// Stratégie : GET /lst/{make}/{model}?vehicle_type=M → __NEXT_DATA__.
// Variables d'environnement :
//   AS24_CRAWL_DELAY_MS — délai entre requêtes (défaut 1200 ms)
//   AS24_PAGES          — pages par combo (défaut 2)

const UA = process.env.SCRAPER_USER_AGENT ?? "Mozilla/5.0 (compatible; VO-Radar/0.1)";
const CRAWL_DELAY = Number(process.env.AS24_CRAWL_DELAY_MS ?? 1200);
const BASE = "https://www.autoscout24.fr";
const PAGES_PER_COMBO = Number(process.env.AS24_PAGES ?? 2);

const MAKES_MODELS: { make: string; model: string }[] = [
  { make: "yamaha", model: "mt-07" },
  { make: "yamaha", model: "mt-09" },
  { make: "yamaha", model: "yzf-r1" },
  { make: "yamaha", model: "tmax" },
  { make: "yamaha", model: "tenere-700" },
  { make: "yamaha", model: "tracer-9" },
  { make: "honda", model: "cb500f" },
  { make: "honda", model: "cb650r" },
  { make: "honda", model: "cbr1000rr" },
  { make: "honda", model: "forza" },
  { make: "honda", model: "africa-twin" },
  { make: "kawasaki", model: "z900" },
  { make: "kawasaki", model: "ninja-650" },
  { make: "kawasaki", model: "versys-650" },
  { make: "kawasaki", model: "z1000" },
  { make: "bmw", model: "f-850-gs" },
  { make: "bmw", model: "r-1250-gs" },
  { make: "bmw", model: "s-1000-rr" },
  { make: "bmw", model: "r-ninet" },
  { make: "ktm", model: "790-duke" },
  { make: "ktm", model: "890-duke" },
  { make: "ktm", model: "790-adventure" },
  { make: "ducati", model: "monster" },
  { make: "ducati", model: "multistrada" },
  { make: "ducati", model: "scrambler" },
  { make: "triumph", model: "street-triple" },
  { make: "triumph", model: "tiger-900" },
  { make: "triumph", model: "bonneville-t120" },
  { make: "suzuki", model: "gsx-r-750" },
  { make: "suzuki", model: "sv-650" },
  { make: "suzuki", model: "v-strom-650" },
  { make: "harley-davidson", model: "sportster" },
  { make: "harley-davidson", model: "softail" },
  { make: "aprilia", model: "rs-660" },
  { make: "aprilia", model: "tuono-v4" },
];

type As24Ad = Record<string, unknown>;

function str(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    return str(o.label ?? o.name ?? o.value);
  }
  return null;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function detectMotoType(category: string | null, title: string): MotoType {
  const s = (category ?? title ?? "").toLowerCase();
  if (/scooter|maxi.?scooter|tmax|forza/.test(s)) return "scooter";
  if (/trail|adventure|adv|gs|v.strom|transalp|africa|tenere|tiger|multistrada|versys/.test(s)) return "trail";
  if (/sport|rr|r1|r6|cbr|gsxr|superbike/.test(s)) return "sportive";
  if (/roadster|naked|street|mt-|z[0-9]|cb[0-9]|duke|monster|tuono|speed/.test(s)) return "roadster";
  if (/custom|chopper|cruiser|harley|softail|sportster|bonneville/.test(s)) return "custom";
  if (/enduro|motocross|cross|off.road/.test(s)) return "enduro";
  if (/touring|tour|goldwing|road glide/.test(s)) return "tourisme";
  return "autre";
}

function parseAd(ad: As24Ad, make: string, model: string): RawListing | null {
  const id = str(ad.id ?? ad.uuid ?? ad.classifiedId ?? ad.offerId);
  if (!id) return null;

  // AS24 nests everything under `vehicle`, `location`, `price`, `seller`, `images`
  const vehicle = (ad.vehicle ?? {}) as Record<string, unknown>;
  const location = (ad.location ?? {}) as Record<string, unknown>;
  const seller = (ad.seller ?? {}) as Record<string, unknown>;

  // Only keep Motorbike entries (skip cars that bleed through)
  const articleType = str(vehicle.type ?? vehicle.articleType ?? vehicle.vehicleType);
  if (articleType && !/motorbike|motorcycle|moto/i.test(articleType)) return null;

  const brand = str(vehicle.make ?? vehicle.brand ?? ad.make ?? ad.brand) ?? make;
  const rawModel = str(vehicle.model ?? vehicle.modelGroup ?? ad.model) ?? model;
  if (!brand || !rawModel) return null;

  const version = str(vehicle.modelVersionInput ?? vehicle.variant ?? vehicle.subtitle) ?? null;

  // Year: may be in vehicle.registrationDate or vehicle.firstRegistrationYear
  const yearRaw = vehicle.firstRegistrationYear ?? vehicle.registrationYear ?? vehicle.year ?? ad.year;
  const year = safeYear(num(yearRaw)) ?? 2015;

  // Mileage: formatted string like "32 572 km" — strip non-digits
  const mileageRaw = str(vehicle.mileageInKm ?? vehicle.mileage ?? ad.mileage);
  const mileage = mileageRaw ? (Number(mileageRaw.replace(/[^\d]/g, "")) || 0) : 0;

  // Price: object with priceFormatted like "€ 12 188" — strip non-digits
  const priceObj = (ad.price ?? {}) as Record<string, unknown>;
  const priceFmt = str(priceObj.priceFormatted ?? priceObj.value ?? priceObj.amount);
  let price = 0;
  if (typeof ad.price === "number") price = ad.price;
  else if (priceFmt) price = Number(priceFmt.replace(/[^\d]/g, "")) || 0;
  if (!price || price < 200) return null;

  const fuelRaw = str(vehicle.fuel ?? vehicle.fuelType ?? vehicle.energy);
  const gearboxRaw = str(vehicle.transmission ?? vehicle.gearbox);
  const powerRaw = str(vehicle.powerInKw ?? vehicle.power ?? vehicle.horsePower);
  const power = powerRaw ? (num(powerRaw) ? Math.round((num(powerRaw) ?? 0) * 1.36) : null) : null; // kW → HP approx
  // Displacement: "1 498 cm³" → digits only
  const displacementRaw = str(vehicle.engineDisplacementInCCM ?? vehicle.displacement ?? vehicle.cubicCapacity);
  const cylindree = displacementRaw ? (Number(displacementRaw.replace(/[^\d]/g, "")) || null) : null;

  // Location
  const region = str(location.city ?? location.region ?? location.countryCode) ?? null;
  const postalCode = str(location.zip ?? location.postalCode) ?? null;

  // Seller type: "Dealer" or "Private"
  const sellerType = str(seller.type ?? (seller.dealer ? "Dealer" : undefined) ?? ad.sellerType);
  const sellerKind: "pro" | "particulier" =
    sellerType && /dealer|pro/i.test(sellerType) ? "pro" : "particulier";

  // Images: array of URL strings or objects
  const imagesRaw = ad.images ?? ad.photos ?? [];
  const photoUrls: string[] = (() => {
    if (!Array.isArray(imagesRaw) || imagesRaw.length === 0) return [];
    return (imagesRaw as unknown[]).slice(0, 10).map((img) => {
      if (typeof img === "string") return img.split("?")[0]; // strip query params
      if (img && typeof img === "object") {
        const o = img as Record<string, unknown>;
        const u = o.url ?? o.uri ?? o.src ?? o.href ?? o.large ?? o.medium;
        return typeof u === "string" ? u.split("?")[0] : "";
      }
      return "";
    }).filter((u) => u && u.startsWith("http"));
  })();
  const photoUrl = photoUrls[0] ?? null;
  const photosJson = photoUrls.length > 0 ? JSON.stringify(photoUrls) : null;

  const urlRaw = str(ad.url ?? ad.adUrl ?? ad.link);
  const title = `${brand} ${rawModel}${version ? ` ${version}` : ""}`;

  return {
    id: `as24-moto-${id}`,
    source: "autoscout24-moto",
    source_id: id,
    url: urlRaw ? (urlRaw.startsWith("http") ? urlRaw : `${BASE}${urlRaw}`) : `${BASE}/annonces/${id}`,
    title,
    brand,
    model: rawModel,
    version,
    engine_designation: null,
    body_type: "inconnu",
    vehicle_type: "moto",
    moto_type: detectMotoType(str(vehicle.bodyType ?? vehicle.type), title),
    cylindree_cc: cylindree,
    year: Math.round(year),
    mileage_km: Math.round(Math.max(0, mileage)),
    fuel: mapFuel(fuelRaw),
    gearbox: mapGearbox(gearboxRaw),
    power_hp: power ?? null,
    price_eur: Math.round(price),
    seller_kind: sellerKind,
    postal_code: postalCode,
    region,
    photos_count: photoUrls.length,
    photo_url: photoUrl,
    photos_json: photosJson,
    posted_at: new Date().toISOString(),
  };
}

function dig(o: unknown, ...keys: string[]): unknown {
  let cur: unknown = o;
  for (const k of keys) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function extractAds(data: unknown): As24Ad[] {
  const candidates = [
    dig(data, "props", "pageProps", "listingsPage", "listings"),
    dig(data, "props", "pageProps", "listings"),
    dig(data, "props", "pageProps", "classifiedList"),
    dig(data, "props", "pageProps", "offers"),
    dig(data, "props", "pageProps", "initialState", "listingSearch", "result", "listings"),
    dig(data, "props", "pageProps", "state", "listingSearch", "result", "listings"),
    dig(data, "listings"),
    dig(data, "classifieds"),
    dig(data, "results"),
  ];

  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length > 0) return arr as As24Ad[];
  }

  const pageProps = dig(data, "props", "pageProps");
  if (pageProps && typeof pageProps === "object") {
    for (const val of Object.values(pageProps as Record<string, unknown>)) {
      if (Array.isArray(val) && val.length > 0) {
        const first = val[0] as Record<string, unknown>;
        if (first.id || first.uuid || first.classifiedId) return val as As24Ad[];
      }
    }
  }

  return [];
}

async function fetchPage(make: string, model: string, page: number): Promise<RawListing[]> {
  // atype=M → motorbikes on AutoScout24 (atype=C = cars)
  const url = `${BASE}/lst/${make}/${model}?` + new URLSearchParams({
    atype: "M",
    desc: "0",
    page: String(page),
  }).toString();

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "fr-FR,fr;q=0.9",
      },
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  const m = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];

  let data: unknown;
  try { data = JSON.parse(m[1]); } catch { return []; }

  const ads = extractAds(data);
  return ads.map((ad) => parseAd(ad, make, model)).filter((l): l is RawListing => l !== null);
}

export const autoscout24MotoScraper: Scraper = {
  name: "autoscout24-moto",
  async fetch({ limit } = {}): Promise<RawListing[]> {
    const batchSize = Math.min(limit ?? 200, 400);
    const out: RawListing[] = [];
    const seen = new Set<string>();

    // Shuffle for variety
    const shuffled = [...MAKES_MODELS].sort(() => Math.random() - 0.5);

    for (const { make, model } of shuffled) {
      if (out.length >= batchSize) break;
      try {
        for (let page = 1; page <= PAGES_PER_COMBO; page++) {
          if (out.length >= batchSize) break;
          const listings = await fetchPage(make, model, page);
          if (listings.length === 0) break;
          for (const l of listings) {
            if (!seen.has(l.source_id)) {
              seen.add(l.source_id);
              out.push(l);
            }
          }
          if (page < PAGES_PER_COMBO) await sleep(CRAWL_DELAY);
        }
      } catch (e) {
        console.warn(`[as24-moto] ${make}/${model}:`, (e as Error).message);
      }
      await sleep(CRAWL_DELAY);
    }

    console.log(`[as24-moto] Fetched ${out.length} listings`);
    return out;
  },
};
