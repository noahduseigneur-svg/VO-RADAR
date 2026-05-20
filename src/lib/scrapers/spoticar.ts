import type { RawListing } from "./types";
import { createJsonLdDealerScraper, type JsonLdCar, strField, numField, yearFromDate, mapFuel, mapGearbox } from "./json-ld-dealer";

// Spoticar — réseau certifié PSA (Peugeot, Citroën, DS, Opel, Fiat, Alfa).
// ~30 000 véhicules d'occasion certifiés sur le réseau France.
// JSON-LD schema.org/Car rendu côté serveur.

interface SpoticarCar extends JsonLdCar {
  name?: string;
  sku?: string;
  url?: string;
  brand?: string | { name?: string };
  model?: string | { name?: string };
  description?: string;
  vehicleConfiguration?: string;
  dateVehicleFirstRegistered?: string;
  productionDate?: string;
  fuelType?: string;
  mileageFromOdometer?: { value?: string | number; unitCode?: string };
  vehicleTransmission?: string | { name?: string };
  vehicleEngine?: { name?: string; enginePower?: { value?: string | number } };
  offers?: { price?: string | number; priceCurrency?: string };
  image?: string | string[];
  bodyType?: string;
}

function brandFromName(name: string): string {
  const brands = ["Peugeot", "Citroën", "Citroen", "DS", "Opel", "Alfa Romeo", "Fiat", "Jeep", "Abarth"];
  for (const b of brands) {
    if (name.toUpperCase().includes(b.toUpperCase())) return b;
  }
  return name.split(" ")[0] ?? "Inconnu";
}

function modelFromName(name: string, brand: string): string {
  return name.replace(new RegExp(brand, "i"), "").trim().split(" ").slice(0, 2).join(" ") || "Inconnu";
}

function extractPower(engine: SpoticarCar["vehicleEngine"] | undefined): number | null {
  if (!engine) return null;
  const raw = strField(engine.name) ?? "";
  const m = raw.match(/(\d{2,3})\s*(?:ch|cv|hp|kw)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 30 && n < 1500 ? n : null;
}

function adapter(node: JsonLdCar, url: string): RawListing | null {
  const car = node as SpoticarCar;

  const price = numField(car.offers?.price);
  if (!price || price <= 0) return null;

  const sku = car.sku ?? car["@id"] ?? url.split("/").pop();
  if (!sku) return null;

  const rawName = car.name ?? "";
  const brand = strField(car.brand) ?? brandFromName(rawName);
  const model = strField(car.model) ?? modelFromName(rawName, brand);
  const version = car.vehicleConfiguration ?? null;
  const engineDesignation = car.vehicleEngine?.name ?? null;
  const mileage = numField(car.mileageFromOdometer) ?? 0;
  const fuel = mapFuel(car.fuelType ?? null);
  const gearbox = mapGearbox(strField(car.vehicleTransmission));
  const year = yearFromDate(car.dateVehicleFirstRegistered ?? car.productionDate) ?? new Date().getFullYear();
  const power = extractPower(car.vehicleEngine);

  return {
    id: `spoticar-${String(sku)}`,
    source: "spoticar",
    source_id: String(sku),
    url,
    title: `${brand} ${model}${version ? ` ${version}` : ""}`,
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
    photos_count: car.image ? (Array.isArray(car.image) ? car.image.length : 1) : 0,
    posted_at: new Date().toISOString(),
  };
}

export const spoticarScraper = createJsonLdDealerScraper({
  name: "spoticar",
  sitemapUrl: "https://www.spoticar.fr/sitemap.xml",
  productUrlPattern: /\/vehicule(?:s)?\/|\/annonce(?:s)?\/|\/occasion\//i,
  crawlDelayMs: Number(process.env.SPOTICAR_CRAWL_DELAY_MS ?? 4500),
  batchSize: 40,
  followSitemapIndex: true,
  adapter,
});
