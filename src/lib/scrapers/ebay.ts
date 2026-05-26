import type { Scraper, RawListing } from "./types";
import { mapFuel, mapGearbox, yearFromDate, safeYear } from "./json-ld-dealer";

// eBay Motors via l'API officielle Browse.
//   Doc : https://developer.ebay.com/api-docs/buy/browse/overview.html
//
// Setup :
//   1. Créer un compte gratuit sur https://developer.ebay.com
//   2. Récupérer App ID + Cert ID dans le portail développeur
//   3. Mettre dans env :
//        EBAY_APP_ID=xxx
//        EBAY_CERT_ID=xxx
//        EBAY_MARKETPLACE=EBAY_FR (ou EBAY_DE, EBAY_IT, EBAY_GB, EBAY_US…)
//
// Sans clés, retourne une liste vide (le pipeline continue avec les autres sources).

interface EbayItemSummary {
  itemId?: string;
  title?: string;
  itemWebUrl?: string;
  price?: { value?: string; currency?: string };
  condition?: string;
  itemLocation?: { country?: string; postalCode?: string };
  thumbnailImages?: { imageUrl?: string }[];
  itemCreationDate?: string;
  // Variantes utilisées dans les annonces auto
  itemSpecifics?: { name: string; value: string }[];
}

interface EbaySearchResp {
  itemSummaries?: EbayItemSummary[];
  total?: number;
}

const TOKEN_CACHE: { token: string; exp: number } = { token: "", exp: 0 };

async function getOAuthToken(): Promise<string | null> {
  const id = process.env.EBAY_APP_ID;
  const secret = process.env.EBAY_CERT_ID;
  if (!id || !secret) return null;

  if (TOKEN_CACHE.token && Date.now() < TOKEN_CACHE.exp - 60_000) return TOKEN_CACHE.token;

  const credentials = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });
  if (!res.ok) {
    console.warn("[ebay] token failed:", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  TOKEN_CACHE.token = data.access_token;
  TOKEN_CACHE.exp = Date.now() + (data.expires_in ?? 7200) * 1000;
  return data.access_token;
}

async function search(opts: {
  marketplace: string;
  limit: number;
  category: string;
  filter: string;
}): Promise<EbayItemSummary[]> {
  const token = await getOAuthToken();
  if (!token) return [];

  const params = new URLSearchParams({
    category_ids: opts.category,
    limit: String(opts.limit),
    filter: opts.filter,
    sort: "newlyListed",
  });
  const res = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": opts.marketplace,
      "X-EBAY-C-ENDUSERCTX": "contextualLocation=country=FR",
    },
  });
  if (!res.ok) {
    console.warn(`[ebay] search ${opts.marketplace} failed:`, res.status);
    return [];
  }
  const data = (await res.json()) as EbaySearchResp;
  return data.itemSummaries ?? [];
}

