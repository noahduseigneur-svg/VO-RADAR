import { listActiveCustomSources, updateCustomSource, upsertListings, getCustomSource } from "../db";
import { estimateMarketValueDetailed } from "../pricing";
import { computeProPrice } from "../pricing-pro";
import { enrichListing, enrichMotoListing } from "../scoring";
import { findComparables } from "../comparables";
import { detectBodyType } from "../bodywork";
import { processNewListingsForAlerts } from "../matcher";
import type { Listing } from "../types";
import type { Scraper, RawListing } from "./types";
import { demoScraper } from "./demo";
import { aramisScraper } from "./aramis";
import { bymycarScraper } from "./bymycar";
import { ebayScraper } from "./ebay";
import { autoscout24Scraper } from "./autoscout24";
import { spoticarScraper } from "./spoticar";
import { bcaScraper } from "./bca";
import { lacentraleScraper } from "./lacentrale";
import { leboncoinScraper } from "./leboncoin";
import { mobiledeScraper } from "./mobilede";
import { marktplaatsScraper } from "./marktplaats";
import { createCustomScraper } from "./universal";
import { leboncoinMotoScraper } from "./leboncoin-moto";
import { lacentraleMotoScraper } from "./lacentrale-moto";
import { autoscout24MotoScraper } from "./autoscout24-moto";
import { autoheroScraper } from "./autohero";

const BUILTIN: Record<string, Scraper> = {
  demo: demoScraper,
  aramis: aramisScraper,
  bymycar: bymycarScraper,
  ebay: ebayScraper,
  autoscout24: autoscout24Scraper,
  spoticar: spoticarScraper,
  bca: bcaScraper,
  lacentrale: lacentraleScraper,
  leboncoin: leboncoinScraper,
  mobilede: mobiledeScraper,
  marktplaats: marktplaatsScraper,
  autohero: autoheroScraper,
  "leboncoin-moto": leboncoinMotoScraper,
  "lacentrale-moto": lacentraleMotoScraper,
  "autoscout24-moto": autoscout24MotoScraper,
};

export async function getActiveScrapers(): Promise<{ scrapers: Scraper[]; customSourceIds: string[] }> {
  if (process.env.SCRAPERS_MODE === "demo") return { scrapers: [demoScraper], customSourceIds: [] };

  const builtinList = (process.env.SCRAPERS_ENABLED ?? "aramis,bymycar,ebay,autoscout24,spoticar,lacentrale,leboncoin,mobilede,marktplaats,autohero,autoscout24-moto")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const builtin = builtinList.map((name) => BUILTIN[name]).filter(Boolean);

  const custom = await listActiveCustomSources();
  const customScrapers = custom.map((src) => createCustomScraper(src));

  return {
    scrapers: [...builtin, ...customScrapers],
    customSourceIds: custom.map((s) => s.id),
  };
}

export interface ScrapeRunResult {
  source: string;
  inserted: number;
  price_changes: number;
  error?: string;
}

// Live status exposé via /api/scrape/status
export interface ScrapeStatus {
  running: boolean;
  cycle: number;
  cycle_started_at: string | null;
  last_cycle_finished_at: string | null;
  last_cycle_duration_ms: number | null;
  next_run_at: string | null;
  interval_ms: number;
  total_runs: number;
  total_inserted: number;
  active_sources: string[];
  per_source: Record<string, { last_inserted: number; last_at: string; total: number; error?: string }>;
}

const STATUS: ScrapeStatus = {
  running: false,
  cycle: 0,
  cycle_started_at: null,
  last_cycle_finished_at: null,
  last_cycle_duration_ms: null,
  next_run_at: null,
  interval_ms: 0,
  total_runs: 0,
  total_inserted: 0,
  active_sources: [],
  per_source: {},
};

export function getScrapeStatus(): ScrapeStatus {
  return { ...STATUS, per_source: { ...STATUS.per_source } };
}

