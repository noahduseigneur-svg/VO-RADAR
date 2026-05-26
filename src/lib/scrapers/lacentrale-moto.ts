import type { Scraper, RawListing } from "./types";
import { sleep, mapFuel, mapGearbox, shuffle, safeYear } from "./json-ld-dealer";
import type { MotoType } from "../types";

// La Centrale — section motos.
// Stratégie : GET /moto?makesModelsCommercialNames=BRAND:MODEL → __NEXT_DATA__.
// Variables d'environnement :
//   LC_CRAWL_DELAY_MS — délai entre requêtes (défaut 4000 ms)

const UA =
  process.env.SCRAPER_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const CRAWL_DELAY = Number(process.env.LC_CRAWL_DELAY_MS ?? 4000);
const BASE = "https://www.lacentrale.fr";

const MAKES_MODELS: { make: string; model: string }[] = [
  { make: "YAMAHA", model: "MT-07" },
  { make: "YAMAHA", model: "MT-09" },
  { make: "YAMAHA", model: "YZF-R1" },
  { make: "YAMAHA", model: "T-MAX" },
  { make: "YAMAHA", model: "TENERE 700" },
  { make: "HONDA", model: "CB 500 F" },
  { make: "HONDA", model: "CB 650 R" },
  { make: "HONDA", model: "CBR 1000 RR" },
  { make: "HONDA", model: "FORZA" },
  { make: "HONDA", model: "AFRICA TWIN" },
  { make: "KAWASAKI", model: "Z 900" },
  { make: "KAWASAKI", model: "NINJA 650" },
  { make: "KAWASAKI", model: "VERSYS 650" },
  { make: "KAWASAKI", model: "Z 1000" },
  { make: "BMW", model: "F 850 GS" },
  { make: "BMW", model: "R 1250 GS" },
  { make: "BMW", model: "S 1000 RR" },
  { make: "BMW", model: "R NINET" },
  { make: "KTM", model: "DUKE 790" },
  { make: "KTM", model: "DUKE 890" },
  { make: "KTM", model: "ADVENTURE 790" },
  { make: "DUCATI", model: "MONSTER" },
  { make: "DUCATI", model: "MULTISTRADA" },
  { make: "DUCATI", model: "SCRAMBLER" },
  { make: "TRIUMPH", model: "STREET TRIPLE" },
  { make: "TRIUMPH", model: "TIGER 900" },
  { make: "TRIUMPH", model: "BONNEVILLE" },
  { make: "SUZUKI", model: "GSX-R 750" },
  { make: "SUZUKI", model: "SV 650" },
  { make: "SUZUKI", model: "V-STROM 650" },
  { make: "HARLEY-DAVIDSON", model: "SPORTSTER" },
  { make: "HARLEY-DAVIDSON", model: "SOFTAIL" },
  { make: "APRILIA", model: "RS 660" },
  { make: "APRILIA", model: "TUONO" },
];

type LcVehicle = Record<string, unknown>;

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

function detectMotoType(typeRaw: string | null, title: string): MotoType {
  const s = (typeRaw ?? title ?? "").toLowerCase();
  if (/scooter|maxi.?scooter|tmax|forza|pcx|nmax/.test(s)) return "scooter";
  if (/trail|adventure|adv|gs|vstrom|transalp|africa|tenere|tiger|multistrada|versys/.test(s)) return "trail";
  if (/sportive|rr|r1|r6|cbr|gsxr|superbike/.test(s)) return "sportive";
  if (/roadster|naked|street|mt-|z[0-9]|cb[0-9]|duke|monster|tuono|speed/.test(s)) return "roadster";
  if (/custom|chopper|cruiser|harley|softail|sportster|bonneville/.test(s)) return "custom";
  if (/enduro|motocross|cross|off.road/.test(s)) return "enduro";
  if (/touring|tour|goldwing|road glide|bagage/.test(s)) return "tourisme";
  return "autre";
}

function extractPrice(v: LcVehicle): number {
  const raw = v.price ?? v.priceLabel ?? v.prices;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return num(raw) ?? 0;
  if (Array.isArray(raw)) return num(raw[0]) ?? 0;
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    return num(o.value ?? o.amount ?? o.EUR ?? o.price) ?? 0;
  }
  return 0;
}

