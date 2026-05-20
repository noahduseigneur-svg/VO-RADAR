import type { Listing } from "../types";

export type RawListing = Omit<
  Listing,
  | "market_value_eur" | "delta_eur" | "delta_pct" | "score"
  | "engine_rating" | "critair" | "comparables_n" | "comparables_median_eur"
  | "fetched_at"
>;

export interface Scraper {
  name: string;
  /** Fetch fresh listings. Implementations should be idempotent (same source_id => same id). */
  fetch(opts: { sinceHours?: number; limit?: number }): Promise<RawListing[]>;
}
