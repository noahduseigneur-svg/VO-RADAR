import type { Scraper, RawListing } from "./types";
import { sleep, mapFuel, mapGearbox, shuffle } from "./json-ld-dealer";

// Mobile.de — 1er portail VO d'Allemagne (~7M annonces, pros + particuliers).
// Stratégie : GET /fahrzeuge/search.html?makeModelVariant1.makeId={id}&... → JSON dans HTML.
// Pas de clé API requise. Délai configurable via MOBILEDE_CRAWL_DELAY_MS.
//
// Les voitures allemandes ont souvent 10-20% de décote vs France pour le même véhicule.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const CRAWL_DELAY = Number(process.env.MOBILEDE_CRAWL_DELAY_MS ?? 2000);
const BASE = "https://suchen.mobile.de";

// IDs marques Mobile.de (stables dans leur système)
const MAKES: { makeId: string; label: string }[] = [
  { makeId: "1900",  label: "Audi" },
  { makeId: "3500",  label: "BMW" },
  { makeId: "2900",  label: "Citroen" },
  { makeId: "4600",  label: "Dacia" },
  { makeId: "5390",  label: "Fiat" },
  { makeId: "6200",  label: "Ford" },
  { makeId: "7600",  label: "Honda" },
  { makeId: "8200",  label: "Hyundai" },
  { makeId: "9000",  label: "Kia" },
  { makeId: "10200", label: "Mercedes-Benz" },
  { makeId: "11000", label: "Opel" },
  { makeId: "11200", label: "Peugeot" },
  { makeId: "11700", label: "Renault" },
  { makeId: "12400", label: "Seat" },
  { makeId: "13200", label: "Skoda" },
  { makeId: "14200", label: "Toyota" },
  { makeId: "17200", label: "Volkswagen" },
  { makeId: "16600", label: "Volvo" },
  { makeId: "9200",  label: "Mazda" },
  { makeId: "14700", label: "Suzuki" },
  { makeId: "9800",  label: "Land Rover" },
  { makeId: "10900", label: "Nissan" },
];

// Plages de prix pour cibler les véhicules budget
const PRICE_RANGES: { priceFrom?: number; priceTo?: number; label: string }[] = [
  { priceTo: 3000,                label: "budget-3k" },
  { priceFrom: 3000, priceTo: 8000,  label: "3k-8k" },
  { priceFrom: 8000, priceTo: 20000, label: "8k-20k" },
  { priceFrom: 20000,              label: "premium" },
];

type MobileItem = Record<string, unknown>;

function dig(o: unknown, ...keys: string[]): unknown {
  let cur: unknown = o;
  for (const k of keys) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function extractItems(data: unknown): MobileItem[] {
  const candidates: unknown[] = [
    dig(data, "props", "pageProps", "searchResult", "items"),
    dig(data, "props", "pageProps", "searchResult", "ads"),
    dig(data, "props", "pageProps", "ads"),
    dig(data, "props", "pageProps", "vehicles"),
    dig(data, "props", "pageProps", "listings"),
    dig(data, "srp", "listItems"),
    dig(data, "srp", "ads"),
    dig(data, "searchResult", "items"),
    dig(data, "searchResult", "ads"),
    dig(data, "listItems"),
    dig(data, "ads"),
    dig(data, "items"),
    dig(data, "results"),
  ];
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length > 0) return arr as MobileItem[];
  }

  // Fallback : chercher le premier tableau d'objets avec un "id" dans pageProps
  const pp = dig(data, "props", "pageProps");
  if (pp && typeof pp === "object") {
    for (const val of Object.values(pp as Record<string, unknown>)) {
      if (Array.isArray(val) && val.length > 0) {
        const first = val[0] as Record<string, unknown>;
        if (first.id ?? first.adId ?? first.itemId) return val as MobileItem[];
      }
    }
  }
  return [];
}

