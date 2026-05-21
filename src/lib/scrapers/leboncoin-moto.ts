import type { Scraper, RawListing } from "./types";
import { sleep, mapFuel, mapGearbox, shuffle } from "./json-ld-dealer";
import type { MotoType } from "../types";

// LeBonCoin — section motos/scooters/quad.
// Stratégie : GET /motos-scooters-quad/offres/?brand=X&model=Y → __NEXT_DATA__ (ads[]).
// Variables d'environnement :
//   LBC_COOKIE         — session cookie LBC (optionnel)
//   LBC_PROXY          — proxy résidentiel (recommandé)
//   LBC_CRAWL_DELAY_MS — délai entre requêtes (défaut 5000 ms)

const UA =
  process.env.SCRAPER_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const CRAWL_DELAY = Number(process.env.LBC_CRAWL_DELAY_MS ?? 5000);
const BASE = "https://www.leboncoin.fr";

// Top marques/modèles moto en France
const MAKES_MODELS: { brand: string; model: string }[] = [
  // Yamaha
  { brand: "yamaha", model: "mt-07" },
  { brand: "yamaha", model: "mt-09" },
  { brand: "yamaha", model: "yzf-r1" },
  { brand: "yamaha", model: "yzf-r3" },
  { brand: "yamaha", model: "tracer-900" },
  { brand: "yamaha", model: "tracer-7" },
  { brand: "yamaha", model: "tmax" },
  { brand: "yamaha", model: "nmax" },
  { brand: "yamaha", model: "tenere-700" },
  // Honda
  { brand: "honda", model: "cb500f" },
  { brand: "honda", model: "cb650r" },
  { brand: "honda", model: "cbr600rr" },
  { brand: "honda", model: "cbr1000rr" },
  { brand: "honda", model: "forza" },
  { brand: "honda", model: "africa-twin" },
  { brand: "honda", model: "transalp" },
  { brand: "honda", model: "pcx" },
  // Kawasaki
  { brand: "kawasaki", model: "z900" },
  { brand: "kawasaki", model: "z650" },
  { brand: "kawasaki", model: "ninja-400" },
  { brand: "kawasaki", model: "ninja-650" },
  { brand: "kawasaki", model: "versys-650" },
  { brand: "kawasaki", model: "versys-1000" },
  { brand: "kawasaki", model: "z1000" },
  // BMW
  { brand: "bmw", model: "f850gs" },
  { brand: "bmw", model: "f900r" },
  { brand: "bmw", model: "r1250gs" },
  { brand: "bmw", model: "s1000rr" },
  { brand: "bmw", model: "r ninet" },
  { brand: "bmw", model: "g310r" },
  // KTM
  { brand: "ktm", model: "duke 390" },
  { brand: "ktm", model: "duke 790" },
  { brand: "ktm", model: "duke 890" },
  { brand: "ktm", model: "adventure 790" },
  // Ducati
  { brand: "ducati", model: "monster" },
  { brand: "ducati", model: "panigale" },
  { brand: "ducati", model: "multistrada" },
  { brand: "ducati", model: "scrambler" },
  // Triumph
  { brand: "triumph", model: "street triple" },
  { brand: "triumph", model: "tiger 900" },
  { brand: "triumph", model: "bonneville" },
  { brand: "triumph", model: "speed triple" },
  // Suzuki
  { brand: "suzuki", model: "gsxr 750" },
  { brand: "suzuki", model: "gsxr 1000" },
  { brand: "suzuki", model: "sv650" },
  { brand: "suzuki", model: "vstrom 650" },
  { brand: "suzuki", model: "vstrom 1050" },
  // Harley-Davidson
  { brand: "harley-davidson", model: "sportster" },
  { brand: "harley-davidson", model: "softail" },
  { brand: "harley-davidson", model: "road glide" },
  { brand: "harley-davidson", model: "street glide" },
  // Aprilia
  { brand: "aprilia", model: "rs 660" },
  { brand: "aprilia", model: "tuono" },
  { brand: "aprilia", model: "shiver" },
  // Royal Enfield
  { brand: "royal enfield", model: "interceptor 650" },
  { brand: "royal enfield", model: "meteor 350" },
];

