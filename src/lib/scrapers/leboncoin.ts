import type { Scraper, RawListing } from "./types";
import { sleep, mapFuel, mapGearbox, shuffle } from "./json-ld-dealer";

// LeBonCoin — plus grand portail VO en France (particuliers + pros).
// Stratégie : GET /voitures/offres/?brand=X&model=Y → __NEXT_DATA__ (ads[]).
//
// Variables d'environnement :
//   LBC_COOKIE         — session cookie LBC (ex: "datadome=...;lbc_session=...")
//                        optionnel, améliore le taux de succès
//   LBC_PROXY          — proxy résidentiel (ex: "http://user:pass@proxy:port")
//                        recommandé si Cloudflare/DataDome bloque
//   LBC_CRAWL_DELAY_MS — délai entre requêtes (défaut 5000 ms)
//
// Sans proxy résidentiel, LBC bloque fréquemment les requêtes serveur
// (DataDome bot protection). Le scraper retourne [] silencieusement si bloqué.

const UA =
  process.env.SCRAPER_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const CRAWL_DELAY = Number(process.env.LBC_CRAWL_DELAY_MS ?? 5000);
const BASE = "https://www.leboncoin.fr";

// Popular French makes/models in LBC's URL format (lowercase, French names)
const MAKES_MODELS: { brand: string; model: string }[] = [
  { brand: "renault", model: "clio" },
  { brand: "renault", model: "megane" },
  { brand: "renault", model: "captur" },
  { brand: "renault", model: "kadjar" },
  { brand: "peugeot", model: "208" },
  { brand: "peugeot", model: "2008" },
  { brand: "peugeot", model: "308" },
  { brand: "peugeot", model: "3008" },
  { brand: "volkswagen", model: "golf" },
  { brand: "volkswagen", model: "polo" },
  { brand: "volkswagen", model: "tiguan" },
  { brand: "dacia", model: "sandero" },
  { brand: "dacia", model: "duster" },
  { brand: "citroen", model: "c3" },
  { brand: "citroen", model: "berlingo" },
  { brand: "toyota", model: "yaris" },
  { brand: "bmw", model: "serie 1" },
  { brand: "bmw", model: "serie 3" },
  { brand: "bmw", model: "x3" },
  { brand: "mercedes-benz", model: "classe a" },
  { brand: "mercedes-benz", model: "classe c" },
  { brand: "audi", model: "a3" },
  { brand: "audi", model: "q3" },
  { brand: "ford", model: "focus" },
  { brand: "opel", model: "corsa" },
  { brand: "seat", model: "ibiza" },
  { brand: "seat", model: "leon" },
  { brand: "skoda", model: "octavia" },
  { brand: "nissan", model: "qashqai" },
  { brand: "hyundai", model: "tucson" },
  { brand: "kia", model: "sportage" },
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
  if (!price || price < 500) return null;

  // Attributes
  const yearStr = attrVal(attrs, "regdate");
  const year = yearStr ? (Number(yearStr.slice(0, 4)) || new Date().getFullYear()) : new Date().getFullYear();
  const mileage = attrNum(attrs, "mileage") ?? 0;
  const fuelRaw = attrVal(attrs, "fuel");
  const gearboxRaw = attrVal(attrs, "gearbox");
  const power = attrNum(attrs, "horse_power_din") ?? attrNum(attrs, "power") ?? null;
  const version = attrVal(attrs, "vehicle_version") ?? attrVal(attrs, "version") ?? null;

  // Location
  const loc = (ad.location ?? {}) as Record<string, unknown>;
  const region = String(loc.region_name ?? loc.city ?? "").trim() || null;
  const postalCode = String(loc.zipcode ?? "").trim() || null;

  // Seller
  const isPro = Boolean(ad.pro);
  const sellerKind: "pro" | "particulier" = isPro ? "pro" : "particulier";

  // Photos
  const images = (ad.images ?? {}) as Record<string, unknown>;
  const photosCount = Number(images.nb_images ?? 0);

  const url = String(ad.url ?? `${BASE}/voitures/${id}.htm`);

  // Derive title: prefer subject, fallback to brand+model
  const title = subject || `${brand} ${model}${version ? ` ${version}` : ""}`;

  return {
    id: `lbc-${id}`,
    source: "leboncoin",
    source_id: id,
    url: url.startsWith("http") ? url : `${BASE}${url}`,
    title,
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

  const pageProps = dig(data, "props", "pageProps");
  if (pageProps && typeof pageProps === "object") {
    for (const val of Object.values(pageProps as Record<string, unknown>)) {
      if (Array.isArray(val) && val.length > 0) {
        const first = val[0] as Record<string, unknown>;
        if (first.list_id || first.id) return val as LbcAd[];
      }
    }
  }

  return [];
}

async function fetchSearchPage(brand: string, model: string): Promise<RawListing[]> {
  const url =
    `${BASE}/voitures/offres/?` +
    new URLSearchParams({
      brand,
      model,
      owner_type: "all",
      regdate: `2015-${new Date().getFullYear()}`,
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
    "sec-ch-ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
  };

  const cookie = process.env.LBC_COOKIE;
  if (cookie) headers["cookie"] = cookie;

  let html: string;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const ct = res.headers.get("content-type") ?? "";
    // DataDome typically returns 403 or serves a challenge page
    if (!ct.includes("html")) return [];
    html = await res.text();
  } catch {
    return [];
  }

  // Check for bot challenge (DataDome / Cloudflare interstitial)
  if (html.includes("datadome") && html.includes("challenge") && !html.includes("__NEXT_DATA__")) {
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

  const ads = extractAds(data);
  return ads.map(parseAd).filter((l): l is RawListing => l !== null);
}

let lbcBlockedWarned = false;

export const leboncoinScraper: Scraper = {
  name: "leboncoin",
  async fetch({ limit } = {}): Promise<RawListing[]> {
    const batchSize = Math.min(limit ?? 150, 300);
    const out: RawListing[] = [];
    const seen = new Set<string>();
    let blocked = 0;

    for (const { brand, model } of shuffle(MAKES_MODELS)) {
      if (out.length >= batchSize) break;
      try {
        const listings = await fetchSearchPage(brand, model);
        if (listings.length === 0) {
          blocked++;
        } else {
          blocked = 0;
        }
        for (const l of listings) {
          if (!seen.has(l.source_id)) {
            seen.add(l.source_id);
            out.push(l);
          }
        }
      } catch (e) {
        console.warn(`[leboncoin] ${brand}/${model}:`, (e as Error).message);
      }

      // If 3+ consecutive empty results, likely blocked — stop and warn once
      if (blocked >= 3) {
        if (!lbcBlockedWarned) {
          console.warn("[leboncoin] Blocked by bot protection. Set LBC_COOKIE or LBC_PROXY to enable this source.");
          lbcBlockedWarned = true;
        }
        break;
      }

      await sleep(CRAWL_DELAY);
    }

    if (out.length > 0) lbcBlockedWarned = false; // reset for next run if we got data
    console.log(`[leboncoin] Fetched ${out.length} listings`);
    return out;
  },
};
