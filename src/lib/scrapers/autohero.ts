import type { Scraper, RawListing } from "./types";
import { sleep } from "./json-ld-dealer";

// AutoHero France — ex-leasing cars, ~3500 annonces, no anti-bot
// URL: https://www.autohero.com/fr/search/?sort=PRICE_ASC&page=N
// Stratégie : pagination HTML → regex extraction par carte
//
// Env vars :
//   AUTOHERO_PAGES      — pages max à scraper (défaut 5, ~20 annonces/page)
//   AUTOHERO_DELAY_MS   — délai entre pages (défaut 1000ms)

const BASE = "https://www.autohero.com";
const PAGES = Number(process.env.AUTOHERO_PAGES ?? 5);
const DELAY = Number(process.env.AUTOHERO_DELAY_MS ?? 1000);
const UA = process.env.SCRAPER_USER_AGENT ?? "Mozilla/5.0 (compatible; VO-Radar/0.1)";

function num(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Extrait brand + model depuis le slug "/fr/renault-clio/id/UUID/"
function parseBrandModel(slug: string): { brand: string; model: string } | null {
  // slug format: "renault-clio" ou "peugeot-3008" ou "mercedes-benz-classe-c"
  const brands = [
    "mercedes-benz", "alfa-romeo", "land-rover", "aston-martin",
    "rolls-royce", "range-rover",
    "renault", "peugeot", "citroen", "volkswagen", "opel", "ford",
    "toyota", "honda", "nissan", "hyundai", "kia", "mazda", "mitsubishi",
    "bmw", "audi", "mercedes", "porsche", "volvo", "skoda", "seat", "cupra",
    "dacia", "fiat", "alfa", "lancia", "jeep", "dodge", "chevrolet",
    "tesla", "mini", "smart", "suzuki", "subaru", "infiniti", "lexus",
    "maserati", "ferrari", "lamborghini", "bentley",
  ];

  for (const brand of brands) {
    if (slug.startsWith(brand + "-")) {
      const model = slug.slice(brand.length + 1);
      return { brand: capitalize(brand), model: model.replace(/-/g, " ") };
    }
    if (slug === brand) {
      return { brand: capitalize(brand), model: brand };
    }
  }

  // fallback: premier mot = brand, reste = model
  const parts = slug.split("-");
  if (parts.length >= 2) {
    return {
      brand: capitalize(parts[0]),
      model: parts.slice(1).join(" "),
    };
  }
  return null;
}

function mapFuel(raw: string): RawListing["fuel"] {
  const s = raw.toLowerCase();
  if (/électrique|electric/.test(s)) return "electrique";
  if (/hybride|hybrid/.test(s)) return "hybride";
  if (/diesel/.test(s)) return "diesel";
  if (/gpl|lpg/.test(s)) return "gpl";
  return "essence";
}

function mapGearbox(raw: string): RawListing["gearbox"] {
  const s = raw.toLowerCase();
  if (/auto|dct|cvt|tiptronic/.test(s)) return "automatique";
  return "manuelle";
}

interface CardData {
  uuid: string;
  slug: string;
  title: string;
  version: string | null;
  priceRaw: string | null;
  yearRaw: string | null;
  mileageRaw: string | null;
  fuelRaw: string | null;
  gearboxRaw: string | null;
  powerRaw: string | null;
  imageUrl: string | null;
}

function extractCards(html: string): CardData[] {
  const cards: CardData[] = [];
  const seen = new Set<string>();

  // Pass 1 — find all card anchor positions: href="/fr/SLUG/id/UUID/"
  const hrefRe = /href="\/fr\/([\w-]+)\/id\/([\w-]{36})\/"/g;
  const anchors: Array<{ idx: number; slug: string; uuid: string }> = [];
  let hm: RegExpExecArray | null;
  while ((hm = hrefRe.exec(html)) !== null) {
    if (!seen.has(hm[2])) {
      seen.add(hm[2]);
      anchors.push({ idx: hm.index, slug: hm[1], uuid: hm[2] });
    }
  }

  // Pass 2 — for each anchor, slice chunk to next anchor and parse
  for (let i = 0; i < anchors.length; i++) {
    const { idx, slug, uuid } = anchors[i];
    const end = anchors[i + 1]?.idx ?? Math.min(html.length, idx + 4000);
    const chunk = html.slice(idx, end);

    // aria-label="BRAND MODEL - VERSION - PRICE €" (on the same <a> tag)
    const ariaM = chunk.match(/aria-label="([^"]+)"/);
    const ariaLabel = ariaM ? ariaM[1] : "";

    // Parse: "Citroen C1 - 1.2 PureTech Airscape Shine - 6 690 €"
    const parts = ariaLabel.split(" - ");
    const title = parts[0]?.trim() || slug.replace(/-/g, " ");
    const version = parts.length >= 3 ? parts.slice(1, -1).join(" - ").trim() : null;
    const pricePart = parts[parts.length - 1] ?? "";
    const priceRaw = /\d/.test(pricePart) ? pricePart : null;

    // Strip tags to extract bullet specs: • 2015 • Essence • 102 340 km
    const text = chunk.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    const yearM  = text.match(/•\s*(20[0-2]\d|199\d)\s*•/);
    const fuelM  = text.match(/•\s*(Essence|Diesel|Électrique|Hybride[\w\s]*|GPL)\s*•/i);
    const kmM    = text.match(/•\s*(\d[\d\s]*\d|\d+)\s*km/i);
    const gearM  = text.match(/\b(Manuelle|Automatique|DCT|CVT|Tiptronic)\b/i);
    const imgM   = chunk.match(/src="(https?:\/\/[^"]*img[^"]*autohero[^"]*\.(?:jpg|jpeg|webp))[^"]*"/i)
                ?? chunk.match(/src="(https?:\/\/img[^"]*\.(?:jpg|webp))[^"]*"/i);

    cards.push({
      uuid, slug, title,
      version: version || null,
      priceRaw,
      yearRaw:    yearM ? yearM[1]  : null,
      mileageRaw: kmM   ? kmM[1]   : null,
      fuelRaw:    fuelM ? fuelM[1].trim() : null,
      gearboxRaw: gearM ? gearM[1] : null,
      powerRaw:   null,
      imageUrl:   imgM  ? imgM[1]  : null,
    });
  }

  return cards;
}