// Process one scraper end-to-end (fetch → enrich → upsert).
async function processOneScraper(
  scraper: Scraper,
  customIdSet: Set<string>,
  batchSize: number,
): Promise<ScrapeRunResult> {
  try {
    const raws: RawListing[] = await scraper.fetch({ limit: batchSize });
    if (raws.length === 0) {
      return { source: scraper.name, inserted: 0, price_changes: 0 };
    }
    const now = new Date().toISOString();

    const isMotoScraper = scraper.name.endsWith("-moto");

    // Phase 1 : enrich with cote model only (no comparables yet)
    const enriched: Listing[] = raws.map((r) => {
      if (isMotoScraper) {
        // Motos : pas de table de cotes voiture → score neutre, Phase 2 calibre avec kNN
        return enrichMotoListing(
          { ...r, body_type: "inconnu", fetched_at: now },
          r.price_eur, // market_value = asking price pour l'instant → score 50
          "fallback",
        );
      }
      const body = detectBodyType(r.model, r.title, r.version);
      const pricing = estimateMarketValueDetailed({
        brand: r.brand, model: r.model, year: r.year,
        mileage_km: r.mileage_km, fuel: r.fuel, gearbox: r.gearbox, power_hp: r.power_hp,
        asking_price_eur: r.price_eur,
      });
      return enrichListing(
        { ...r, body_type: body, fetched_at: now },
        pricing.market_value_eur,
        pricing.confidence,
      );
    });

    const { inserted, price_changes } = await upsertListings(enriched);

    if (customIdSet.has(scraper.name)) {
      try {
        const src = await getCustomSource(scraper.name);
        const existing = src?.total_inserted ?? 0;
        await updateCustomSource(scraper.name, {
          last_run_at: new Date().toISOString(),
          last_run_inserted: inserted,
          last_run_error: null,
          total_inserted: existing + inserted,
        });
      } catch { /* skip */ }
    }

    // Phase 2 : recompute with kNN + options + saison (pricing pro) now that rows are in DB
    const refined: Listing[] = await Promise.all(enriched.map(async (l) => {
      if (isMotoScraper) {
        // Motos : kNN comparables uniquement (pas de pricing-pro voiture)
        const comp = await findComparables({
          brand: l.brand, model: l.model, year: l.year,
          mileage_km: l.mileage_km, fuel: l.fuel, excludeId: l.id,
        });
        // market value = médiane comparables si dispo, sinon asking price
        const mv = comp.median_eur && comp.n >= 3 ? comp.median_eur : l.price_eur;
        const conf: "calibrated" | "fallback" = comp.n >= 3 ? "calibrated" : "fallback";
        return enrichMotoListing(l, mv, conf, comp);
      }
      const [comp, pro] = await Promise.all([
        findComparables({
          brand: l.brand, model: l.model, year: l.year,
          mileage_km: l.mileage_km, fuel: l.fuel, excludeId: l.id,
        }),
        computeProPrice({
          brand: l.brand, model: l.model, year: l.year, mileage_km: l.mileage_km,
          fuel: l.fuel, gearbox: l.gearbox, power_hp: l.power_hp,
          body_type: l.body_type, price_eur: l.price_eur,
          title: l.title, version: l.version, engine_designation: l.engine_designation,
          excludeId: l.id,
        }),
      ]);
      const proConfidence: "calibrated" | "fallback" =
        pro.confidence === "fallback" ? "fallback" : "calibrated";
      return enrichListing(l, pro.fair_price_eur, proConfidence, comp);
    }));
    await upsertListings(refined);

    return { source: scraper.name, inserted, price_changes };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    console.error(`[scrape] ${scraper.name} failed:`, msg);
    if (customIdSet.has(scraper.name)) {
      try {
        await updateCustomSource(scraper.name, {
          last_run_at: new Date().toISOString(),
          last_run_inserted: 0,
          last_run_error: msg.slice(0, 500),
        });
      } catch { /* skip */ }
    }
    return { source: scraper.name, inserted: 0, price_changes: 0, error: msg };
  }
}

const BATCH_SIZE = Number(process.env.SCRAPE_BATCH_SIZE ?? 50);

export async function runScrapers(options?: { limit?: number; vehicleType?: "car" | "moto" }): Promise<{ sources: ScrapeRunResult[]; hits: number; emails_sent: number }> {
  const batchSize = options?.limit ?? BATCH_SIZE;
  const runStart = new Date().toISOString();
  const { scrapers: allScrapers, customSourceIds } = await getActiveScrapers();
  // Filter by vehicle type if requested: moto scrapers have "-moto" suffix
  const scrapers = options?.vehicleType
    ? allScrapers.filter((s) =>
        options.vehicleType === "moto" ? s.name.endsWith("-moto") : !s.name.endsWith("-moto")
      )
    : allScrapers;
  const customIdSet = new Set(customSourceIds);

  STATUS.running = true;
  STATUS.cycle += 1;
  STATUS.cycle_started_at = runStart;
  STATUS.active_sources = scrapers.map((s) => s.name);

  const sources = await Promise.all(
    scrapers.map((s) => processOneScraper(s, customIdSet, batchSize)),
  );

  const finished = Date.now();
  STATUS.running = false;
  STATUS.last_cycle_finished_at = new Date(finished).toISOString();
  STATUS.last_cycle_duration_ms = finished - new Date(runStart).getTime();
  STATUS.total_runs += 1;

  for (const r of sources) {
    STATUS.total_inserted += r.inserted;
    const prev = STATUS.per_source[r.source];
    STATUS.per_source[r.source] = {
      last_inserted: r.inserted,
      last_at: new Date(finished).toISOString(),
      total: (prev?.total ?? 0) + r.inserted,
      error: r.error,
    };
  }

  const { hits, emails_sent } = await processNewListingsForAlerts(runStart);
  return { sources, hits, emails_sent };
}

// Alias for backward compat (existing /api/scrape/route.ts)
export const runAllScrapers = runScrapers;