function strVal(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    return strVal(o.label ?? o.name ?? o.value ?? o.text);
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

function parseItem(item: MobileItem, fallbackBrand: string): RawListing | null {
  const id = strVal(item.id ?? item.itemId ?? item.adId ?? item.vehicleId);
  if (!id) return null;

  // Prix — plusieurs structures possibles
  let price = 0;
  const p = item.price ?? item.prices ?? item.priceInfo;
  if (typeof p === "number") price = p;
  else if (typeof p === "object" && p !== null) {
    const po = p as Record<string, unknown>;
    price = numVal(po.value ?? po.amount ?? po.grossPrice ?? po.EUR ?? po.consumerPriceAmount) ?? 0;
  } else if (typeof p === "string") price = numVal(p) ?? 0;
  if (!price || price < 100 || price > 500_000) return null;

  // Données véhicule
  const veh = (item.vehicle ?? item.attributes ?? item) as Record<string, unknown>;
  const brand =
    strVal(veh.make ?? veh.brand ?? veh.makeLabel ?? item.make ?? item.brand) ?? fallbackBrand;
  const model = strVal(veh.model ?? veh.modelLabel ?? veh.modell ?? item.model) ?? "";
  if (!brand || !model) return null;

  const version = strVal(veh.version ?? veh.variant ?? veh.versionLabel ?? item.version) ?? null;

  // Année d'immatriculation
  let year = 0;
  const regRaw = veh.firstRegistration ?? veh.registrationDate ?? veh.year ?? item.year;
  if (typeof regRaw === "string") year = Number(regRaw.slice(0, 4)) || 0;
  else year = numVal(regRaw) ?? 0;
  if (!year || year < 1990) return null;

  const mileage = numVal(veh.mileage ?? veh.kilometer ?? veh.km ?? item.mileage) ?? 0;

  const fuel = mapFuel(strVal(veh.fuel ?? veh.fuelType ?? veh.kraftstoff ?? item.fuel));
  const gearbox = mapGearbox(strVal(veh.gearbox ?? veh.transmission ?? veh.getriebe ?? item.gearbox));

  // Puissance — Mobile.de stocke souvent en PS (chevaux allemands ≈ ch)
  const powerRaw = numVal(veh.power ?? veh.ps ?? veh.horsePower ?? veh.kw ?? item.power);
  // Si stocké en kW, on convertit en ch (× 1.36)
  const isKw = String(veh.powerUnit ?? "").toLowerCase().includes("kw");
  const power_hp = powerRaw ? Math.round(isKw ? powerRaw * 1.36 : powerRaw) : null;

  // Localisation
  const loc = (item.location ?? (item.seller as Record<string, unknown>)?.location ?? {}) as Record<string, unknown>;
  const postalCode = strVal(loc.zipCode ?? loc.zip ?? loc.postCode) ?? null;
  const city = strVal(loc.city ?? loc.place ?? loc.ort) ?? null;
  const region = city ? city : "Allemagne";

  // Vendeur
  const sel = (item.seller ?? {}) as Record<string, unknown>;
  const sellerTypeRaw = strVal(sel.type ?? sel.sellerType ?? item.sellerType) ?? "";
  const isPrivate =
    sellerTypeRaw.toUpperCase() === "PRIVATE" ||
    sellerTypeRaw.toUpperCase() === "INDIVIDUAL" ||
    sellerTypeRaw.toUpperCase() === "PARTICULIER";
  const sellerKind: "pro" | "particulier" = isPrivate ? "particulier" : "pro";

  // URL & photos
  const relUrl = strVal(item.url ?? item.adUrl ?? item.link) ?? "";
  const fullUrl = relUrl.startsWith("http")
    ? relUrl
    : relUrl
    ? `https://www.mobile.de${relUrl}`
    : `https://www.mobile.de/fahrzeuge/details.html?id=${id}`;

  const imgs = item.images ?? item.photos ?? item.thumbnails ?? [];
  const photosCount = Array.isArray(imgs) ? imgs.length : 0;

  return {
    id: `mobilede-${id}`,
    source: "mobilede",
    source_id: id,
    url: fullUrl,
    title: `${brand} ${model}${version ? ` ${version}` : ""}`,
    brand,
    model,
    version,
    engine_designation: null,
    body_type: "inconnu",
    year,
    mileage_km: Math.max(0, Math.round(mileage)),
    fuel,
    gearbox,
    power_hp,
    price_eur: Math.round(price),
    seller_kind: sellerKind,
    postal_code: postalCode,
    region,
    photos_count: photosCount,
    posted_at: new Date().toISOString(),
  };
}

async function fetchSearchPage(
  makeId: string,
  makeLabel: string,
  priceFrom?: number,
  priceTo?: number,
): Promise<RawListing[]> {
  const params: Record<string, string> = {
    isSearchRequest: "true",
    categories: "Pkw",
    "makeModelVariant1.makeId": makeId,
    dam: "false",
    ref: "srpHead",
  };
  if (priceFrom) params.priceFrom = String(priceFrom);
  if (priceTo) params.priceTo = String(priceTo);

  const url = `${BASE}/fahrzeuge/search.html?${new URLSearchParams(params)}`;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "de-DE,de;q=0.9,fr;q=0.8",
        referer: "https://www.mobile.de/",
      },
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  // Tentatives d'extraction JSON dans l'ordre de probabilité
  const patterns: RegExp[] = [
    // Next.js (si migration récente)
    /<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/,
    // État serveur habituel Mobile.de
    /window\.__SERVER_INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*(?:<\/script>|window\.)/,
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*(?:<\/script>|window\.)/,
    /window\["cache"\]\s*=\s*(\{[\s\S]*?\})\s*;?\s*(?:<\/script>|window\.)/,
    // Balise JSON générique
    /<script[^>]+id="__srp_data__"[^>]*>([\s\S]*?)<\/script>/,
    /<script[^>]+id="__server-side-props__"[^>]*>([\s\S]*?)<\/script>/,
    /<script[^>]+type="application\/json"[^>]*>([\s\S]*?)<\/script>/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    let data: unknown;
    try {
      data = JSON.parse(match[1]);
    } catch {
      continue;
    }
    const items = extractItems(data);
    if (items.length > 0) {
      return items
        .map((item) => parseItem(item, makeLabel))
        .filter((l): l is RawListing => l !== null);
    }
  }

  return [];
}

