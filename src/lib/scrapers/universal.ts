import type { RawListing } from "./types";
import {
  createJsonLdDealerScraper, extractCarJsonLd, type JsonLdCar,
  strField, numField, yearFromDate, mapFuel, mapGearbox, sleep, shuffle,
} from "./json-ld-dealer";
import type { Scraper } from "./types";
import type { CustomSource } from "../db";

// Adapter universel best-effort qui extrait un Listing depuis n'importe quel
// node JSON-LD schema.org/Car. Couvre les variantes les plus communes :
//   - brand: string | { name }
//   - model: string | { name }
//   - mileageFromOdometer: { value } | number
//   - vehicleEngine: { name } | { engineType, additionalProperty }
//   - dateVehicleFirstRegistered | productionDate | itemCondition
//   - offers: { price, priceCurrency, itemCondition }
//   - image: string | string[]
//
// Quand on a juste une URL et un sitemap, on n'a pas de "source_id" fiable —
// on dérive l'id depuis l'URL (slug ou query string).

interface UniversalCar extends JsonLdCar {
  sku?: string; productID?: string; "@id"?: string;
  brand?: unknown; model?: unknown;
  vehicleConfiguration?: string;
  name?: string;
  dateVehicleFirstRegistered?: string; productionDate?: string; releaseDate?: string;
  fuelType?: string;
  mileageFromOdometer?: unknown;
  vehicleTransmission?: unknown;
  vehicleEngine?: { name?: string; enginePower?: { value?: string | number; unitText?: string }; additionalProperty?: { name?: string; value?: unknown }[] };
  image?: unknown;
  offers?: { price?: string | number; priceCurrency?: string; itemCondition?: string; "@type"?: string };
}

export function buildUniversalAdapter(sourceName: string) {
  return (node: JsonLdCar, url: string): RawListing | null => {
    const car = node as UniversalCar;
    const price = numField(car.offers?.price);
    if (!price || price <= 500 || price > 500_000) return null;

    const condition = (car.offers?.itemCondition ?? "").toLowerCase();
    if (condition.includes("new")) return null; // skip new cars

    const brand = strField(car.brand) ?? guessBrandFromUrl(url) ?? "Inconnu";
    const model = strField(car.model) ?? guessModelFromName(car.name, brand) ?? guessModelFromUrl(url) ?? "Inconnu";
    if (brand === "Inconnu" && model === "Inconnu") return null;

    const version = car.vehicleConfiguration ?? null;
    const engineDesignation = car.vehicleEngine?.name ?? extractEngineFromProps(car) ?? null;
    const mileage = numField(car.mileageFromOdometer) ?? 0;
    const fuel = mapFuel(car.fuelType ?? null);
    const trans = strField(car.vehicleTransmission);
    const gearbox = mapGearbox(trans);
    const year = yearFromDate(car.dateVehicleFirstRegistered) ?? yearFromDate(car.productionDate) ?? yearFromDate(car.releaseDate) ?? deriveYearFromUrl(url) ?? new Date().getFullYear();

    let power: number | null = null;
    if (engineDesignation) {
      const m = engineDesignation.match(/(\d{2,4})\s*(ch|hp|kw)/i);
      if (m) {
        const n = Number(m[1]);
        power = /kw/i.test(m[2]) ? Math.round(n * 1.36) : (n > 30 && n < 1500 ? n : null);
      }
    }
    if (!power && car.vehicleEngine?.enginePower) {
      const v = numField(car.vehicleEngine.enginePower);
      const unit = car.vehicleEngine.enginePower.unitText ?? "";
      if (v && v > 30) power = /kw/i.test(unit) ? Math.round(v * 1.36) : v;
    }

    const sourceId = deriveSourceIdFromUrl(url);
    if (!sourceId) return null;

    return {
      id: `${sourceName}-${sourceId}`,
      source: sourceName,
      source_id: sourceId,
      url,
      title: `${brand} ${model}${version ? ` ${version}` : ""}${engineDesignation ? ` · ${engineDesignation}` : ""}`,
      brand,
      model,
      version,
      engine_designation: engineDesignation,
      body_type: "inconnu",
      year,
      mileage_km: Math.round(mileage),
      fuel,
      gearbox,
      power_hp: power,
      price_eur: Math.round(price),
      seller_kind: "pro",
      postal_code: null,
      region: null,
      photos_count: Array.isArray(car.image) ? car.image.length : car.image ? 1 : 0,
      posted_at: new Date().toISOString(),
    };
  };
}

function extractEngineFromProps(car: UniversalCar): string | null {
  const props = car.vehicleEngine?.additionalProperty;
  if (!Array.isArray(props)) return null;
  for (const p of props) {
    if (!p?.name || p.value === undefined) continue;
    if (/Puissance|Power|Engine|Motorisation/i.test(p.name)) {
      const v = String(p.value);
      if (v.trim()) return v;
    }
  }
  return null;
}

function deriveSourceIdFromUrl(url: string): string | null {
  // Cherche un identifiant dans la query string (?vehicleId=, ?id=) ou en fin de path
  const qMatch = url.match(/[?&](?:vehicleId|productId|id|car)=([A-Za-z0-9-_]+)/i);
  if (qMatch) return qMatch[1];

  // Slug terminant par chiffres
  const m = url.match(/(\d{4,})(?:\/?|$)/);
  if (m) return m[1];

  // Hash du path
  try {
    const u = new URL(url);
    const slug = u.pathname.split("/").filter(Boolean).pop();
    if (slug && slug.length > 3) return slug.slice(0, 64);
  } catch { /* invalid url */ }
  return null;
}

function deriveYearFromUrl(url: string): number | null {
  const m = url.match(/(\d{4})/);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1990 && y <= 2030 ? y : null;
}

