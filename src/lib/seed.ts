import type { Listing, Fuel, Gearbox, SellerKind } from "./types";
import { estimateMarketValue } from "./pricing";
import { enrichListing } from "./scoring";

const REGIONS = [
  "Île-de-France", "Auvergne-Rhône-Alpes", "Provence-Alpes-Côte d'Azur",
  "Occitanie", "Nouvelle-Aquitaine", "Hauts-de-France", "Grand Est",
  "Pays de la Loire", "Bretagne", "Normandie",
];

interface Spec {
  brand: string;
  model: string;
  versions: string[];
  power_range: [number, number];
  fuels: Fuel[];
}

const SPECS: Spec[] = [
  { brand: "Renault", model: "Clio", versions: ["Zen TCe 90", "Intens dCi 85", "RS Line TCe 130"], power_range: [70, 130], fuels: ["essence", "diesel"] },
  { brand: "Renault", model: "Captur", versions: ["Intens TCe 130", "Business dCi 95"], power_range: [90, 140], fuels: ["essence", "diesel", "hybride"] },
  { brand: "Peugeot", model: "208", versions: ["Active PureTech 75", "Allure PureTech 100", "GT BlueHDi 100"], power_range: [75, 130], fuels: ["essence", "diesel", "electrique"] },
  { brand: "Peugeot", model: "3008", versions: ["Allure 1.5 BlueHDi 130", "GT Hybrid 225"], power_range: [130, 225], fuels: ["diesel", "hybride"] },
  { brand: "Citroen", model: "C3", versions: ["Feel PureTech 83", "Shine PureTech 110"], power_range: [83, 110], fuels: ["essence"] },
  { brand: "Volkswagen", model: "Golf", versions: ["Life 1.0 TSI", "Style 1.5 eTSI", "GTI 2.0 TSI"], power_range: [110, 245], fuels: ["essence", "diesel"] },
  { brand: "Volkswagen", model: "Polo", versions: ["Life 1.0 TSI 95", "R-Line 1.0 TSI 95"], power_range: [80, 115], fuels: ["essence"] },
  { brand: "Volkswagen", model: "Tiguan", versions: ["Life 2.0 TDI 150", "Elegance 1.5 eTSI"], power_range: [130, 200], fuels: ["diesel", "essence"] },
  { brand: "BMW", model: "Serie-1", versions: ["118i M Sport", "120d xDrive"], power_range: [136, 190], fuels: ["essence", "diesel"] },
  { brand: "BMW", model: "Serie-3", versions: ["320d M Sport", "330e Touring"], power_range: [184, 292], fuels: ["diesel", "hybride"] },
  { brand: "Audi", model: "A3", versions: ["Sportback 35 TFSI S Line", "Sportback 30 TDI"], power_range: [116, 190], fuels: ["essence", "diesel"] },
  { brand: "Audi", model: "A4", versions: ["Avant 35 TDI S line", "Berline 40 TFSI"], power_range: [150, 204], fuels: ["essence", "diesel"] },
  { brand: "Mercedes", model: "Classe-A", versions: ["180d AMG Line", "200 Progressive"], power_range: [136, 190], fuels: ["essence", "diesel"] },
  { brand: "Dacia", model: "Sandero", versions: ["Stepway Comfort TCe 90", "Essential SCe 65"], power_range: [65, 110], fuels: ["essence", "gpl"] },
  { brand: "Dacia", model: "Duster", versions: ["Journey TCe 130 4x2", "Extreme Blue dCi 115"], power_range: [100, 150], fuels: ["essence", "diesel"] },
  { brand: "Toyota", model: "Yaris", versions: ["Hybride 116h Design", "Hybride 130h GR Sport"], power_range: [116, 130], fuels: ["hybride"] },
  { brand: "Tesla", model: "Model-3", versions: ["Long Range AWD", "Performance"], power_range: [283, 510], fuels: ["electrique"] },
];

// Mulberry32 — deterministic so the demo data stays stable between renders.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSeedListings(count = 80, seed = 42): Listing[] {
  const rand = mulberry32(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

  const now = Date.now();
  const listings: Listing[] = [];

  for (let i = 0; i < count; i++) {
    const spec = pick(SPECS);
    const year = randInt(2015, new Date().getFullYear() - 1);
    const age = new Date().getFullYear() - year;
    const mileage_km = Math.max(5000, age * randInt(8000, 22000) + randInt(-10000, 15000));
    const fuel = pick(spec.fuels);
    const gearbox: Gearbox = rand() > 0.55 ? "automatique" : "manuelle";
    const power_hp = randInt(spec.power_range[0], spec.power_range[1]);
    const version = pick(spec.versions);
    const seller_kind: SellerKind = rand() > 0.4 ? "particulier" : "pro";

    const market = estimateMarketValue({
      brand: spec.brand, model: spec.model, year, mileage_km, fuel, gearbox, power_hp,
    });

    // bias price around market, with occasional deep discounts (the "deals")
    const dealRoll = rand();
    let priceMult: number;
    if (dealRoll < 0.18) priceMult = 0.70 + rand() * 0.12;        // 18% are real deals
    else if (dealRoll < 0.55) priceMult = 0.92 + rand() * 0.08;   // 37% fair
    else priceMult = 1.0 + rand() * 0.15;                          // 45% overpriced

    const price_eur = Math.round(market * priceMult / 100) * 100;

    const hoursAgo = randInt(1, 72);
    const posted_at = new Date(now - hoursAgo * 36e5).toISOString();

    const base = {
      id: `seed-${i}`,
      source: "demo",
      source_id: `demo-${i}`,
      url: `https://example.com/annonce/${i}`,
      title: `${spec.brand} ${spec.model} ${version}`,
      brand: spec.brand,
      model: spec.model,
      version,
      engine_designation: version,
      body_type: "inconnu" as const,
      year,
      mileage_km,
      fuel,
      gearbox,
      power_hp,
      price_eur,
      seller_kind,
      postal_code: String(randInt(1000, 95000)).padStart(5, "0"),
      region: pick(REGIONS),
      photos_count: randInt(1, 12),
      photo_url: null,
      posted_at,
      fetched_at: new Date(now).toISOString(),
    };

    listings.push(enrichListing(base, market, "calibrated"));
  }

  return listings;
}