export const mobiledeScraper: Scraper = {
  name: "mobilede",
  async fetch({ limit } = {}): Promise<RawListing[]> {
    const batchSize = Math.min(limit ?? 400, 1200);
    const out: RawListing[] = [];
    const seen = new Set<string>();

    // Mélanger marques × tranches de prix pour une bonne rotation
    type Target = { makeId: string; label: string; priceFrom?: number; priceTo?: number };
    const targets: Target[] = [];
    for (const { makeId, label } of shuffle(MAKES)) {
      for (const range of shuffle(PRICE_RANGES)) {
        targets.push({ makeId, label, priceFrom: range.priceFrom, priceTo: range.priceTo });
      }
    }

    for (const { makeId, label, priceFrom, priceTo } of targets) {
      if (out.length >= batchSize) break;
      try {
        const listings = await fetchSearchPage(makeId, label, priceFrom, priceTo);
        for (const l of listings) {
          if (!seen.has(l.source_id)) {
            seen.add(l.source_id);
            out.push(l);
          }
        }
        if (listings.length > 0) {
          const range = priceTo ? `<${priceTo}€` : priceFrom ? `>${priceFrom}€` : "tous prix";
          console.log(`[mobilede] ${label} (${range}): +${listings.length} (total ${out.length})`);
        }
      } catch (e) {
        console.warn(`[mobilede] ${label}:`, (e as Error).message);
      }
      await sleep(CRAWL_DELAY);
    }

    console.log(`[mobilede] Fetched ${out.length} listings`);
    return out;
  },
};
