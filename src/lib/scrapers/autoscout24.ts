import type { Scraper, RawListing } from "./types";
import { sleep, mapFuel, mapGearbox } from "./json-ld-dealer";

// AutoScout24.fr — ~2M annonces européennes.
// Stratégie : recherches /lst/{make}/{model}?fregfrom=YYYY&fregto=YYYY → __NEXT_DATA__.
// On cible par année pour avoir l'info year directement, sans fetch individuel.
// robots.txt : Crawl-delay implicite → on respecte AS24_CRAWL_DELAY_MS.

const UA = process.env.SCRAPER_USER_AGENT ?? "Mozilla/5.0 (compatible; VO-Radar/0.1)";
const CRAWL_DELAY = Number(process.env.AS24_CRAWL_DELAY_MS ?? 3500);
const BASE = "https://www.autoscout24.fr";

// Top makes/models France
const MAKES_MODELS: { make: string; model: string }[] = [
  { make: "renault", model: "clio" },
  { make: "renault", model: "megane" },
  { make: "renault", model: "captur" },
  { make: "renault", model: "kadjar" },
  { make: "peugeot", model: "208" },
  { make: "peugeot", model: "2008" },
  { make: "peugeot", model: "308" },
  { make: "peugeot", model: "3008" },
  { make: "volkswagen", model: "golf" },
  { make: "volkswagen", model: "polo" },
  { make: "volkswagen", model: "tiguan" },
  { make: "dacia", model: "sandero" },
  { make: "dacia", model: "duster" },
  { make: "citroen", model: "c3" },
  { make: "citroen", model: "berlingo" },
  { make: "toyota", model: "yaris" },
  { make: "bmw", model: "serie-1" },
  { make: "bmw", model: "serie-3" },
  { make: "bmw", model: "x3" },
  { make: "mercedes-benz", model: "classe-a" },
  { make: "mercedes-benz", model: "classe-c" },
  { make: "audi", model: "a3" },
  { make: "audi", model: "q3" },
  { make: "ford", model: "focus" },
  { make: "opel", model: "corsa" },
  { make: "seat", model: "ibiza" },
  { make: "seat", model: "leon" },
  { make: "skoda", model: "octavia" },
  { make: "nissan", model: "qashqai" },
  { make: "hyundai", model: "tucson" },
  { make: "kia", model: "sportage" },
  { make: "mercedes-benz", model: "vito" },
];

// Years to target — recent years only for relevance
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Parse formatted price "€ 11 988" or "11.988" → number
function parseFormattedPrice(raw: unknown): number {
  if (!raw || typeof raw !== "string") return 0;
  const digits = raw.replace(/[^\d]/g, "");
  return Number(digits) || 0;
}

// Parse formatted mileage "99 890 km" → number
function parseFormattedKm(raw: unknown): number {
  if (!raw || typeof raw !== "string") return 0;
  const digits = raw.replace(/[^\d]/g, "");
  return Number(digits) || 0;
}

// Extract power from version string — handles "TCe 90", "1.6 TDI 110 CV", etc.
function extractPowerFromVersion(version: string | null): number | null {
  if (!version) return null;
  // Explicit unit: "110 ch" / "110cv" / "110hp"
  const withUnit = version.match(/\b(\d{2,3})\s*(?:ch|cv|hp|kw|pk)\b/i);
  if (withUnit) {
    const n = Number(withUnit[1]);
    if (n >= 50 && n <= 600) return n;
  }
  // After engine code: "TCe 90", "TDI 110", "HDi 120", "SCe 75", "e-POWER 143"
  const afterCode = version.match(/(?:TCe|TDCi|TDI|HDi|dCi|SCe|BlueHDi|TFSI|TSI|THP|VTi|EcoBoost|e-POWER|mHEV|eTurbo|PureTech)\s+(\d{2,3})\b/i);
  if (afterCode) {
    const n = Number(afterCode[1]);
    if (n >= 50 && n <= 600) return n;
  }
  return null;
}

