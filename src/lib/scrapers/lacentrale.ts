import type { Scraper, RawListing } from "./types";
import { sleep, mapFuel, mapGearbox, shuffle } from "./json-ld-dealer";

// La Centrale — principal portail B2C/B2B VO en France.
// Stratégie : GET /listing?makesModelsCommercialNames=BRAND:MODEL → __NEXT_DATA__.
// Variables d'environnement :
//   LC_CRAWL_DELAY_MS  — délai entre requêtes (défaut 4000 ms)
//   LC_BATCH_SIZE      — max listings par run (défaut 200)

const UA =
  process.env.SCRAPER_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const CRAWL_DELAY = Number(process.env.LC_CRAWL_DELAY_MS ?? 4000);
const BASE = "https://www.lacentrale.fr";

const MAKES_MODELS: { make: string; model: string }[] = [
  { make: "RENAULT", model: "CLIO" },
  { make: "RENAULT", model: "MEGANE" },
  { make: "RENAULT", model: "CAPTUR" },
  { make: "RENAULT", model: "KADJAR" },
  { make: "PEUGEOT", model: "208" },
  { make: "PEUGEOT", model: "2008" },
  { make: "PEUGEOT", model: "308" },
  { make: "PEUGEOT", model: "3008" },
  { make: "VOLKSWAGEN", model: "GOLF" },
  { make: "VOLKSWAGEN", model: "POLO" },
  { make: "VOLKSWAGEN", model: "TIGUAN" },
  { make: "DACIA", model: "SANDERO" },
  { make: "DACIA", model: "DUSTER" },
  { make: "CITROEN", model: "C3" },
  { make: "CITROEN", model: "BERLINGO" },
  { make: "TOYOTA", model: "YARIS" },
  { make: "BMW", model: "SERIE 1" },
  { make: "BMW", model: "SERIE 3" },
  { make: "BMW", model: "X3" },
  { make: "MERCEDES", model: "CLASSE A" },
  { make: "MERCEDES", model: "CLASSE C" },
  { make: "AUDI", model: "A3" },
  { make: "AUDI", model: "Q3" },
  { make: "FORD", model: "FOCUS" },
  { make: "OPEL", model: "CORSA" },
  { make: "SEAT", model: "IBIZA" },
  { make: "SEAT", model: "LEON" },
  { make: "SKODA", model: "OCTAVIA" },
  { make: "NISSAN", model: "QASHQAI" },
  { make: "HYUNDAI", model: "TUCSON" },
  { make: "KIA", model: "SPORTAGE" },
];

type LcVehicle = Record<string, unknown>;

function str(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    const s = str(o.label ?? o.name ?? o.value);
    return s;
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

  const version = str(v.version ?? v.versionLabel ?? v.finition ?? v.variant) ?? null;
  const year = num(v.year ?? v.firstRegistrationYear ?? v.registrationYear ?? v.annee) ?? new Date().getFullYear();
  const mileage = num(v.mileage ?? v.km ?? v.mileageLabel ?? v.kilometrage) ?? 0;
  const price = extractPrice(v);
  if (!price || price < 500) return null;

  const fuelRaw = str(v.fuel ?? v.energy ?? v.energyLabel ?? v.carburant ?? v.energie);
  const gearboxRaw = str(v.gearbox ?? v.transmission ?? v.boite ?? v.gearboxLabel);
  const engineObj = typeof v.engine === "object" && v.engine !== null ? (v.engine as Record<string, unknown>) : {};
  const power = num(v.power ?? v.horsePower ?? v.powerCh ?? v.cv ?? v.chevaux ?? engineObj.power ?? engineObj.horsePower) ?? null;

  const region = str(v.region ?? v.city ?? v.location ?? v.ville ?? v.department) ?? null;
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
      const u = o.url ?? o.uri ?? o.src ?? o.href ?? o.large ?? o.medium ?? o.small;
      return typeof u === 'string' ? u : null;
    }
    return null;
  })();
  const photoUrls: string[] = Array.isArray(photos)
    ? (photos as unknown[]).slice(0, 10).map((img) => {
        if (typeof img === 'string') return img;
        if (img && typeof img === 'object') {
          const o = img as Record<string, unknown>;
          const u = o.url ?? o.uri ?? o.src ?? o.href ?? o.large ?? o.medium ?? o.small;
          return typeof u === 'string' ? u : '';
        }
        return '';
      }).filter(Boolean)
    : [];
  const photosJson: string | null = photoUrls.length > 0 ? JSON.stringify(photoUrls) : null;

  const urlRaw = str(v.url ?? v.adUrl ?? v.link);
  const url = urlRaw
    ? urlRaw.startsWith("http") ? urlRaw : `${BASE}${urlRaw}`
    : `${BASE}/listing?id=${id}`;

  return {
    id: `lacentrale-${id}`,
    source: "lacentrale",
    source_id: id,
    url,
    title: `${brand} ${model}${version ? ` ${version}` : ""}`,
    brand,
    model,
    version,
    engine_designation: null,
    body_type: "inconnu",
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
    dig(data, "props", "pageProps", "data", "ads"),
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
    `${BASE}/listing?` +
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
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }

  const vehicles = extractVehicleArray(data);
  return vehicles.map(parseVehicle).filter((l): l is RawListing => l !== null);
}

export const lacentraleScraper: Scraper = {
  name: "lacentrale",
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
        console.warn(`[lacentrale] ${make}/${model}:`, (e as Error).message);
      }
      await sleep(CRAWL_DELAY);
    }

    console.log(`[lacentrale] Fetched ${out.length} listings`);
    return out;
  },
};