function adapt(item: EbayItemSummary, marketplace: string): RawListing | null {
  const priceRaw = item.price?.value;
  const price = priceRaw ? Number(priceRaw) : NaN;
  if (!Number.isFinite(price) || price <= 500 || price > 200_000) return null;
  if (!item.itemId || !item.title || !item.itemWebUrl) return null;

  const specs = Object.fromEntries((item.itemSpecifics ?? []).map((s) => [s.name.toLowerCase(), s.value]));

  // eBay specifics common keys: "Marque", "Modèle", "Année", "Kilométrage", "Carburant", "Boîte de vitesses"
  const brand = specs["marque"] ?? specs["brand"] ?? guessBrandFromTitle(item.title) ?? "Inconnu";
  const model = specs["modèle"] ?? specs["model"] ?? guessModelFromTitle(item.title, brand) ?? "Inconnu";
  const yearStr = specs["année"] ?? specs["year"] ?? specs["année-modèle"];
  // Ne jamais utiliser itemCreationDate comme année véhicule — c'est la date de mise en ligne
  const yearParsed = yearStr ? Number(String(yearStr).match(/\d{4}/)?.[0]) : null;
  const year = safeYear(yearParsed) ?? 2015;
  const mileage = parseKm(specs["kilométrage"] ?? specs["mileage"] ?? "0");
  const fuel = mapFuel(specs["carburant"] ?? specs["fuel"] ?? specs["fuel type"] ?? null);
  const gearbox = mapGearbox(specs["boîte de vitesses"] ?? specs["transmission"] ?? null);
  const power = parsePower(specs["puissance"] ?? specs["power"] ?? "");

  return {
    id: `ebay-${item.itemId}`,
    source: `ebay-${marketplace.replace("EBAY_", "").toLowerCase()}`,
    source_id: item.itemId,
    url: item.itemWebUrl,
    title: item.title,
    brand,
    model,
    version: null,
    engine_designation: specs["motorisation"] ?? specs["engine"] ?? null,
    body_type: "inconnu",
    year,
    mileage_km: mileage,
    fuel,
    gearbox,
    power_hp: power,
    price_eur: Math.round(price),
    seller_kind: item.condition?.toLowerCase().includes("used") ? "particulier" : "pro",
    postal_code: item.itemLocation?.postalCode ?? null,
    region: item.itemLocation?.country ?? null,
    photos_count: item.thumbnailImages?.length ?? 0,
    photo_url: item.thumbnailImages?.[0]?.imageUrl ?? null,
    posted_at: item.itemCreationDate ?? new Date().toISOString(),
  };
}

function parseKm(s: string): number {
  const m = String(s).replace(/[\s,.]/g, "").match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function parsePower(s: string): number | null {
  const m = s.match(/(\d{2,4})\s*(ch|hp|kw)/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (/kw/i.test(m[2])) return Math.round(n * 1.36);
  return n > 30 && n < 1500 ? n : null;
}

// Heuristiques basiques pour les titres "Renault Clio 1.5 dCi..."
const BRANDS = ["renault","peugeot","citroen","citroën","ds","dacia","audi","bmw","mercedes","volkswagen","vw","seat","skoda","ford","opel","fiat","alfa","alfa-romeo","jeep","toyota","honda","mazda","mini","nissan","tesla","kia","hyundai","mg","cupra","polestar","porsche","jaguar","land","range","volvo","lexus","subaru","suzuki","smart","abarth","mitsubishi","ferrari","lamborghini","maserati","bentley","aston","rolls-royce","lancia"];
function guessBrandFromTitle(title: string): string | null {
  const t = title.toLowerCase();
  for (const b of BRANDS) {
    if (t.startsWith(b + " ") || t.includes(" " + b + " ") || t.startsWith(b + "-")) {
      return b.charAt(0).toUpperCase() + b.slice(1);
    }
  }
  return null;
}
function guessModelFromTitle(title: string, brand: string): string | null {
  const parts = title.split(/\s+/);
  const brandIdx = parts.findIndex((p) => p.toLowerCase() === brand.toLowerCase());
  if (brandIdx >= 0 && parts[brandIdx + 1]) return parts[brandIdx + 1];
  if (parts.length >= 2) return parts[1];
  return null;
}

export const ebayScraper: Scraper = {
  name: "ebay",
  async fetch({ limit = 25 } = {}): Promise<RawListing[]> {
    if (!process.env.EBAY_APP_ID) {
      // No credentials — return empty so the rest of the pipeline keeps running
      return [];
    }

    const markets = (process.env.EBAY_MARKETPLACES ?? "EBAY_FR").split(",").map((s) => s.trim()).filter(Boolean);
    const out: RawListing[] = [];
    for (const market of markets) {
      try {
        // Cars: category 9821 ("Voitures, motos, bateaux" sur eBay FR ; ou utilise leveled categories par marketplace)
        const items = await search({
          marketplace: market,
          limit: Math.ceil(limit / markets.length),
          category: process.env.EBAY_CATEGORY ?? "9801",
          filter: "buyingOptions:{FIXED_PRICE|AUCTION},conditions:{USED},priceCurrency:EUR",
        });
        for (const it of items) {
          const r = adapt(it, market);
          if (r) out.push(r);
        }
      } catch (e) {
        console.warn(`[ebay] ${market} failed:`, (e as Error).message);
      }
    }
    return out;
  },
};