type LbcAd = Record<string, unknown>;
type LbcAttr = { key: string; value?: string | number; value_label?: string };

function attrVal(attrs: LbcAttr[], key: string): string | null {
  const a = attrs.find((x) => x.key === key);
  if (!a) return null;
  return String(a.value_label ?? a.value ?? "").trim() || null;
}

function attrNum(attrs: LbcAttr[], key: string): number | null {
  const v = attrVal(attrs, key);
  if (!v) return null;
  const n = Number(v.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function detectMotoType(typeRaw: string | null, title: string): MotoType {
  const s = (typeRaw ?? title ?? "").toLowerCase();
  if (/scooter|maxi.?scooter|tmax|forza|pcx|nmax|kymco|sym/.test(s)) return "scooter";
  if (/trail|adventure|adv|gs|vstrom|transalp|africa|tenere|tiger|multistrada|versys|v.strom/.test(s)) return "trail";
  if (/sportive|rr|r1|r6|cbr|gsxr|superbike|piste/.test(s)) return "sportive";
  if (/roadster|naked|street|mt-|z[0-9]|cb[0-9]|duke|monster|tuono|speed/.test(s)) return "roadster";
  if (/custom|chopper|cruiser|harley|softail|sportster|bonneville|bobber/.test(s)) return "custom";
  if (/enduro|motocross|cross|off.road|ktm exc|husqvarna/.test(s)) return "enduro";
  if (/touring|tour|goldwing|pan america|electra|road glide|bagage/.test(s)) return "tourisme";
  return "autre";
}

function parseAd(ad: LbcAd): RawListing | null {
  const id = String(ad.list_id ?? ad.id ?? "");
  if (!id) return null;

  const subject = String(ad.subject ?? "").trim();
  const attrs: LbcAttr[] = Array.isArray(ad.attributes) ? (ad.attributes as LbcAttr[]) : [];

  const brand = attrVal(attrs, "brand") ?? String(ad.brand ?? "").trim();
  const model = attrVal(attrs, "model") ?? String(ad.model ?? "").trim();
  if (!brand || !model) return null;

  // Price
  const rawPrice = ad.price;
  let price = 0;
  if (typeof rawPrice === "number") price = rawPrice;
  else if (Array.isArray(rawPrice)) price = Number(rawPrice[0]) || 0;
  else if (typeof rawPrice === "string") price = Number(rawPrice.replace(/[^\d]/g, "")) || 0;
  if (!price || price < 200) return null;

  // Attributes
  const yearStr = attrVal(attrs, "regdate");
  const year = yearStr ? (Number(yearStr.slice(0, 4)) || new Date().getFullYear()) : new Date().getFullYear();
  const mileage = attrNum(attrs, "mileage") ?? 0;
  const fuelRaw = attrVal(attrs, "fuel");
  const gearboxRaw = attrVal(attrs, "gearbox");
  const power = attrNum(attrs, "horse_power_din") ?? attrNum(attrs, "power") ?? null;
  const version = attrVal(attrs, "vehicle_version") ?? attrVal(attrs, "version") ?? null;
  const cylindree = attrNum(attrs, "cubic_capacity") ?? attrNum(attrs, "displacement") ?? attrNum(attrs, "cylindree") ?? null;
  const typeRaw = attrVal(attrs, "vehicle_type") ?? attrVal(attrs, "type");

  // Location
  const loc = (ad.location ?? {}) as Record<string, unknown>;
  const region = String(loc.region_name ?? loc.city ?? "").trim() || null;
  const postalCode = String(loc.zipcode ?? "").trim() || null;

  const isPro = Boolean(ad.pro);
  const sellerKind: "pro" | "particulier" = isPro ? "pro" : "particulier";

  // Photos
  const images = (ad.images ?? {}) as Record<string, unknown>;
  const photosCount = Number(images.nb_images ?? 0);
  const photoUrl: string | null = (() => {
    const t = images.thumb_url ?? images.small_url;
    if (typeof t === 'string' && t) return t;
    const urls = images.urls;
    if (Array.isArray(urls) && urls.length > 0) return String(urls[0]);
    return null;
  })();
  const photoUrls: string[] = (() => {
    const urls = images.urls;
    if (Array.isArray(urls) && urls.length > 0) {
      return (urls as unknown[]).slice(0, 10).map((u) => String(u)).filter(Boolean);
    }
    const t = images.thumb_url ?? images.small_url;
    if (typeof t === 'string' && t) return [t];
    return [];
  })();
  const photosJson: string | null = photoUrls.length > 0 ? JSON.stringify(photoUrls) : null;

  const url = String(ad.url ?? `${BASE}/motos-scooters-quad/${id}.htm`);
  const title = subject || `${brand} ${model}${version ? ` ${version}` : ""}`;

  return {
    id: `lbc-moto-${id}`,
    source: "leboncoin-moto",
    source_id: id,
    url: url.startsWith("http") ? url : `${BASE}${url}`,
    title,
    brand,
    model,
    version,
    engine_designation: null,
    body_type: "inconnu",
    vehicle_type: "moto",
    moto_type: detectMotoType(typeRaw, title),
    cylindree_cc: cylindree ? Math.round(cylindree) : null,
    year: Math.round(year),
    mileage_km: Math.round(Math.max(0, mileage)),
    fuel: mapFuel(fuelRaw),
    gearbox: mapGearbox(gearboxRaw),
    power_hp: power ? Math.round(power) : null,
    price_eur: Math.round(price),
    seller_kind: sellerKind,
    postal_code: postalCode,
    region,
    photos_count: photosCount,
    photo_url: photoUrl,
    photos_json: photosJson,
    posted_at: String(ad.first_publication_date ?? ad.publication_date ?? new Date().toISOString()),
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

function extractAds(data: unknown): LbcAd[] {
  const candidates = [
    dig(data, "props", "pageProps", "searchData", "ads"),
    dig(data, "props", "pageProps", "ads"),
    dig(data, "props", "pageProps", "listings"),
    dig(data, "props", "pageProps", "data", "ads"),
    dig(data, "ads"),
    dig(data, "results"),
  ];
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length > 0) return arr as LbcAd[];
  }
  return [];
}

async function fetchSearchPage(brand: string, model: string): Promise<RawListing[]> {
  const url =
    `${BASE}/motos-scooters-quad/offres/?` +
    new URLSearchParams({
      brand,
      model,
      owner_type: "all",
      regdate: `2010-${new Date().getFullYear()}`,
    }).toString();

  const proxy = process.env.LBC_PROXY;
  if (proxy) process.env.HTTPS_PROXY = proxy;

  const headers: Record<string, string> = {
    "user-agent": UA,
    accept: "text/html,application/xhtml+xml",
    "accept-language": "fr-FR,fr;q=0.9",
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
  };
  const cookie = process.env.LBC_COOKIE;
  if (cookie) headers["cookie"] = cookie;

  let html: string;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return [];
    html = await res.text();
  } catch {
    return [];
  }

  if (html.includes("datadome") && html.includes("challenge") && !html.includes("__NEXT_DATA__")) {
    return [];
  }

  const m = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];

  let data: unknown;
  try { data = JSON.parse(m[1]); } catch { return []; }

  const ads = extractAds(data);
  return ads.map(parseAd).filter((l): l is RawListing => l !== null);
}

export const leboncoinMotoScraper: Scraper = {
  name: "leboncoin-moto",
  async fetch({ limit } = {}): Promise<RawListing[]> {
    const batchSize = Math.min(limit ?? 200, 400);
    const out: RawListing[] = [];
    const seen = new Set<string>();

    for (const { brand, model } of shuffle(MAKES_MODELS)) {
      if (out.length >= batchSize) break;
      try {
        const listings = await fetchSearchPage(brand, model);
        for (const l of listings) {
          if (!seen.has(l.source_id)) {
            seen.add(l.source_id);
            out.push(l);
          }
        }
      } catch (e) {
        console.warn(`[lbc-moto] ${brand}/${model}:`, (e as Error).message);
      }
      await sleep(CRAWL_DELAY);
    }

    console.log(`[lbc-moto] Fetched ${out.length} listings`);
    return out;
  },
};
