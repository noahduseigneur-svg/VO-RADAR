import type { Scraper, RawListing } from "./types";
import { sleep, mapFuel, mapGearbox, shuffle, safeYear } from "./json-ld-dealer";

// Marktplaats.nl — 1er portail petites annonces des Pays-Bas (Adevinta).
// Très similaire au LeBonCoin en termes de structure HTML/__NEXT_DATA__.
// ~500 000 annonces auto, majoritairement particuliers.
// Véhicules hollandais souvent bien entretenus, faibles km, prix compétitifs.
//
// Variables :
//   MARKTPLAATS_COOKIE         — cookie session optionnel (améliore le taux)
//   MARKTPLAATS_CRAWL_DELAY_MS — délai entre requêtes (défaut 3000 ms)

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const CRAWL_DELAY = Number(process.env.MARKTPLAATS_CRAWL_DELAY_MS ?? 3000);
const BASE = "https://www.marktplaats.nl";

// Requêtes de recherche — noms en néerlandais pour Marktplaats
const QUERIES: { q: string; brand: string; model: string }[] = [
  { q: "Renault Clio",    brand: "Renault",       model: "Clio" },
  { q: "Renault Megane",  brand: "Renault",       model: "Megane" },
  { q: "Renault Captur",  brand: "Renault",       model: "Captur" },
  { q: "Peugeot 208",     brand: "Peugeot",       model: "208" },
  { q: "Peugeot 2008",    brand: "Peugeot",       model: "2008" },
  { q: "Volkswagen Golf", brand: "Volkswagen",    model: "Golf" },
  { q: "Volkswagen Polo", brand: "Volkswagen",    model: "Polo" },
  { q: "BMW Serie 3",     brand: "BMW",           model: "3-Serie" },
  { q: "BMW Serie 1",     brand: "BMW",           model: "1-Serie" },
  { q: "Mercedes C",      brand: "Mercedes-Benz", model: "C-Klasse" },
  { q: "Audi A3",         brand: "Audi",          model: "A3" },
  { q: "Opel Corsa",      brand: "Opel",          model: "Corsa" },
  { q: "Opel Astra",      brand: "Opel",          model: "Astra" },
  { q: "Ford Fiesta",     brand: "Ford",          model: "Fiesta" },
  { q: "Ford Focus",      brand: "Ford",          model: "Focus" },
  { q: "Skoda Octavia",   brand: "Skoda",         model: "Octavia" },
  { q: "Toyota Yaris",    brand: "Toyota",        model: "Yaris" },
  { q: "Toyota Corolla",  brand: "Toyota",        model: "Corolla" },
  { q: "Nissan Qashqai",  brand: "Nissan",        model: "Qashqai" },
  { q: "Hyundai Tucson",  brand: "Hyundai",       model: "Tucson" },
  { q: "Kia Sportage",    brand: "Kia",           model: "Sportage" },
  { q: "Dacia Sandero",   brand: "Dacia",         model: "Sandero" },
  { q: "Citroen C3",      brand: "Citroen",       model: "C3" },
  { q: "Fiat 500",        brand: "Fiat",          model: "500" },
  { q: "Seat Ibiza",      brand: "Seat",          model: "Ibiza" },
  { q: "Volkswagen Tiguan", brand: "Volkswagen",  model: "Tiguan" },
  // Budget
  { q: "Citroen C1",     brand: "Citroen",  model: "C1" },
  { q: "Toyota Aygo",    brand: "Toyota",   model: "Aygo" },
  { q: "Volkswagen Up",  brand: "Volkswagen", model: "Up!" },
  { q: "Hyundai i20",    brand: "Hyundai",  model: "i20" },
];

type MpAd = Record<string, unknown>;

function dig(o: unknown, ...keys: string[]): unknown {
  let cur: unknown = o;
  for (const k of keys) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function strVal(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return strVal(o.label ?? o.name ?? o.value ?? o.title ?? o.text);
  }
  return null;
}