async function fetchSearchPage(make: string, model: string, year: number): Promise<RawListing[]> {
  const url = `${BASE}/lst/${make}/${model}?sort=standard&desc=0&ustate=U&size=20&page=1&cy=F&atype=C&fregfrom=${year}&fregto=${year}`;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        "accept": "text/html,application/xhtml+xml",
        "accept-language": "fr-FR,fr;q=0.9",
      },
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  const match = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return [];

  let data: unknown;
  try { data = JSON.parse(match[1]); } catch { return []; }

  const listings = (data as Record<string, unknown>)?.["props"] as Record<string, unknown>;
  const pageProps = (listings?.["pageProps"] as Record<string, unknown>);
  const rawListings = pageProps?.["listings"];
  if (!Array.isArray(rawListings)) return [];

  return rawListings
    .map((raw: unknown) => parseAs24Listing(raw as Record<string, unknown>, make, model, year))
    .filter((l): l is RawListing => l !== null);
}

function parseAs24Listing(
  raw: Record<string, unknown>,
  fallbackMake: string,
  fallbackModel: string,
  year: number,
): RawListing | null {
  const id = String(raw.id ?? raw.crossReferenceId ?? "");
  if (!id) return null;

  const vehicle = (raw.vehicle ?? {}) as Record<string, unknown>;
  const priceObj = (raw.price ?? {}) as Record<string, unknown>;
  const location = (raw.location ?? {}) as Record<string, unknown>;
  const seller = (raw.seller ?? {}) as Record<string, unknown>;

  // Price from formatted string
  const price = parseFormattedPrice(
    priceObj.priceFormatted ?? priceObj.price ?? priceObj.priceRaw,
  );
  if (!price || price < 500 || price > 500_000) return null;

  const brand = String(vehicle.make ?? fallbackMake);
  const model = String(vehicle.model ?? fallbackModel);
  const version = (vehicle.modelVersionInput as string) ?? null;
  const fuel = mapFuel(String(vehicle.fuel ?? ""));
  const gearbox = mapGearbox(String(vehicle.transmission ?? ""));
  const mileage = parseFormattedKm(vehicle.mileageInKm);
  const power = extractPowerFromVersion(version);
  const photosCount = Array.isArray(raw.images) ? raw.images.length : 0;

  const postalCode = (location.zip as string) ?? null;
  const region = (location.city as string) ?? null;

  const sellerType = (seller.type as string) ?? "dealer";
  const sellerKind: "pro" | "particulier" = sellerType === "private" ? "particulier" : "pro";

  const relUrl = raw.url as string | undefined;
  const fullUrl = relUrl
    ? (relUrl.startsWith("http") ? relUrl : `${BASE}${relUrl}`)
    : `${BASE}/annonces/${id}`;

  return {
    id: `as24-${id}`,
    source: "autoscout24",
    source_id: id,
    url: fullUrl,
    title: `${brand} ${model}${version ? ` ${version}` : ""}`,
    brand,
    model,
    version,
    engine_designation: null,
    body_type: "inconnu",
    year,
    mileage_km: Math.max(0, mileage),
    fuel,
    gearbox,
    power_hp: power,
    price_eur: price,
    seller_kind: sellerKind,
    postal_code: postalCode,
    region: region,
    photos_count: photosCount,
    posted_at: new Date().toISOString(),
  };
}

export const autoscout24Scraper: Scraper = {
  name: "autoscout24",
  async fetch({ limit } = {}): Promise<RawListing[]> {
    const batchSize = Math.min(limit ?? 120, 300);
    const out: RawListing[] = [];

    // Shuffle targets: rotate through makes × years
    type Target = { make: string; model: string; year: number };
    const targets: Target[] = [];
    const shuffledModels = shuffle(MAKES_MODELS);
    const shuffledYears = shuffle(YEARS);
    for (const { make, model } of shuffledModels) {
      for (const year of shuffledYears) {
        targets.push({ make, model, year });
      }
    }

    const seen = new Set<string>();

    for (const { make, model, year } of targets) {
      if (out.length >= batchSize) break;
      try {
        const listings = await fetchSearchPage(make, model, year);
        for (const l of listings) {
          if (!seen.has(l.source_id)) {
            seen.add(l.source_id);
            out.push(l);
          }
        }
      } catch (e) {
        console.warn(`[autoscout24] ${make}/${model}/${year}:`, (e as Error).message);
      }
      await sleep(CRAWL_DELAY);
    }

    return out;
  },
};