function parseVehicle(v: LcVehicle): RawListing | null {
  const id = str(v.id ?? v.adId ?? v.vehicleId ?? v.annonce_id);
  if (!id) return null;

  const brand = str(v.brand ?? v.brandLabel ?? v.make ?? v.marque);
  const model = str(v.model ?? v.modelLabel ?? v.modele);
  if (!brand || !model) return null;

  const version = str(v.version ?? v.versionLabel ?? v.finition) ?? null;
  const year = safeYear(num(v.year ?? v.firstRegistrationYear ?? v.registrationYear ?? v.annee)) ?? 2015;
  const mileage = num(v.mileage ?? v.km ?? v.mileageLabel ?? v.kilometrage) ?? 0;
  const price = extractPrice(v);
  if (!price || price < 200) return null;

  const fuelRaw = str(v.fuel ?? v.energy ?? v.energyLabel ?? v.carburant);
  const gearboxRaw = str(v.gearbox ?? v.transmission ?? v.boite ?? v.gearboxLabel);
  const engineObj = typeof v.engine === "object" && v.engine !== null ? (v.engine as Record<string, unknown>) : {};
  const power = num(v.power ?? v.horsePower ?? v.powerCh ?? v.cv ?? engineObj.power) ?? null;
  const cylindree = num(v.displacement ?? v.cylindree ?? v.cubicCapacity ?? engineObj.displacement) ?? null;
  const typeRaw = str(v.vehicleType ?? v.categoryLabel ?? v.type);

  const region = str(v.region ?? v.city ?? v.location ?? v.ville) ?? null;
  const postalCode = str(v.zipCode ?? v.postalCode ?? v.zip ?? v.codePostal) ?? null;
  const sellerRaw = str(v.sellerType ?? v.vendeurType ?? v.seller);
  const sellerKind: "pro" | "particulier" =
    sellerRaw && /pro|profes|dealer|concession/i.test(sellerRaw) ? "pro" : "particulier";

  const photos = v.photos ?? v.images ?? v.photo;
  const photosCount = Array.isArray(photos) ? photos.length : 0;
  const photoUrl: string | null = (() => {
    if (!Array.isArray(photos) || photos.length === 0) return null;
    const first = photos[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      const o = first as Record<string, unknown>;
      const u = o.url ?? o.uri ?? o.src ?? o.large ?? o.medium;
      return typeof u === 'string' ? u : null;
    }
    return null;
  })();
  const photoUrls: string[] = Array.isArray(photos)
    ? (photos as unknown[]).slice(0, 10).map((img) => {
        if (typeof img === 'string') return img;
        if (img && typeof img === 'object') {
          const o = img as Record<string, unknown>;
          const u = o.url ?? o.uri ?? o.src ?? o.large ?? o.medium;
          return typeof u === 'string' ? u : '';
        }
        return '';
      }).filter(Boolean)
    : [];
  const photosJson: string | null = photoUrls.length > 0 ? JSON.stringify(photoUrls) : null;

  const urlRaw = str(v.url ?? v.adUrl ?? v.link);
  const title = `${brand} ${model}${version ? ` ${version}` : ""}`;
  const url = urlRaw
    ? urlRaw.startsWith("http") ? urlRaw : `${BASE}${urlRaw}`
    : `${BASE}/moto?id=${id}`;

  return {
    id: `lc-moto-${id}`,
    source: "lacentrale-moto",
    source_id: id,
    url,
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

function extractVehicleArray(data: unknown): LcVehicle[] {
  const candidates = [
    dig(data, "props", "pageProps", "vehicles"),
    dig(data, "props", "pageProps", "ads"),
    dig(data, "props", "pageProps", "searchResults", "vehicles"),
    dig(data, "props", "pageProps", "searchResults", "ads"),
    dig(data, "props", "pageProps", "listings"),
    dig(data, "props", "pageProps", "data", "vehicles"),
    dig(data, "props", "pageProps", "initialData", "vehicles"),
    dig(data, "vehicles"),
    dig(data, "ads"),
    dig(data, "results"),
  ];

  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "object") {
      return arr as LcVehicle[];
    }
  }

  const pageProps = dig(data, "props", "pageProps");
  if (pageProps && typeof pageProps === "object") {
    for (const val of Object.values(pageProps as Record<string, unknown>)) {
      if (Array.isArray(val) && val.length > 0) {
        const first = val[0] as Record<string, unknown>;
        if (first.id || first.adId || first.vehicleId) return val as LcVehicle[];
      }
    }
  }

  return [];
}

async function fetchSearchPage(make: string, model: string): Promise<RawListing[]> {
  const url =
    `${BASE}/moto?` +
    new URLSearchParams({
      makesModelsCommercialNames: `${make}:${model}`,
      sortBy: "bestDeal",
      page: "1",
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
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return [];
    html = await res.text();
  } catch {
    return [];
  }

  const m = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];

  let data: unknown;
  try { data = JSON.parse(m[1]); } catch { return []; }

  const vehicles = extractVehicleArray(data);
  return vehicles.map(parseVehicle).filter((l): l is RawListing => l !== null);
}

export const lacentraleMotoScraper: Scraper = {
  name: "lacentrale-moto",
  async fetch({ limit } = {}): Promise<RawListing[]> {
    const batchSize = Math.min(limit ?? 200, 400);
    const out: RawListing[] = [];
    const seen = new Set<string>();

    for (const { make, model } of shuffle(MAKES_MODELS)) {
      if (out.length >= batchSize) break;
      try {
        const listings = await fetchSearchPage(make, model);
        for (const l of listings) {
          if (!seen.has(l.source_id)) {
            seen.add(l.source_id);
            out.push(l);
          }
        }
      } catch (e) {
        console.warn(`[lc-moto] ${make}/${model}:`, (e as Error).message);
      }
      await sleep(CRAWL_DELAY);
    }

    console.log(`[lc-moto] Fetched ${out.length} listings`);
    return out;
  },
};