function numVal(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function attrByKey(attrs: unknown[], key: string): string | null {
  if (!Array.isArray(attrs)) return null;
  for (const a of attrs) {
    const ao = a as Record<string, unknown>;
    if (String(ao.key ?? ao.name ?? ao.attribute ?? "").toLowerCase() === key.toLowerCase()) {
      return strVal(ao.value ?? ao.valueLabel ?? ao.label);
    }
  }
  return null;
}

function parseAd(ad: MpAd, fallbackBrand: string, fallbackModel: string): RawListing | null {
  const id = strVal(ad.itemId ?? ad.id ?? ad.adId);
  if (!id) return null;

  const title = strVal(ad.title ?? ad.subject ?? ad.name) ?? "";

  // Prix
  let price = 0;
  const priceObj = ad.price ?? ad.priceInfo;
  if (typeof priceObj === "number") price = priceObj;
  else if (typeof priceObj === "object" && priceObj !== null) {
    const po = priceObj as Record<string, unknown>;
    price = numVal(po.amount ?? po.value ?? po.priceValueInCents) ?? 0;
    // Parfois en centimes
    if (price > 50_000_000) price = price / 100;
  } else if (typeof priceObj === "string") price = numVal(priceObj) ?? 0;
  if (!price || price < 100 || price > 500_000) return null;

  const attrs: unknown[] = Array.isArray(ad.attributes) ? ad.attributes : [];

  // Attributes Marktplaats (clés typiques)
  const brand = attrByKey(attrs, "brand") ?? attrByKey(attrs, "merk") ?? fallbackBrand;
  const model = attrByKey(attrs, "model") ?? fallbackModel;

  const yearStr = attrByKey(attrs, "constructionYear") ?? attrByKey(attrs, "bouwjaar") ?? attrByKey(attrs, "registrationYear");
  const yearRaw = yearStr ? Number(yearStr.match(/(\d{4})/)?.[1]) : null;
  const year = safeYear(yearRaw);
  if (!year) return null; // rejeter si année indéterminable

  const mileageStr = attrByKey(attrs, "mileage") ?? attrByKey(attrs, "km") ?? attrByKey(attrs, "kilometerstand");
  const mileage = numVal(mileageStr) ?? 0;

  const fuelRaw = attrByKey(attrs, "fuel") ?? attrByKey(attrs, "brandstof");
  const gearboxRaw = attrByKey(attrs, "transmission") ?? attrByKey(attrs, "transmissie") ?? attrByKey(attrs, "gearbox");
  const powerRaw = attrByKey(attrs, "power") ?? attrByKey(attrs, "vermogen") ?? attrByKey(attrs, "horsePower");
  const power = numVal(powerRaw) ?? null;

  // Localisation
  const loc = (ad.location ?? ad.seller ?? {}) as Record<string, unknown>;
  const city = strVal(loc.cityName ?? loc.city ?? loc.gemeente) ?? null;
  const postalCode = strVal(loc.postcode ?? loc.zip ?? loc.zipCode) ?? null;
  const region = city ? city : "Pays-Bas";

  // Vendeur : Marktplaats est principalement particuliers
  const sellerObj = (ad.seller ?? ad.sellerInfo ?? {}) as Record<string, unknown>;
  const isPro = Boolean(sellerObj.isDealer ?? sellerObj.isPro ?? sellerObj.professional ?? sellerObj.dealer);
  const sellerKind: "pro" | "particulier" = isPro ? "pro" : "particulier";

  // URL
  const relUrl = strVal(ad.url ?? ad.link ?? ad.itemUrl) ?? "";
  const fullUrl = relUrl.startsWith("http")
    ? relUrl
    : relUrl
    ? `${BASE}${relUrl}`
    : `${BASE}/a/${id}.htm`;

  // Photos
  const imgs = ad.images ?? ad.photos ?? ad.pictures ?? [];
  const photosCount = Array.isArray(imgs) ? imgs.length : 0;
  const photoUrl: string | null = (() => {
    if (!Array.isArray(imgs) || imgs.length === 0) return null;
    const first = imgs[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      const o = first as Record<string, unknown>;
      const u = o.url ?? o.uri ?? o.src ?? o.href ?? o.extraExtraLarge ?? o.extraLarge ?? o.large ?? o.medium ?? o.small;
      return typeof u === 'string' ? u : null;
    }
    return null;
  })();

  return {
    id: `marktplaats-${id}`,
    source: "marktplaats",
    source_id: id,
    url: fullUrl,
    title: title || `${brand} ${model}`,
    brand,
    model,
    version: null,
    engine_designation: null,
    body_type: "inconnu",
    year,
    mileage_km: Math.max(0, Math.round(mileage)),
    fuel: mapFuel(fuelRaw),
    gearbox: mapGearbox(gearboxRaw),
    power_hp: power ? Math.round(power) : null,
    price_eur: Math.round(price),
    seller_kind: sellerKind,
    postal_code: postalCode,
    region,
    photos_count: photosCount,
    photo_url: photoUrl,
    posted_at: strVal(ad.date ?? ad.timestamp ?? ad.firstPublicationDate) ?? new Date().toISOString(),
  };
}

function extractAds(data: unknown): MpAd[] {
  const candidates = [
    dig(data, "props", "pageProps", "searchData", "ads"),
    dig(data, "props", "pageProps", "listings"),
    dig(data, "props", "pageProps", "ads"),
    dig(data, "props", "pageProps", "items"),
    dig(data, "props", "pageProps", "data", "ads"),
    dig(data, "props", "pageProps", "initialData", "ads"),
    dig(data, "ads"),
    dig(data, "items"),
    dig(data, "listings"),
    dig(data, "results"),
  ];
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length > 0) return arr as MpAd[];
  }

  const pp = dig(data, "props", "pageProps");
  if (pp && typeof pp === "object") {
    for (const val of Object.values(pp as Record<string, unknown>)) {
      if (Array.isArray(val) && val.length > 0) {
        const first = val[0] as Record<string, unknown>;
        if (first.itemId ?? first.id ?? first.adId) return val as MpAd[];
      }
    }
  }
  return [];
}

