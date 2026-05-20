import type { RawListing } from "./types";
import { createJsonLdDealerScraper, type JsonLdCar, strField, numField, yearFromDate, mapFuel, mapGearbox } from "./json-ld-dealer";

// bymycar.fr — réseau de concessions multi-marques FR.
// Sitemap : https://www.bymycar.fr/sitemap.xml → sitemap_vehicles.xml
// JSON-LD : Product+Car node dans un @graph
// robots.txt : pas de Crawl-delay explicite mais on reste poli (5s).

interface BymycarOffer {
  price?: string | number;
  itemCondition?: string;
  priceCurrency?: string;
}

interface BymycarCar extends JsonLdCar {
  "@id"?: string;
  name?: string;
  brand?: { name?: string } | string;
  model?: string;
  mileageFromOdometer?: { value?: string | number };
  dateVehicleFirstRegistered?: string;
  productionDate?: string;
  fuelType?: string;
  vehicleTransmission?: string | { name?: string };
  vehicleEngine?: {
    additionalProperty?: { name?: string; value?: string }[];
    enginePower?: { value?: string | number };
  };
  vehicleConfiguration?: string;
  color?: string;
  image?: string[] | string;
  offers?: BymycarOffer;
}

function adapter(node: JsonLdCar, url: string): RawListing | null {
  const car = node as BymycarCar;
  const price = numField(car.offers?.price);
  if (!price || price <= 0) return null;

  // Skip new cars — concession ne source pas du neuf
  const condition = (car.offers?.itemCondition ?? "").toLowerCase();
  if (condition.includes("new")) return null;

  // Source_id depuis l'URL (le slug se termine par un id numérique)
  const idMatch = url.match(/-(\d{6,})(?:\/?|\?|$)/);
  const sourceId = idMatch ? idMatch[1] : url.split("/").pop()!.split("?")[0];
  if (!sourceId) return null;

  const brand = strField(car.brand) ?? "Inconnu";
  const model = car.model ?? "Inconnu";
  const version = car.vehicleConfiguration ?? car.name ?? null;
  const mileage = numField(car.mileageFromOdometer) ?? 0;
  const fuel = mapFuel(car.fuelType ?? null);
  const trans = strField(car.vehicleTransmission);
  const gearbox = mapGearbox(trans);
  const year = yearFromDate(car.dateVehicleFirstRegistered) ?? yearFromDate(car.productionDate) ?? deriveYearFromUrl(url) ?? new Date().getFullYear();

  // Power : essaie additionalProperty "Puissance DIN" en ch
  let power: number | null = null;
  const props = car.vehicleEngine?.additionalProperty ?? [];
  for (const p of props) {
    if (p.name && /Puissance/i.test(p.name) && p.value) {
      const m = String(p.value).match(/(\d+)/);
      if (m) {
        const n = Number(m[1]);
        if (n > 30 && n < 1500) { power = n; break; }
      }
    }
  }
  if (!power && car.vehicleEngine?.enginePower) {
    const kw = numField(car.vehicleEngine.enginePower);
    if (kw && kw > 30) power = Math.round(kw * 1.36);
  }

  // Engine designation : on construit depuis le nom du véhicule et la puissance
  const engineDesignation = inferEngineDesignation(version, power);

  return {
    id: `bymycar-${sourceId}`,
    source: "bymycar",
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
    photos_count: car.image ? (Array.isArray(car.image) ? car.image.length : 1) : 0,
    posted_at: new Date().toISOString(),
  };
}

function deriveYearFromUrl(url: string): number | null {
  const m = url.match(/occasion-(\d{4})/);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1990 && y <= 2030 ? y : null;
}

function inferEngineDesignation(version: string | null, power: number | null): string | null {
  if (!version && !power) return null;
  // Concat version + "X ch" si la version ne contient pas déjà la puissance
  if (version && power && !/(\d+)\s*ch/i.test(version)) {
    return `${version} ${power} ch`;
  }
  return version || (power ? `${power} ch` : null);
}

export const bymycarScraper = createJsonLdDealerScraper({
  name: "bymycar",
  sitemapUrl: "https://www.bymycar.fr/sitemaps/sitemap_vehicles.xml",
  productUrlPattern: /^https:\/\/www\.bymycar\.fr\/[a-z0-9-]+-\d{6,}$/i,
  crawlDelayMs: Number(process.env.BYMYCAR_CRAWL_DELAY_MS ?? 5500),
  batchSize: 50,
  followSitemapIndex: false,
  adapter,
});