const COMMON_BRANDS = ["renault","peugeot","citroen","ds","dacia","audi","bmw","mercedes","volkswagen","seat","skoda","ford","opel","fiat","alfa-romeo","jeep","toyota","honda","mazda","mini","nissan","tesla","kia","hyundai","mg","cupra","polestar","porsche","jaguar","volvo","lexus","subaru","suzuki","smart","abarth","mitsubishi","ferrari","lamborghini","maserati","bentley"];

function guessBrandFromUrl(url: string): string | null {
  const lower = url.toLowerCase();
  for (const b of COMMON_BRANDS) {
    if (lower.includes(`/${b}/`) || lower.includes(`/${b}-`)) {
      return b.charAt(0).toUpperCase() + b.slice(1);
    }
  }
  return null;
}

function guessModelFromUrl(url: string): string | null {
  const parts = url.toLowerCase().replace(/\?.*$/, "").split("/").filter(Boolean);
  for (let i = 0; i < parts.length - 1; i++) {
    if (COMMON_BRANDS.includes(parts[i]) && parts[i + 1]) {
      const m = parts[i + 1].replace(/-/g, " ");
      return m.charAt(0).toUpperCase() + m.slice(1);
    }
  }
  return null;
}

function guessModelFromName(name: string | undefined, brand: string): string | null {
  if (!name) return null;
  const norm = name.trim();
  const re = new RegExp(`^${brand}\\s+(\\S+)`, "i");
  const m = norm.match(re);
  return m ? m[1] : norm.split(/\s+/)[0] ?? null;
}

export function createCustomScraper(source: CustomSource): Scraper {
  const adapter = buildUniversalAdapter(source.id);
  return createJsonLdDealerScraper({
    name: source.id,
    sitemapUrl: source.sitemap_url,
    productUrlPattern: safeRegex(source.product_url_pattern) ?? /./,
    crawlDelayMs: source.crawl_delay_ms,
    batchSize: source.batch_size,
    adapter,
  });
}

// Probe utility used by /api/sources/test before saving a source.
// Visits the sitemap, samples N URLs, fetches them, returns what we found.
export async function probeSitemap(args: {
  sitemap_url: string;
  product_url_pattern?: string;
  sample_size?: number;
}): Promise<{
  ok: boolean;
  total_urls: number;
  matched_urls: number;
  sample_urls: string[];
  parsed_sample: { url: string; brand?: string; model?: string; year?: number; price?: number }[];
  error?: string;
  suggested_pattern?: string;
}> {
  const sampleSize = Math.min(args.sample_size ?? 3, 5);
  const ua = process.env.SCRAPER_USER_AGENT ?? "VO-Radar/0.1 (+contact: sourcing@vo-radar.app)";

  try {
    const res = await fetch(args.sitemap_url, { headers: { "user-agent": ua } });
    if (!res.ok) return { ok: false, total_urls: 0, matched_urls: 0, sample_urls: [], parsed_sample: [], error: `HTTP ${res.status} sur le sitemap` };
    const xml = await res.text();
    const isIndex = /<sitemapindex/i.test(xml);
    let allUrls: string[] = [];

    if (isIndex) {
      const subs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]).slice(0, 3);
      for (const sub of subs) {
        try {
          const subRes = await fetch(sub, { headers: { "user-agent": ua } });
          if (!subRes.ok) continue;
          const subXml = await subRes.text();
          allUrls.push(...Array.from(subXml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]));
        } catch { /* skip sub */ }
      }
    } else {
      allUrls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
    }

    // Pattern auto-suggéré si non fourni
    const pattern = args.product_url_pattern ?? suggestPattern(allUrls);
    const re = safeRegex(pattern);
    const matched = re ? allUrls.filter((u) => re.test(u)) : allUrls;
    const sample = shuffle(matched).slice(0, sampleSize);

    // Test fetch + parse
    const parsed: { url: string; brand?: string; model?: string; year?: number; price?: number }[] = [];
    for (let i = 0; i < sample.length; i++) {
      try {
        const r = await fetch(sample[i], { headers: { "user-agent": ua } });
        if (!r.ok) { parsed.push({ url: sample[i] }); continue; }
        const html = await r.text();
        const cars = extractCarJsonLd(html);
        if (cars.length === 0) {
          parsed.push({ url: sample[i] });
        } else {
          const adapter = buildUniversalAdapter("probe");
          const raw = adapter(cars[0], sample[i]);
          parsed.push({
            url: sample[i],
            brand: raw?.brand,
            model: raw?.model,
            year: raw?.year,
            price: raw?.price_eur,
          });
        }
      } catch { parsed.push({ url: sample[i] }); }
      if (i < sample.length - 1) await sleep(1500);
    }

    return {
      ok: true,
      total_urls: allUrls.length,
      matched_urls: matched.length,
      sample_urls: sample,
      parsed_sample: parsed,
      suggested_pattern: args.product_url_pattern ? undefined : pattern,
    };
  } catch (e) {
    return {
      ok: false, total_urls: 0, matched_urls: 0, sample_urls: [], parsed_sample: [],
      error: e instanceof Error ? e.message : "Erreur inconnue",
    };
  }
}

function safeRegex(pattern: string): RegExp | null {
  try { return new RegExp(pattern, "i"); } catch { return null; }
}

// Auto-suggest a pattern from observed URLs: find common path prefix
function suggestPattern(urls: string[]): string {
  if (urls.length === 0) return ".*";
  // Pattern simple : trouver les URLs qui contiennent un id numérique > 3 chiffres
  const withIds = urls.filter((u) => /\d{4,}/.test(u));
  if (withIds.length > urls.length * 0.4) {
    // La plupart ont un id : on suggère un pattern qui exige ça
    return "\\d{4,}";
  }
  return ".*";
}