async function fetchSearchPage(query: string, brand: string, model: string): Promise<RawListing[]> {
  const url =
    `${BASE}/l/auto-s/c91/` +
    `q:${encodeURIComponent(query)}/`;

  const headers: Record<string, string> = {
    "user-agent": UA,
    accept: "text/html,application/xhtml+xml",
    "accept-language": "nl-NL,nl;q=0.9,fr;q=0.8",
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
  };
  const cookie = process.env.MARKTPLAATS_COOKIE;
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

  // __NEXT_DATA__ (Marktplaats utilise Next.js comme LBC)
  const m = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];

  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }

  const ads = extractAds(data);
  return ads
    .map((ad) => parseAd(ad, brand, model))
    .filter((l): l is RawListing => l !== null);
}

let blockedWarned = false;

export const marktplaatsScraper: Scraper = {
  name: "marktplaats",
  async fetch({ limit } = {}): Promise<RawListing[]> {
    const batchSize = Math.min(limit ?? 300, 800);
    const out: RawListing[] = [];
    const seen = new Set<string>();
    let emptyStreak = 0;

    for (const { q, brand, model } of shuffle(QUERIES)) {
      if (out.length >= batchSize) break;
      try {
        const listings = await fetchSearchPage(q, brand, model);
        if (listings.length === 0) {
          emptyStreak++;
        } else {
          emptyStreak = 0;
          blockedWarned = false;
        }
        for (const l of listings) {
          if (!seen.has(l.source_id)) {
            seen.add(l.source_id);
            out.push(l);
          }
        }
        if (listings.length > 0) {
          console.log(`[marktplaats] "${q}": +${listings.length} (total ${out.length})`);
        }
      } catch (e) {
        console.warn(`[marktplaats] "${q}":`, (e as Error).message);
      }

      if (emptyStreak >= 4 && !blockedWarned) {
        console.warn("[marktplaats] 4 résultats vides consécutifs. Ajoutez MARKTPLAATS_COOKIE si bloqué.");
        blockedWarned = true;
        break;
      }
      await sleep(CRAWL_DELAY);
    }

    console.log(`[marktplaats] Fetched ${out.length} listings`);
    return out;
  },
};