function cardToRaw(card: CardData): RawListing | null {
  const price = num(card.priceRaw ?? "");
  if (!price || price < 500 || price > 300_000) return null;

  const year = num(card.yearRaw ?? "") ?? new Date().getFullYear() - 3;
  const mileage = num(card.mileageRaw ?? "") ?? 0;

  // Brand/model from aria-label title (e.g. "Citroen C1", "Renault Clio")
  // or fallback to slug parsing
  let brand: string;
  let model: string;
  const titleParts = card.title.trim().split(" ");
  if (titleParts.length >= 2) {
    brand = titleParts[0];
    model = titleParts.slice(1).join(" ");
  } else {
    const bm = parseBrandModel(card.slug);
    if (!bm) return null;
    brand = bm.brand;
    model = bm.model;
  }

  return {
    id: `autohero-${card.uuid}`,
    source: "autohero",
    source_id: card.uuid,
    url: `${BASE}/fr/${card.slug}/id/${card.uuid}/`,
    title: card.title,
    brand,
    model,
    version: card.version,
    engine_designation: null,
    body_type: "inconnu",
    vehicle_type: "car",
    moto_type: null,
    cylindree_cc: null,
    year: Math.round(year),
    mileage_km: Math.round(Math.max(0, mileage)),
    fuel: mapFuel(card.fuelRaw ?? "essence"),
    gearbox: mapGearbox(card.gearboxRaw ?? ""),
    power_hp: num(card.powerRaw ?? ""),
    price_eur: Math.round(price),
    seller_kind: "pro", // AutoHero est toujours pro (revendeur)
    postal_code: null,
    region: null,
    photos_count: card.imageUrl ? 1 : 0,
    photo_url: card.imageUrl,
    photos_json: card.imageUrl ? JSON.stringify([card.imageUrl]) : null,
    posted_at: new Date().toISOString(),
  };
}

async function fetchPage(page: number): Promise<RawListing[]> {
  const url = `${BASE}/fr/search/?sort=PRICE_ASC&page=${page}`;
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "fr-FR,fr;q=0.9",
      },
    });
    if (!res.ok) {
      console.warn(`[autohero] page ${page}: HTTP ${res.status}`);
      return [];
    }
    html = await res.text();
  } catch (e) {
    console.warn(`[autohero] page ${page}:`, (e as Error).message);
    return [];
  }

  const cards = extractCards(html);
  return cards
    .map(cardToRaw)
    .filter((l): l is RawListing => l !== null);
}

export const autoheroScraper: Scraper = {
  name: "autohero",
  async fetch({ limit } = {}): Promise<RawListing[]> {
    const batchSize = Math.min(limit ?? 100, 300);
    const out: RawListing[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= PAGES; page++) {
      if (out.length >= batchSize) break;
      const listings = await fetchPage(page);
      if (listings.length === 0) break;

      for (const l of listings) {
        if (!seen.has(l.source_id)) {
          seen.add(l.source_id);
          out.push(l);
        }
      }

      if (page < PAGES) await sleep(DELAY);
    }

    console.log(`[autohero] Fetched ${out.length} listings`);
    return out;
  },
};
