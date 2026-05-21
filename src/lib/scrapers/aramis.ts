import type { RawListing } from "./types";
import { createJsonLdDealerScraper, type JsonLdCar, strField, numField, yearFromDate, mapFuel, mapGearbox } from "./json-ld-dealer";

// Aramis Auto — Stellantis mandataire. JSON-LD schema.org/Car sur chaque
// page véhicule. robots.txt autorise avec Crawl-delay: 5s.

interface AramisOffers { price?: string | number; priceCurrency?: string; itemCondition?: string }
interface AramisCar extends JsonLdCar {
  sku?: string; productID?: string;
  brand?: string | { name?: string };
  model?: string | { name?: string };
  vehicleConfiguration?: string;
  dateVehicleFirstRegistered?: string;
  productionDate?: string;
  fuelType?: string;
  mileageFromOdometer?: { value?: string | number };
  vehicleTransmission?: string | { name?: string };
  vehicleEngine?: { name?: string };
  image?: string | string[];
  offers?: AramisOffers;
}

function adapter(node: JsonLdCar, url: string): RawListing | null {
  const car = node as AramisCar;
  const price = numField(car.offers?.price);
  const sku = car.sku ?? car.productID;
  if (!sku || !price || price <= 0) return null;

  const brand = strField(car.brand) ?? "Inconnu";
  const model = strField(car.model) ?? "Inconnu";
  const version = car.vehicleConfiguration ?? null;
  const engineDesignation = car.vehicleEngine?.name ?? null;
  const mileage = numField(car.mileageFromOdometer) ?? 0;
  const fuel = mapFuel(car.fuelType ?? null);
  const trans = strField(car.vehicleTransmission);
  const gearbox = mapGearbox(trans);
  const year = yearFromDate(car.dateVehicleFirstRegistered) ?? yearFromDate(car.productionDate) ?? new Date().getFullYear();

  return {
    id: `aramis-${sku}`,
    source: "aramis",
    source_id: String(sku),
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
    power_hp: extractPower(engineDesignation),
    price_eur: Math.round(price),
    seller_kind: "pro",
    postal_code: null,
    region: null,
    photos_count: car.image ? (Array.isArray(car.image) ? car.image.length : 1) : 0,
    photo_url: car.image
      ? (Array.isArray(car.image) ? (typeof car.image[0] === 'string' ? car.image[0] : null) : (typeof car.image === 'string' ? car.image : null))
      : null,
    posted_at: new Date().toISOString(),
  };
}

function extractPower(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d{2,3})\s*(?:ch|hp|kw)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 30 && n < 1500 ? n : null;
}

export const aramisScraper = createJsonLdDealerScraper({
  name: "aramis",
  sitemapUrl: "https://www.aramisauto.com/sitemap.xml",
  productUrlPattern: /\/voitures\//,
  crawlDelayMs: Number(process.env.ARAMIS_CRAWL_DELAY_MS ?? 5500),
  batchSize: 50,
  adapter,
});
