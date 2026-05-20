import type { Scraper, RawListing } from "./types";

// Helper générique pour scraper n'importe quel site concession exposant
// schema.org/Car en JSON-LD sur ses pages véhicules.
// Configurable via :
//   - sitemap URL initial (peut être un sitemapindex)
//   - filtre URL (regex pour ne garder que les pages produits)
//   - adapter (transforme le node Car JSON-LD en RawListing pour notre schéma)
//   - crawl-delay (respecte robots.txt)

export interface JsonLdScraperConfig {
  name: string;
  sitemapUrl: string;
  /** Regex qui matche les URLs de fiches véhicules (filtre depuis le sitemap). */
  productUrlPattern: RegExp;
  /** Délai entre requêtes en ms (respecte robots.txt). Défaut 5500. */
  crawlDelayMs?: number;
  /** Max URLs à fetcher par batch. Défaut 25. */
  batchSize?: number;
  /** User-Agent à utiliser. Défaut commun. */
  userAgent?: string;
  /** Adapter qui convertit un node JSON-LD Car en RawListing. */
  adapter: (jsonLd: JsonLdCar, url: string) => RawListing | null;
  /** Optional : si le sitemap principal est un index, suit ces sous-sitemaps. */
  followSitemapIndex?: boolean;
}

export type JsonLdCar = Record<string, unknown>;

const DEFAULT_UA = "VO-Radar/0.1 (+contact: sourcing@vo-radar.app)";

export function createJsonLdDealerScraper(cfg: JsonLdScraperConfig): Scraper {
  const ua = cfg.userAgent ?? process.env.SCRAPER_USER_AGENT ?? DEFAULT_UA;
  const crawlDelay = cfg.crawlDelayMs ?? 5500;

  return {
    name: cfg.name,
    async fetch({ limit }: { sinceHours?: number; limit?: number } = {}): Promise<RawListing[]> {
      const lim = Math.min(limit ?? cfg.batchSize ?? 25, cfg.batchSize ?? 30);

      let urls: string[];
      try {
        urls = await collectProductUrls(cfg.sitemapUrl, cfg.productUrlPattern, ua, cfg.followSitemapIndex ?? true);
      } catch (e) {
        console.warn(`[${cfg.name}] sitemap failed:`, (e as Error).message);
        return [];
      }
      if (urls.length === 0) return [];

      const sample = shuffle(urls).slice(0, lim);

      const out: RawListing[] = [];
      for (let i = 0; i < sample.length; i++) {
        try {
          const raw = await fetchAndParse(sample[i], ua, cfg.adapter);
          if (raw) out.push(raw);
        } catch (e) {
          console.warn(`[${cfg.name}] ${sample[i]}:`, (e as Error).message);
        }
        if (i < sample.length - 1) await sleep(crawlDelay);
      }
      return out;
    },
  };
}

async function collectProductUrls(
  sitemapUrl: string,
  productPattern: RegExp,
  ua: string,
  followIndex: boolean,
): Promise<string[]> {
  const xml = await fetchText(sitemapUrl, ua);
  if (!xml) return [];

  // Détecte sitemapindex vs urlset
  const isIndex = /<sitemapindex/i.test(xml);
  const locs = extractLocs(xml);

  if (isIndex && followIndex) {
    // Visite chaque sub-sitemap mais limite à 5 pour éviter d'exploser le temps
    const subs = locs.slice(0, 5);
    const all: string[] = [];
    for (const sub of subs) {
      try {
        const subXml = await fetchText(sub, ua);
        if (subXml) all.push(...extractLocs(subXml).filter((u) => productPattern.test(u)));
      } catch { /* skip bad sub-sitemap */ }
    }
    return all;
  }

  return locs.filter((u) => productPattern.test(u));
}

function extractLocs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim());
}

async function fetchText(url: string, ua: string): Promise<string | null> {
  const res = await fetch(url, { headers: { "user-agent": ua, accept: "text/xml,text/html,*/*" } });
  if (!res.ok) return null;
  return res.text();
}

async function fetchAndParse(
  url: string,
  ua: string,
  adapter: (j: JsonLdCar, url: string) => RawListing | null,
): Promise<RawListing | null> {
  const html = await fetchText(url, ua);
  if (!html) return null;

  const carNodes = extractCarJsonLd(html);
  for (const node of carNodes) {
    const result = adapter(node, url);
    if (result) return result;
  }
  return null;
}

export function extractCarJsonLd(html: string): JsonLdCar[] {
  const out: JsonLdCar[] = [];
  const blocks = Array.from(
    html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
  ).map((m) => m[1]);
  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b.trim());
      collectCarNodes(parsed, out);
    } catch { /* malformed json-ld */ }
  }
  return out;
}

function collectCarNodes(node: unknown, out: JsonLdCar[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectCarNodes(item, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  const types = Array.isArray(type) ? type : type ? [type] : [];
  if (types.some((t) => t === "Car" || t === "Vehicle")) {
    out.push(obj);
  }
  if (obj["@graph"]) collectCarNodes(obj["@graph"], out);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Helpers d'extraction communs réutilisés par les adapters
export function strField(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "name" in v) {
    const n = (v as { name?: unknown }).name;
    return typeof n === "string" ? n : null;
  }
  return null;
}

export function numField(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d.,]/g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === "object" && v !== null && "value" in v) {
    return numField((v as { value: unknown }).value);
  }
  return null;
}

export function yearFromDate(date: string | null | undefined): number | null {
  if (!date) return null;
  const m = date.match(/(\d{4})/);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1980 && y <= 2030 ? y : null;
}

export function mapFuel(raw: string | null): "essence" | "diesel" | "hybride" | "electrique" | "gpl" {
  if (!raw) return "essence";
  const v = raw.toLowerCase();
  if (v.includes("diesel") || v.includes("gasoil") || v.includes("gazole")) return "diesel";
  if (v.includes("hybrid")) return "hybride";
  if (v.includes("électr") || v.includes("electr") || v.includes("courant") || v.includes("bev")) return "electrique";
  if (v.includes("gpl") || v.includes("lpg")) return "gpl";
  return "essence";
}

export function mapGearbox(raw: string | null): "manuelle" | "automatique" {
  if (!raw) return "manuelle";
  return /auto|dsg|edc|eat|tiptronic|cvt|s-tronic/i.test(raw) ? "automatique" : "manuelle";
}
