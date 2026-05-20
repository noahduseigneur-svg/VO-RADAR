import { generateSeedListings } from "../seed";
import type { Scraper, RawListing } from "./types";

// Demo scraper: produces fresh-looking synthetic listings on each run.
// Replace with real adapters (dealer feeds, mandataire APIs, partner data)
// before going live. Public-listing scraping of LeBonCoin/La Centrale violates
// their ToS and exposes you legally — use partnerships, RSS feeds, or licensed
// data instead.
export const demoScraper: Scraper = {
  name: "demo",
  async fetch({ limit = 25 } = {}): Promise<RawListing[]> {
    const seed = Math.floor(Date.now() / 60_000); // rotates every minute
    const items = generateSeedListings(limit, seed);
    return items.map((l) => ({
      id: `demo-${seed}-${l.source_id.replace(/^demo-/, "")}`,
      source: "demo-live",
      source_id: `demo-${seed}-${l.source_id.replace(/^demo-/, "")}`,
      url: l.url,
      title: l.title,
      brand: l.brand,
      model: l.model,
      version: l.version,
      engine_designation: l.engine_designation,
      body_type: l.body_type,
      year: l.year,
      mileage_km: l.mileage_km,
      fuel: l.fuel,
      gearbox: l.gearbox,
      power_hp: l.power_hp,
      price_eur: l.price_eur,
      seller_kind: l.seller_kind,
      postal_code: l.postal_code,
      region: l.region,
      photos_count: l.photos_count,
      posted_at: l.posted_at,
    }));
  },
};
