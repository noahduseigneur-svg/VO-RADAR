import { createClient, type Client, type InStatement, type InValue } from "@libsql/client";
import type { Listing, AlertRule, User } from "./types";
import { generateSeedListings } from "./seed";
import { type GarageProfile, DEFAULT_PROFILE as DEFAULT_GARAGE } from "./margin";

let initPromise: Promise<Client> | null = null;

/** Convert a libSQL Row (class instance with methods) to a plain serializable object. */
function rowToPlain<T>(row: unknown): T {
  return JSON.parse(JSON.stringify(row)) as T;
}

async function getClient(): Promise<Client> {
  if (!initPromise) {
    initPromise = (async () => {
      const url =
        process.env.TURSO_DATABASE_URL ??
        `file:${process.cwd()}/.data/vo-radar.db`;
      const client = createClient({
        url,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
      await migrate(client);
      await seedIfEmpty(client);
      return client;
    })();
  }
  return initPromise;
}

async function migrate(client: Client): Promise<void> {
  // WAL mode + busy timeout so multiple build workers don't deadlock
  await client.execute({ sql: "PRAGMA journal_mode=WAL", args: [] }).catch(() => {});
  await client.execute({ sql: "PRAGMA busy_timeout=10000", args: [] }).catch(() => {});

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      dealership_name TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'trial',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      subscription_status TEXT NOT NULL DEFAULT 'trialing',
      trial_ends_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      version TEXT,
      engine_designation TEXT,
      body_type TEXT NOT NULL DEFAULT 'inconnu',
      year INTEGER NOT NULL,
      mileage_km INTEGER NOT NULL,
      fuel TEXT NOT NULL,
      gearbox TEXT NOT NULL,
      power_hp INTEGER,
      price_eur INTEGER NOT NULL,
      seller_kind TEXT NOT NULL,
      postal_code TEXT,
      region TEXT,
      photos_count INTEGER NOT NULL DEFAULT 0,
      photo_url TEXT,
      posted_at TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      market_value_eur INTEGER NOT NULL,
      delta_eur INTEGER NOT NULL,
      delta_pct REAL NOT NULL,
      score INTEGER NOT NULL,
      engine_rating TEXT NOT NULL DEFAULT 'unknown',
      critair INTEGER NOT NULL DEFAULT 0,
      comparables_n INTEGER NOT NULL DEFAULT 0,
      comparables_median_eur INTEGER,
      UNIQUE(source, source_id)
    );
    CREATE INDEX IF NOT EXISTS idx_listings_score ON listings(score DESC);
    CREATE INDEX IF NOT EXISTS idx_listings_brand_model ON listings(brand, model);
    CREATE INDEX IF NOT EXISTS idx_listings_posted ON listings(posted_at DESC);

    CREATE TABLE IF NOT EXISTS alert_rules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      max_price_eur INTEGER,
      max_mileage_km INTEGER,
      min_year INTEGER,
      fuel TEXT,
      min_score INTEGER NOT NULL DEFAULT 70,
      region TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alert_hits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rule_id TEXT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      notified_at TEXT NOT NULL DEFAULT (datetime('now')),
      seen_at TEXT,
      email_sent_at TEXT,
      UNIQUE(rule_id, listing_id)
    );
    CREATE INDEX IF NOT EXISTS idx_alert_hits_user ON alert_hits(user_id, notified_at DESC);

    CREATE TABLE IF NOT EXISTS saved_listings (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      note TEXT,
      saved_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, listing_id)
    );

    CREATE TABLE IF NOT EXISTS price_history (
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      price_eur INTEGER NOT NULL,
      observed_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (listing_id, observed_at)
    );
    CREATE INDEX IF NOT EXISTS idx_price_history_listing ON price_history(listing_id, observed_at);

    CREATE TABLE IF NOT EXISTS deal_pipeline (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'watching',
      note TEXT,
      target_price_eur INTEGER,
      max_offer_eur INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, listing_id)
    );
    CREATE INDEX IF NOT EXISTS idx_deal_pipeline_user ON deal_pipeline(user_id, status);

    CREATE TABLE IF NOT EXISTS user_state (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      last_listings_view TEXT,
      last_listings_view_prev TEXT,
      onboarded_at TEXT
    );

    CREATE TABLE IF NOT EXISTS custom_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sitemap_url TEXT NOT NULL,
      product_url_pattern TEXT NOT NULL,
      crawl_delay_ms INTEGER NOT NULL DEFAULT 5500,
      batch_size INTEGER NOT NULL DEFAULT 20,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      last_run_inserted INTEGER NOT NULL DEFAULT 0,
      last_run_error TEXT,
      total_inserted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vehicle_checks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      plate TEXT,
      ct_ok INTEGER,
      accident_ok INTEGER,
      docs_ok INTEGER,
      body_ok INTEGER,
      test_drive_ok INTEGER,
      owners_count INTEGER,
      last_ct_km INTEGER,
      last_ct_date TEXT,
      note TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, listing_id)
    );

    CREATE TABLE IF NOT EXISTS garage_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      transport_eur INTEGER NOT NULL DEFAULT 250,
      recon_base_eur INTEGER NOT NULL DEFAULT 200,
      recon_per_year_eur INTEGER NOT NULL DEFAULT 80,
      recon_per_10k_km_eur INTEGER NOT NULL DEFAULT 50,
      prep_ct_eur INTEGER NOT NULL DEFAULT 300,
      fixed_costs_eur INTEGER NOT NULL DEFAULT 400,
      target_margin_eur INTEGER NOT NULL DEFAULT 1000,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS listing_notes (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, listing_id)
    );

    CREATE TABLE IF NOT EXISTS saved_searches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      params TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS deal_activities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_deal_activities ON deal_activities(user_id, listing_id, created_at DESC);
  `);

  // Migrations additives — ignorent l'erreur "duplicate column" si déjà appliquées
  const additives = [
    "ALTER TABLE users ADD COLUMN digest_enabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE users ADD COLUMN notif_price_drop INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE users ADD COLUMN notif_listing_gone INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE deal_pipeline ADD COLUMN price_eur_paid INTEGER",
    "ALTER TABLE deal_pipeline ADD COLUMN fees_eur INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE deal_pipeline ADD COLUMN price_sold_eur INTEGER",
    "ALTER TABLE deal_pipeline ADD COLUMN sold_at TEXT",
    "ALTER TABLE deal_pipeline ADD COLUMN won_at TEXT",
    "ALTER TABLE listings ADD COLUMN photos_json TEXT",
    "ALTER TABLE listings ADD COLUMN first_seen_at TEXT",
    "ALTER TABLE listings ADD COLUMN vehicle_type TEXT NOT NULL DEFAULT 'car'",
    "ALTER TABLE listings ADD COLUMN moto_type TEXT",
    "ALTER TABLE listings ADD COLUMN cylindree_cc INTEGER",
    // Alertes motos
    "ALTER TABLE alert_rules ADD COLUMN vehicle_type TEXT",
    "ALTER TABLE alert_rules ADD COLUMN moto_type TEXT",
    "ALTER TABLE alert_rules ADD COLUMN min_cylindree INTEGER",
    "ALTER TABLE alert_rules ADD COLUMN max_cylindree INTEGER",
  ];
  for (const sql of additives) {
    await client.execute({ sql, args: [] }).catch(() => {});
  }
}

async function seedIfEmpty(client: Client): Promise<void> {
  if (process.env.DEMO_MODE === "true") {
    await client.execute({
      sql: `INSERT INTO users (id, email, password_hash, dealership_name, plan, subscription_status, trial_ends_at, created_at, digest_enabled)
            VALUES ('demo','demo@vo-radar.app','','Démo','pro','active',datetime('now','+999 days'),datetime('now'),1)
            ON CONFLICT(id) DO NOTHING`,
      args: [],
    });
    await client.execute({
      sql: `INSERT INTO user_state (user_id, onboarded_at) VALUES ('demo', datetime('now'))
            ON CONFLICT(user_id) DO NOTHING`,
      args: [],
    });
  }
  if (process.env.SEED_DEMO !== "1" && process.env.SCRAPERS_MODE !== "demo") return;
  const res = await client.execute("SELECT COUNT(*) as n FROM listings");
  const n = Number((res.rows[0] as unknown as { n: number }).n);
  if (n > 0) return;
  const listings = generateSeedListings(120);
  await upsertListings(listings);
}

export async function upsertListings(items: Listing[]): Promise<{ inserted: number; price_changes: number }> {
  if (items.length === 0) return { inserted: 0, price_changes: 0 };
  const client = await getClient();

  // Phase 1: fetch existing prices
  const priceMap = new Map<string, number>();
  const selectStmts: InStatement[] = items.map((r) => ({
    sql: "SELECT source, source_id, price_eur FROM listings WHERE source = ? AND source_id = ?",
    args: [r.source, r.source_id],
  }));
  const priceResults = await client.batch(selectStmts, "read");
  for (let i = 0; i < items.length; i++) {
    const row = priceResults[i].rows[0] as unknown as { source: string; source_id: string; price_eur: number } | undefined;
    if (row) {
      priceMap.set(`${items[i].source}:${items[i].source_id}`, row.price_eur);
    }
  }

  // Phase 2: upsert + insert price history
  let priceChanges = 0;
  const stmts: InStatement[] = [];
  for (const r of items) {
    stmts.push({
      sql: `INSERT INTO listings (
        id, source, source_id, url, title, brand, model, version, engine_designation, body_type,
        year, mileage_km, fuel, gearbox, power_hp, price_eur, seller_kind,
        postal_code, region, photos_count, photo_url, photos_json, posted_at, fetched_at, first_seen_at,
        market_value_eur, delta_eur, delta_pct, score,
        engine_rating, critair, comparables_n, comparables_median_eur,
        vehicle_type, moto_type, cylindree_cc
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
      ON CONFLICT(source, source_id) DO UPDATE SET
        price_eur = excluded.price_eur,
        mileage_km = excluded.mileage_km,
        fetched_at = excluded.fetched_at,
        first_seen_at = COALESCE(listings.first_seen_at, excluded.first_seen_at),
        photo_url = COALESCE(excluded.photo_url, listings.photo_url),
        photos_json = COALESCE(excluded.photos_json, listings.photos_json),
        market_value_eur = excluded.market_value_eur,
        delta_eur = excluded.delta_eur,
        delta_pct = excluded.delta_pct,
        score = excluded.score,
        engine_rating = excluded.engine_rating,
        critair = excluded.critair,
        comparables_n = excluded.comparables_n,
        comparables_median_eur = excluded.comparables_median_eur,
        vehicle_type = excluded.vehicle_type,
        moto_type = excluded.moto_type,
        cylindree_cc = COALESCE(excluded.cylindree_cc, listings.cylindree_cc)`,
      args: [
        r.id, r.source, r.source_id, r.url, r.title, r.brand, r.model,
        r.version ?? null, r.engine_designation ?? null, r.body_type,
        r.year, r.mileage_km, r.fuel, r.gearbox, r.power_hp ?? null,
        r.price_eur, r.seller_kind, r.postal_code ?? null, r.region ?? null,
        r.photos_count, r.photo_url ?? null, r.photos_json ?? null, r.posted_at, r.fetched_at, r.fetched_at,
        r.market_value_eur, r.delta_eur, r.delta_pct, r.score,
        r.engine_rating, r.critair, r.comparables_n, r.comparables_median_eur ?? null,
        r.vehicle_type ?? "car", r.moto_type ?? null, r.cylindree_cc ?? null,
      ],
    });
    const prevPrice = priceMap.get(`${r.source}:${r.source_id}`);
    if (prevPrice === undefined) {
      stmts.push({
        sql: "INSERT OR IGNORE INTO price_history (listing_id, price_eur, observed_at) VALUES (?, ?, ?)",
        args: [r.id, r.price_eur, r.fetched_at],
      });
    } else if (prevPrice !== r.price_eur) {
      stmts.push({
        sql: "INSERT OR IGNORE INTO price_history (listing_id, price_eur, observed_at) VALUES (?, ?, ?)",
        args: [r.id, r.price_eur, r.fetched_at],
      });
      priceChanges++;
    }
  }
  await client.batch(stmts, "write");
  return { inserted: items.length, price_changes: priceChanges };
}

export async function getPriceHistory(listingId: string): Promise<{ price_eur: number; observed_at: string }[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT price_eur, observed_at FROM price_history WHERE listing_id = ? ORDER BY observed_at ASC",
    args: [listingId],
  });
  return res.rows as unknown as { price_eur: number; observed_at: string }[];
}

export type ListingSort =
  | "score_desc"
  | "price_asc"
  | "price_desc"
  | "date_desc"
  | "mileage_asc"
  | "delta_desc";

export interface ListingFilters {
  brand?: string;
  model?: string;
  min_score?: number;
  max_price?: number;
  min_price?: number;
  max_mileage?: number;
  min_year?: number;
  max_year?: number;
  fuel?: string;
  seller_kind?: string;
  region?: string;
  country?: string; // "france" | "etranger" | "Belgique" | "Allemagne" | etc.
  source?: string;
  search?: string;
  body_type?: string;
  hide_risky_engines?: boolean;
  max_critair?: number;
  vehicle_type?: string; // "car" | "moto"
  moto_type?: string;
  min_cylindree?: number;
  max_cylindree?: number;
  sort?: ListingSort;
  limit?: number;
  offset?: number;
}

export async function queryListings(filters: ListingFilters = {}): Promise<Listing[]> {
  const client = await getClient();
  const where: string[] = [];
  const params: Record<string, InValue> = {};
  if (filters.brand)       { where.push("brand = @brand");           params.brand = filters.brand; }
  if (filters.model)       { where.push("model = @model");           params.model = filters.model; }
  if (filters.min_score)   { where.push("score >= @min_score");      params.min_score = filters.min_score; }
  if (filters.max_price)   { where.push("price_eur <= @max_price");  params.max_price = filters.max_price; }
  if (filters.max_mileage) { where.push("mileage_km <= @max_mileage"); params.max_mileage = filters.max_mileage; }
  if (filters.min_year)    { where.push("year >= @min_year");         params.min_year = filters.min_year; }
  if (filters.max_year)    { where.push("year <= @max_year");         params.max_year = filters.max_year; }
  if (filters.min_price)   { where.push("price_eur >= @min_price");   params.min_price = filters.min_price; }
  if (filters.fuel)        { where.push("fuel = @fuel");              params.fuel = filters.fuel; }
  if (filters.seller_kind) { where.push("seller_kind = @seller_kind"); params.seller_kind = filters.seller_kind; }
  if (filters.region)      { where.push("region = @region");          params.region = filters.region; }
  if (filters.country) {
    const foreign = [...FOREIGN_REGIONS];
    if (filters.country === "france") {
      where.push(`region NOT IN (${foreign.map((_, i) => `@fr${i}`).join(",")})`);
      foreign.forEach((r, i) => { params[`fr${i}`] = r; });
    } else if (filters.country === "etranger") {
      where.push(`region IN (${foreign.map((_, i) => `@fe${i}`).join(",")})`);
      foreign.forEach((r, i) => { params[`fe${i}`] = r; });
    } else {
      // pays spécifique ex: "Belgique"
      where.push("region = @country"); params.country = filters.country;
    }
  }
  if (filters.source)      { where.push("source = @source");          params.source = filters.source; }
  if (filters.search) {
    where.push("(title LIKE @search OR brand LIKE @search OR model LIKE @search)");
    params.search = `%${filters.search}%`;
  }
  if (filters.body_type) { where.push("body_type = @body_type"); params.body_type = filters.body_type; }
  if (filters.hide_risky_engines) {
    where.push("engine_rating NOT IN ('risky','avoid')");
  }
  if (filters.max_critair !== undefined) {
    where.push("critair >= 0 AND critair <= @max_critair");
    params.max_critair = filters.max_critair;
  }
  // Par défaut : voitures uniquement. Passer vehicle_type="moto" pour les motos.
  const vt = filters.vehicle_type ?? "car";
  where.push("COALESCE(vehicle_type,'car') = @vehicle_type");
  params.vehicle_type = vt;
  if (filters.moto_type)    { where.push("moto_type = @moto_type");    params.moto_type = filters.moto_type; }
  if (filters.min_cylindree !== undefined) { where.push("cylindree_cc >= @min_cc"); params.min_cc = filters.min_cylindree; }
  if (filters.max_cylindree !== undefined) { where.push("cylindree_cc <= @max_cc"); params.max_cc = filters.max_cylindree; }
  const orderBy = {
    score_desc:   "score DESC, posted_at DESC",
    price_asc:    "price_eur ASC",
    price_desc:   "price_eur DESC",
    date_desc:    "posted_at DESC",
    mileage_asc:  "mileage_km ASC",
    delta_desc:   "delta_pct ASC",
  }[filters.sort ?? "score_desc"] ?? "score DESC, posted_at DESC";
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;
  params.limit = limit;
  params.offset = offset;
  const sql = `
    SELECT * FROM listings
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY ${orderBy}
    LIMIT @limit OFFSET @offset
  `;
  const res = await client.execute({ sql, args: params });
  return res.rows.map((r) => rowToPlain<Listing>(r));
}

export async function getDistinctRegions(): Promise<string[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT DISTINCT region FROM listings WHERE region IS NOT NULL AND region != '' ORDER BY region",
    args: [],
  });
  return (res.rows as unknown as { region: string }[]).map((r) => r.region);
}

export async function getDistinctSources(vehicleType: "car" | "moto" = "car"): Promise<string[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT DISTINCT source FROM listings WHERE source IS NOT NULL AND source != '' AND COALESCE(vehicle_type,'car') = ? ORDER BY source",
    args: [vehicleType],
  });
  return (res.rows as unknown as { source: string }[]).map((r) => r.source);
}

export const FOREIGN_REGIONS = ["Belgique", "Allemagne", "Pays-Bas", "Luxembourg", "Espagne", "Italie"] as const;

export async function getRegionStats(vehicleType: "car" | "moto" = "car"): Promise<{ total: number; byRegion: Record<string, number> }> {
  const client = await getClient();
  const stmts: InStatement[] = [
    { sql: "SELECT COUNT(*) n FROM listings WHERE COALESCE(vehicle_type,'car') = ?", args: [vehicleType] },
    {
      sql: `SELECT region, COUNT(*) n FROM listings WHERE COALESCE(vehicle_type,'car') = ? AND region IN (${FOREIGN_REGIONS.map(() => "?").join(",")}) GROUP BY region`,
      args: [vehicleType, ...FOREIGN_REGIONS],
    },
  ];
  const results = await client.batch(stmts, "read");
  const total = Number((results[0].rows[0] as unknown as { n: number }).n);
  const byRegion: Record<string, number> = {};
  for (const row of results[1].rows as unknown as { region: string; n: number }[]) {
    byRegion[row.region] = Number(row.n);
  }
  return { total, byRegion };
}

export async function getListing(id: string): Promise<Listing | null> {
  const client = await getClient();
  const res = await client.execute({ sql: "SELECT * FROM listings WHERE id = ?", args: [id] });
  return res.rows[0] ? rowToPlain<Listing>(res.rows[0]) : null;
}

export async function getBrands(vehicleType: "car" | "moto" = "car"): Promise<string[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT DISTINCT brand FROM listings WHERE COALESCE(vehicle_type,'car') = ? ORDER BY brand",
    args: [vehicleType],
  });
  const raw = (res.rows as unknown as { brand: string }[]).map((r) => r.brand);
  // Deduplicate case-insensitively; prefer the first mixed-case form seen
  const seen = new Map<string, string>();
  for (const b of raw) {
    const key = b.toUpperCase();
    if (!seen.has(key)) seen.set(key, b);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

export async function getModelsForBrand(brand: string, vehicleType: "car" | "moto" = "car"): Promise<string[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT DISTINCT model FROM listings WHERE brand = ? AND COALESCE(vehicle_type,'car') = ? ORDER BY model",
    args: [brand, vehicleType],
  });
  return (res.rows as unknown as { model: string }[]).map((r) => r.model);
}

export async function getSimilarListings(
  excludeId: string,
  brand: string,
  model: string,
  priceEur: number,
  limit = 4
): Promise<Listing[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: `SELECT * FROM listings
          WHERE id != ? AND brand = ? AND model = ?
          ORDER BY ABS(price_eur - ?) ASC
          LIMIT ?`,
    args: [excludeId, brand, model, priceEur, limit],
  });
  return (res.rows as unknown as Listing[]);
}

export async function getSavedListingIds(userId: string): Promise<Set<string>> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT listing_id FROM saved_listings WHERE user_id = ?",
    args: [userId],
  });
  return new Set((res.rows as unknown as { listing_id: string }[]).map((r) => r.listing_id));
}

export async function countFreshSince(since: string, vehicleType: "car" | "moto" = "car"): Promise<number> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT COUNT(*) n FROM listings WHERE fetched_at > ? AND COALESCE(vehicle_type,'car') = ?",
    args: [since, vehicleType],
  });
  return Number((res.rows[0] as unknown as { n: number }).n);
}

export async function statsForDashboard(): Promise<{
  total: number;
  fresh_24h: number;
  hot_deals: number;
  avg_score: number;
  brands: { brand: string; n: number }[];
}> {
  const client = await getClient();
  const stmts: InStatement[] = [
    { sql: "SELECT COUNT(*) n FROM listings WHERE COALESCE(vehicle_type,'car') = 'car'", args: [] },
    { sql: "SELECT COUNT(*) n FROM listings WHERE COALESCE(vehicle_type,'car') = 'car' AND posted_at > datetime('now','-24 hours')", args: [] },
    { sql: "SELECT COUNT(*) n FROM listings WHERE COALESCE(vehicle_type,'car') = 'car' AND score >= 80", args: [] },
    { sql: "SELECT COALESCE(AVG(score),0) a FROM listings WHERE COALESCE(vehicle_type,'car') = 'car'", args: [] },
    { sql: "SELECT brand, COUNT(*) n FROM listings WHERE COALESCE(vehicle_type,'car') = 'car' GROUP BY brand ORDER BY n DESC LIMIT 8", args: [] },
  ];
  const results = await client.batch(stmts, "read");
  const total = Number((results[0].rows[0] as unknown as { n: number }).n);
  const fresh = Number((results[1].rows[0] as unknown as { n: number }).n);
  const hot = Number((results[2].rows[0] as unknown as { n: number }).n);
  const avg = Number((results[3].rows[0] as unknown as { a: number }).a);
  const brands = results[4].rows as unknown as { brand: string; n: number }[];
  return { total, fresh_24h: fresh, hot_deals: hot, avg_score: Math.round(avg), brands };
}

// Users ---------------------------------------------------------------------
export async function createUser(u: User): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: `INSERT INTO users (id, email, password_hash, dealership_name, plan, subscription_status, trial_ends_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [u.id, u.email, u.password_hash, u.dealership_name, u.plan, u.subscription_status, u.trial_ends_at],
  });
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const client = await getClient();
  const res = await client.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
  return (res.rows[0] as unknown as User | undefined) ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const client = await getClient();
  const res = await client.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
  return (res.rows[0] as unknown as User | undefined) ?? null;
}

export async function updateUserStripe(
  id: string,
  fields: Partial<Pick<User, "stripe_customer_id" | "stripe_subscription_id" | "subscription_status" | "plan">>,
): Promise<void> {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return;
  const client = await getClient();
  const set = entries.map(([k]) => `${k} = ?`).join(", ");
  await client.execute({
    sql: `UPDATE users SET ${set} WHERE id = ?`,
    args: [...entries.map(([, v]) => v as string), id],
  });
}

export async function listAllUsers(): Promise<User[]> {
  const client = await getClient();
  const res = await client.execute({ sql: "SELECT * FROM users ORDER BY created_at ASC", args: [] });
  return res.rows as unknown as User[];
}

export async function listDigestUsers(): Promise<User[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT * FROM users WHERE digest_enabled = 1 ORDER BY created_at ASC",
    args: [],
  });
  return res.rows as unknown as User[];
}

export async function updateUserDigestPref(userId: string, enabled: boolean): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: "UPDATE users SET digest_enabled = ? WHERE id = ?",
    args: [enabled ? 1 : 0, userId],
  });
}

export async function getTopListingsSince(sinceIso: string, limit = 15): Promise<Listing[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT * FROM listings WHERE fetched_at >= ? ORDER BY score DESC, delta_pct ASC LIMIT ?",
    args: [sinceIso, limit],
  });
  return res.rows.map((r) => rowToPlain<Listing>(r));
}

// Sessions ------------------------------------------------------------------
export async function createSession(userId: string, token: string, days = 30): Promise<void> {
  const client = await getClient();
  const expires = new Date(Date.now() + days * 86400_000).toISOString();
  await client.execute({
    sql: "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
    args: [token, userId, expires],
  });
}

export async function getSessionUser(token: string): Promise<User | null> {
  const client = await getClient();
  const res = await client.execute({
    sql: `SELECT u.* FROM sessions s
          JOIN users u ON u.id = s.user_id
          WHERE s.token = ? AND s.expires_at > datetime('now')`,
    args: [token],
  });
  return (res.rows[0] as unknown as User | undefined) ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  const client = await getClient();
  await client.execute({ sql: "DELETE FROM sessions WHERE token = ?", args: [token] });
}

// Alerts --------------------------------------------------------------------
export async function createAlert(rule: AlertRule): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: `INSERT INTO alert_rules (id, user_id, name, brand, model, max_price_eur, max_mileage_km, min_year, fuel, min_score, region, active, vehicle_type, moto_type, min_cylindree, max_cylindree)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      rule.id, rule.user_id, rule.name,
      rule.brand ?? null, rule.model ?? null,
      rule.max_price_eur ?? null, rule.max_mileage_km ?? null,
      rule.min_year ?? null, rule.fuel ?? null,
      rule.min_score, rule.region ?? null, rule.active,
      rule.vehicle_type ?? null,
      rule.moto_type ?? null,
      rule.min_cylindree ?? null,
      rule.max_cylindree ?? null,
    ],
  });
}

export async function listAlerts(userId: string): Promise<AlertRule[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT * FROM alert_rules WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
  return res.rows as unknown as AlertRule[];
}

export async function deleteAlert(userId: string, id: string): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: "DELETE FROM alert_rules WHERE user_id = ? AND id = ?",
    args: [userId, id],
  });
}

export async function matchListingsForRule(rule: AlertRule, limit = 20): Promise<Listing[]> {
  return queryListings({
    brand: rule.brand ?? undefined,
    model: rule.model ?? undefined,
    max_price: rule.max_price_eur ?? undefined,
    max_mileage: rule.max_mileage_km ?? undefined,
    min_year: rule.min_year ?? undefined,
    fuel: rule.fuel ?? undefined,
    region: rule.region ?? undefined,
    min_score: rule.min_score,
    vehicle_type: (rule.vehicle_type as "car" | "moto" | undefined) ?? "car",
    moto_type: rule.moto_type ?? undefined,
    min_cylindree: rule.min_cylindree ?? undefined,
    max_cylindree: rule.max_cylindree ?? undefined,
    limit,
  });
}

export async function listAllActiveAlerts(): Promise<AlertRule[]> {
  const client = await getClient();
  const res = await client.execute({ sql: "SELECT * FROM alert_rules WHERE active = 1", args: [] });
  return res.rows as unknown as AlertRule[];
}

// Alert hits / notifications -------------------------------------------------
export interface AlertHit {
  id: string;
  user_id: string;
  rule_id: string;
  listing_id: string;
  notified_at: string;
  seen_at: string | null;
  email_sent_at: string | null;
}

export interface AlertHitWithContext extends AlertHit {
  rule_name: string;
  listing: Listing;
}

export async function recordAlertHit(hit: AlertHit): Promise<boolean> {
  const client = await getClient();
  const res = await client.execute({
    sql: `INSERT OR IGNORE INTO alert_hits (id, user_id, rule_id, listing_id, notified_at, seen_at, email_sent_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [hit.id, hit.user_id, hit.rule_id, hit.listing_id, hit.notified_at, hit.seen_at ?? null, hit.email_sent_at ?? null],
  });
  return (res.rowsAffected ?? 0) > 0;
}

export async function markAlertHitEmailed(id: string): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: "UPDATE alert_hits SET email_sent_at = datetime('now') WHERE id = ?",
    args: [id],
  });
}

export async function listAlertHits(userId: string, limit = 50): Promise<AlertHitWithContext[]> {
  const client = await getClient();
  const hitRes = await client.execute({
    sql: `SELECT h.*, r.name as rule_name
          FROM alert_hits h
          JOIN alert_rules r ON r.id = h.rule_id
          WHERE h.user_id = ?
          ORDER BY h.notified_at DESC
          LIMIT ?`,
    args: [userId, limit],
  });
  const hitRows = hitRes.rows as unknown as (AlertHit & { rule_name: string })[];
  if (hitRows.length === 0) return [];

  const listingIds = hitRows.map((r) => r.listing_id);
  const placeholders = listingIds.map(() => "?").join(",");
  const listingRes = await client.execute({
    sql: `SELECT * FROM listings WHERE id IN (${placeholders})`,
    args: listingIds,
  });
  const listings = listingRes.rows as unknown as Listing[];
  const byId = new Map(listings.map((l) => [l.id, l]));

  return hitRows
    .filter((h) => byId.has(h.listing_id))
    .map((h) => ({
      id: h.id,
      user_id: h.user_id,
      rule_id: h.rule_id,
      listing_id: h.listing_id,
      notified_at: h.notified_at,
      seen_at: h.seen_at,
      email_sent_at: h.email_sent_at,
      rule_name: h.rule_name,
      listing: byId.get(h.listing_id)!,
    }));
}

export async function countUnseenHits(userId: string): Promise<number> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT COUNT(*) n FROM alert_hits WHERE user_id = ? AND seen_at IS NULL",
    args: [userId],
  });
  return Number((res.rows[0] as unknown as { n: number }).n);
}

export async function markHitsSeen(userId: string): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: "UPDATE alert_hits SET seen_at = datetime('now') WHERE user_id = ? AND seen_at IS NULL",
    args: [userId],
  });
}

// Saved listings (favorites) ------------------------------------------------
export async function toggleSavedListing(userId: string, listingId: string, note?: string | null): Promise<boolean> {
  const client = await getClient();
  const check = await client.execute({
    sql: "SELECT 1 FROM saved_listings WHERE user_id = ? AND listing_id = ?",
    args: [userId, listingId],
  });
  if (check.rows.length > 0) {
    await client.execute({
      sql: "DELETE FROM saved_listings WHERE user_id = ? AND listing_id = ?",
      args: [userId, listingId],
    });
    return false;
  }
  await client.execute({
    sql: "INSERT INTO saved_listings (user_id, listing_id, note) VALUES (?, ?, ?)",
    args: [userId, listingId, note ?? null],
  });
  return true;
}

export async function isListingSaved(userId: string, listingId: string): Promise<boolean> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT 1 FROM saved_listings WHERE user_id = ? AND listing_id = ?",
    args: [userId, listingId],
  });
  return res.rows.length > 0;
}

export async function listSavedListings(userId: string): Promise<Listing[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: `SELECT l.* FROM saved_listings s
          JOIN listings l ON l.id = s.listing_id
          WHERE s.user_id = ?
          ORDER BY s.saved_at DESC`,
    args: [userId],
  });
  return res.rows.map((r) => rowToPlain<Listing>(r));
}

// Custom sources -----------------------------------------------------------
export interface CustomSource {
  id: string;
  name: string;
  sitemap_url: string;
  product_url_pattern: string;
  crawl_delay_ms: number;
  batch_size: number;
  enabled: 0 | 1;
  last_run_at: string | null;
  last_run_inserted: number;
  last_run_error: string | null;
  total_inserted: number;
  created_at: string;
}

export async function listCustomSources(): Promise<CustomSource[]> {
  const client = await getClient();
  const res = await client.execute({ sql: "SELECT * FROM custom_sources ORDER BY created_at DESC", args: [] });
  return res.rows as unknown as CustomSource[];
}

export async function listActiveCustomSources(): Promise<CustomSource[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT * FROM custom_sources WHERE enabled = 1 ORDER BY created_at DESC",
    args: [],
  });
  return res.rows as unknown as CustomSource[];
}

export async function getCustomSource(id: string): Promise<CustomSource | null> {
  const client = await getClient();
  const res = await client.execute({ sql: "SELECT * FROM custom_sources WHERE id = ?", args: [id] });
  return (res.rows[0] as unknown as CustomSource | undefined) ?? null;
}

export async function createCustomSource(
  src: Omit<CustomSource, "created_at" | "last_run_at" | "last_run_inserted" | "last_run_error" | "total_inserted">,
): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: `INSERT INTO custom_sources (id, name, sitemap_url, product_url_pattern, crawl_delay_ms, batch_size, enabled)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [src.id, src.name, src.sitemap_url, src.product_url_pattern, src.crawl_delay_ms, src.batch_size, src.enabled],
  });
}

export async function updateCustomSource(id: string, fields: Partial<CustomSource>): Promise<void> {
  const entries = Object.entries(fields).filter(([k]) => k !== "id");
  if (!entries.length) return;
  const client = await getClient();
  const set = entries.map(([k]) => `${k} = ?`).join(", ");
  await client.execute({
    sql: `UPDATE custom_sources SET ${set} WHERE id = ?`,
    args: [...entries.map(([, v]) => v as string | number | null), id],
  });
}

export async function deleteCustomSource(id: string): Promise<void> {
  const client = await getClient();
  await client.execute({ sql: "DELETE FROM custom_sources WHERE id = ?", args: [id] });
}

export async function countListingsBySource(): Promise<{ source: string; n: number }[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT source, COUNT(*) n FROM listings GROUP BY source ORDER BY n DESC",
    args: [],
  });
  return res.rows as unknown as { source: string; n: number }[];
}

// Deal pipeline -----------------------------------------------------------
export type DealStatus = "watching" | "to_call" | "negotiating" | "won" | "lost";

export interface DealEntry {
  user_id: string;
  listing_id: string;
  status: DealStatus;
  note: string | null;
  target_price_eur: number | null;
  max_offer_eur: number | null;
  // ROI tracking
  price_eur_paid: number | null;
  fees_eur: number;
  price_sold_eur: number | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealWithListing extends DealEntry {
  listing: Listing;
}

export async function setDealStatus(
  userId: string,
  listingId: string,
  status: DealStatus,
  fields: Partial<Pick<DealEntry, "note" | "target_price_eur" | "max_offer_eur">> = {},
): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: `INSERT INTO deal_pipeline (user_id, listing_id, status, note, target_price_eur, max_offer_eur, updated_at, won_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), CASE WHEN ? = 'won' THEN datetime('now') ELSE NULL END)
          ON CONFLICT(user_id, listing_id) DO UPDATE SET
            status = excluded.status,
            note = COALESCE(excluded.note, deal_pipeline.note),
            target_price_eur = COALESCE(excluded.target_price_eur, deal_pipeline.target_price_eur),
            max_offer_eur = COALESCE(excluded.max_offer_eur, deal_pipeline.max_offer_eur),
            won_at = CASE WHEN excluded.status = 'won' THEN COALESCE(deal_pipeline.won_at, datetime('now')) ELSE deal_pipeline.won_at END,
            updated_at = datetime('now')`,
    args: [
      userId, listingId, status,
      fields.note ?? null,
      fields.target_price_eur ?? null,
      fields.max_offer_eur ?? null,
      status,
    ],
  });
}

export async function clearDealStatus(userId: string, listingId: string): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: "DELETE FROM deal_pipeline WHERE user_id = ? AND listing_id = ?",
    args: [userId, listingId],
  });
}

export async function getDealEntry(userId: string, listingId: string): Promise<DealEntry | null> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT * FROM deal_pipeline WHERE user_id = ? AND listing_id = ?",
    args: [userId, listingId],
  });
  return (res.rows[0] as unknown as DealEntry | undefined) ?? null;
}

export async function listDealsByStatus(userId: string): Promise<Record<DealStatus, DealWithListing[]>> {
  const client = await getClient();
  const dealsRes = await client.execute({
    sql: `SELECT d.user_id, d.listing_id, d.status, d.note, d.target_price_eur, d.max_offer_eur,
                 d.price_eur_paid, d.fees_eur, d.price_sold_eur, d.sold_at,
                 d.created_at, d.updated_at
          FROM deal_pipeline d
          WHERE d.user_id = ?
          ORDER BY d.updated_at DESC`,
    args: [userId],
  });
  const deals = dealsRes.rows as unknown as DealEntry[];
  if (deals.length === 0) {
    return { watching: [], to_call: [], negotiating: [], won: [], lost: [] };
  }

  const listingIds = deals.map((d) => d.listing_id);
  const placeholders = listingIds.map(() => "?").join(",");
  const listingsRes = await client.execute({
    sql: `SELECT * FROM listings WHERE id IN (${placeholders})`,
    args: listingIds,
  });
  const listingsMap = new Map(
    (listingsRes.rows as unknown as Listing[]).map((l) => [l.id, l]),
  );

  const empty: Record<DealStatus, DealWithListing[]> = {
    watching: [], to_call: [], negotiating: [], won: [], lost: [],
  };
  for (const d of deals) {
    const listing = listingsMap.get(d.listing_id);
    if (!listing) continue;
    empty[d.status]?.push({ ...d, listing });
  }
  return empty;
}

export async function dealStatusMapForListings(userId: string, listingIds: string[]): Promise<Map<string, DealStatus>> {
  if (listingIds.length === 0) return new Map();
  const client = await getClient();
  const placeholders = listingIds.map(() => "?").join(",");
  const res = await client.execute({
    sql: `SELECT listing_id, status FROM deal_pipeline WHERE user_id = ? AND listing_id IN (${placeholders})`,
    args: [userId, ...listingIds],
  });
  const rows = res.rows as unknown as { listing_id: string; status: DealStatus }[];
  return new Map(rows.map((r) => [r.listing_id, r.status]));
}

// User state (last visit, onboarding) -------------------------------------
export interface UserState {
  user_id: string;
  last_listings_view: string | null;
  last_listings_view_prev: string | null;
  onboarded_at: string | null;
}

export async function getUserState(userId: string): Promise<UserState> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT * FROM user_state WHERE user_id = ?",
    args: [userId],
  });
  return (res.rows[0] as unknown as UserState | undefined) ??
    { user_id: userId, last_listings_view: null, last_listings_view_prev: null, onboarded_at: null };
}

export async function recordListingsView(userId: string): Promise<void> {
  const existing = await getUserState(userId);
  const now = new Date().toISOString();
  const client = await getClient();
  await client.execute({
    sql: `INSERT INTO user_state (user_id, last_listings_view, last_listings_view_prev, onboarded_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            last_listings_view_prev = user_state.last_listings_view,
            last_listings_view = excluded.last_listings_view`,
    args: [userId, now, existing.last_listings_view ?? null, existing.onboarded_at ?? null],
  });
}

export async function markOnboarded(userId: string): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: `INSERT INTO user_state (user_id, onboarded_at) VALUES (?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET onboarded_at = COALESCE(user_state.onboarded_at, datetime('now'))`,
    args: [userId],
  });
}

export async function countFreshListings(sinceIso: string): Promise<number> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT COUNT(*) n FROM listings WHERE fetched_at > ?",
    args: [sinceIso],
  });
  return Number((res.rows[0] as unknown as { n: number }).n);
}

// Garage settings ---------------------------------------------------------
export type { GarageProfile };

export async function getGarageSettings(userId: string): Promise<GarageProfile> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT * FROM garage_settings WHERE user_id = ?",
    args: [userId],
  });
  const row = res.rows[0] as unknown as (GarageProfile & { user_id: string; updated_at: string }) | undefined;
  if (!row) return { ...DEFAULT_GARAGE };
  return {
    transport_eur: Number(row.transport_eur),
    recon_base_eur: Number(row.recon_base_eur),
    recon_per_year_eur: Number(row.recon_per_year_eur),
    recon_per_10k_km_eur: Number(row.recon_per_10k_km_eur),
    prep_ct_eur: Number(row.prep_ct_eur),
    fixed_costs_eur: Number(row.fixed_costs_eur),
    target_margin_eur: Number(row.target_margin_eur),
  };
}

export async function saveGarageSettings(userId: string, profile: GarageProfile): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: `INSERT INTO garage_settings (user_id, transport_eur, recon_base_eur, recon_per_year_eur,
            recon_per_10k_km_eur, prep_ct_eur, fixed_costs_eur, target_margin_eur, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET
            transport_eur = excluded.transport_eur,
            recon_base_eur = excluded.recon_base_eur,
            recon_per_year_eur = excluded.recon_per_year_eur,
            recon_per_10k_km_eur = excluded.recon_per_10k_km_eur,
            prep_ct_eur = excluded.prep_ct_eur,
            fixed_costs_eur = excluded.fixed_costs_eur,
            target_margin_eur = excluded.target_margin_eur,
            updated_at = datetime('now')`,
    args: [
      userId,
      profile.transport_eur,
      profile.recon_base_eur,
      profile.recon_per_year_eur,
      profile.recon_per_10k_km_eur,
      profile.prep_ct_eur,
      profile.fixed_costs_eur,
      profile.target_margin_eur,
    ],
  });
}

// Vehicle checks -----------------------------------------------------------
export interface VehicleCheck {
  id: string;
  user_id: string;
  listing_id: string;
  plate: string | null;
  ct_ok: 0 | 1 | null;
  accident_ok: 0 | 1 | null;
  docs_ok: 0 | 1 | null;
  body_ok: 0 | 1 | null;
  test_drive_ok: 0 | 1 | null;
  owners_count: number | null;
  last_ct_km: number | null;
  last_ct_date: string | null;
  note: string | null;
  updated_at: string;
}

export async function getVehicleCheck(userId: string, listingId: string): Promise<VehicleCheck | null> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT * FROM vehicle_checks WHERE user_id = ? AND listing_id = ?",
    args: [userId, listingId],
  });
  return res.rows[0] ? rowToPlain<VehicleCheck>(res.rows[0]) : null;
}

export async function saveVehicleCheck(userId: string, listingId: string, data: Partial<VehicleCheck>): Promise<void> {
  const id = data.id ?? `vc_${userId.slice(0, 4)}_${listingId.slice(0, 8)}`;
  const client = await getClient();
  await client.execute({
    sql: `INSERT INTO vehicle_checks (id, user_id, listing_id, plate, ct_ok, accident_ok, docs_ok, body_ok, test_drive_ok, owners_count, last_ct_km, last_ct_date, note, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, listing_id) DO UPDATE SET
            plate = COALESCE(excluded.plate, vehicle_checks.plate),
            ct_ok = excluded.ct_ok,
            accident_ok = excluded.accident_ok,
            docs_ok = excluded.docs_ok,
            body_ok = excluded.body_ok,
            test_drive_ok = excluded.test_drive_ok,
            owners_count = COALESCE(excluded.owners_count, vehicle_checks.owners_count),
            last_ct_km = COALESCE(excluded.last_ct_km, vehicle_checks.last_ct_km),
            last_ct_date = COALESCE(excluded.last_ct_date, vehicle_checks.last_ct_date),
            note = excluded.note,
            updated_at = datetime('now')`,
    args: [
      id, userId, listingId,
      data.plate ?? null,
      data.ct_ok ?? null,
      data.accident_ok ?? null,
      data.docs_ok ?? null,
      data.body_ok ?? null,
      data.test_drive_ok ?? null,
      data.owners_count ?? null,
      data.last_ct_km ?? null,
      data.last_ct_date ?? null,
      data.note ?? null,
    ],
  });
}

export async function getSellerActivity(listingId: string): Promise<{ price_changes: number; days_on_market: number }> {
  const client = await getClient();
  const stmts: InStatement[] = [
    {
      sql: "SELECT price_eur, observed_at FROM price_history WHERE listing_id = ? ORDER BY observed_at ASC",
      args: [listingId],
    },
    {
      sql: "SELECT posted_at FROM listings WHERE id = ?",
      args: [listingId],
    },
  ];
  const results = await client.batch(stmts, "read");
  const history = results[0].rows as unknown as { price_eur: number; observed_at: string }[];
  const listingRow = results[1].rows[0] as unknown as { posted_at: string } | undefined;
  const daysOnMarket = listingRow
    ? Math.floor((Date.now() - new Date(listingRow.posted_at).getTime()) / 86_400_000)
    : 0;
  return {
    price_changes: Math.max(0, history.length - 1),
    days_on_market: daysOnMarket,
  };
}

// Purge des annonces trop anciennes ----------------------------------------
/**
 * Supprime les annonces dont la date de dernier scraping est antérieure à
 * `daysOld` jours, à l'exception des sources premium (aramis, bymycar,
 * spoticar) qui sont conservées indéfiniment.
 *
 * @returns Le nombre de lignes supprimées.
 */
export async function purgeOldListings(daysOld = 90): Promise<number> {
  const client = await getClient();
  const cutoff = new Date(Date.now() - daysOld * 86_400_000).toISOString();
  const res = await client.execute({
    sql: `DELETE FROM listings
          WHERE fetched_at < ?
            AND source NOT IN ('aramis', 'bymycar', 'spoticar')`,
    args: [cutoff],
  });
  const deleted = res.rowsAffected ?? 0;
  if (deleted > 0) {
    console.log(`[purge] ${deleted} annonces supprimées (> ${daysOld}j)`);
  }
  return deleted;
}

// Generic raw query helper — use sparingly for complex analytics SQL
export async function rawQuery<T = Record<string, unknown>>(sql: string, args: (string | number | null | boolean)[] = []): Promise<T[]> {
  const client = await getClient();
  const res = await client.execute({ sql, args });
  return res.rows as unknown as T[];
}

// ── Password change ─────────────────────────────────────────────────────────
export async function updatePassword(userId: string, newHash: string): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: "UPDATE users SET password_hash = ? WHERE id = ?",
    args: [newHash, userId],
  });
}

export async function getFreshListingIds(since: string): Promise<Set<string>> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT id FROM listings WHERE fetched_at >= ?",
    args: [since],
  });
  return new Set((res.rows as unknown as { id: string }[]).map((r) => r.id));
}

// ── Listing notes ──────────────────────────────────────────────────────────
export async function setListingNote(userId: string, listingId: string, note: string): Promise<void> {
  const client = await getClient();
  if (!note.trim()) {
    await client.execute({
      sql: "DELETE FROM listing_notes WHERE user_id = ? AND listing_id = ?",
      args: [userId, listingId],
    });
    return;
  }
  await client.execute({
    sql: `INSERT INTO listing_notes (user_id, listing_id, note, updated_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, listing_id) DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at`,
    args: [userId, listingId, note.trim()],
  });
}

export async function getListingNote(userId: string, listingId: string): Promise<string | null> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT note FROM listing_notes WHERE user_id = ? AND listing_id = ?",
    args: [userId, listingId],
  });
  return (res.rows[0] as unknown as { note: string } | undefined)?.note ?? null;
}

// ── Saved searches ─────────────────────────────────────────────────────────
export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  params: string; // JSON string of URLSearchParams
  created_at: string;
}

export async function getSavedSearches(userId: string): Promise<SavedSearch[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT * FROM saved_searches WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
  return res.rows as unknown as SavedSearch[];
}

export async function upsertSavedSearch(userId: string, id: string, name: string, params: string): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: `INSERT INTO saved_searches (id, user_id, name, params) VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name, params = excluded.params`,
    args: [id, userId, name, params],
  });
}

export async function deleteSavedSearch(userId: string, id: string): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: "DELETE FROM saved_searches WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
}

// ── ROI tracking ───────────────────────────────────────────────────────────
export async function updateDealROI(
  userId: string,
  listingId: string,
  data: { price_eur_paid?: number | null; fees_eur?: number; price_sold_eur?: number | null; sold_at?: string | null }
): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: `UPDATE deal_pipeline
          SET price_eur_paid = COALESCE(?, price_eur_paid),
              fees_eur = COALESCE(?, fees_eur),
              price_sold_eur = COALESCE(?, price_sold_eur),
              sold_at = COALESCE(?, sold_at),
              updated_at = datetime('now')
          WHERE user_id = ? AND listing_id = ?`,
    args: [
      data.price_eur_paid ?? null,
      data.fees_eur ?? null,
      data.price_sold_eur ?? null,
      data.sold_at ?? null,
      userId,
      listingId,
    ],
  });
}

export interface ROIStats {
  deals_won: number;
  deals_sold: number;
  total_invested_eur: number;
  total_sold_eur: number;
  total_fees_eur: number;
  total_margin_eur: number;
  avg_margin_eur: number;
}

// ── Notification preferences ────────────────────────────────────────────────
export async function updateNotificationPrefs(
  userId: string,
  prefs: { digest_enabled?: boolean; notif_price_drop?: boolean; notif_listing_gone?: boolean }
): Promise<void> {
  const client = await getClient();
  const sets: string[] = [];
  const args: (number | string)[] = [];
  if (prefs.digest_enabled !== undefined) { sets.push("digest_enabled = ?"); args.push(prefs.digest_enabled ? 1 : 0); }
  if (prefs.notif_price_drop !== undefined) { sets.push("notif_price_drop = ?"); args.push(prefs.notif_price_drop ? 1 : 0); }
  if (prefs.notif_listing_gone !== undefined) { sets.push("notif_listing_gone = ?"); args.push(prefs.notif_listing_gone ? 1 : 0); }
  if (!sets.length) return;
  args.push(userId);
  await client.execute({ sql: `UPDATE users SET ${sets.join(", ")} WHERE id = ?`, args });
}

export async function getROIStats(userId: string): Promise<ROIStats> {
  const client = await getClient();
  const res = await client.execute({
    sql: `SELECT
            COUNT(*) deals_won,
            SUM(CASE WHEN price_sold_eur IS NOT NULL THEN 1 ELSE 0 END) deals_sold,
            COALESCE(SUM(price_eur_paid), 0) total_invested_eur,
            COALESCE(SUM(price_sold_eur), 0) total_sold_eur,
            COALESCE(SUM(fees_eur), 0) total_fees_eur,
            COALESCE(SUM(CASE WHEN price_sold_eur IS NOT NULL THEN price_sold_eur - price_eur_paid - fees_eur ELSE 0 END), 0) total_margin_eur,
            COALESCE(AVG(CASE WHEN price_sold_eur IS NOT NULL THEN price_sold_eur - price_eur_paid - fees_eur ELSE NULL END), 0) avg_margin_eur
          FROM deal_pipeline
          WHERE user_id = ? AND status = 'won'`,
    args: [userId],
  });
  return (res.rows[0] as unknown as ROIStats) ?? {
    deals_won: 0, deals_sold: 0, total_invested_eur: 0,
    total_sold_eur: 0, total_fees_eur: 0, total_margin_eur: 0, avg_margin_eur: 0,
  };
}

// ── Deal activities (journal CRM) ───────────────────────────────────────────
export type DealActivityType = "call" | "offer" | "visit" | "note" | "status_change";

export interface DealActivity {
  id: string;
  user_id: string;
  listing_id: string;
  type: DealActivityType;
  content: string;
  metadata: string | null; // JSON
  created_at: string;
}

export async function addDealActivity(
  userId: string,
  listingId: string,
  type: DealActivityType,
  content: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const client = await getClient();
  const { randomBytes } = await import("node:crypto");
  const id = "act_" + randomBytes(9).toString("hex");
  await client.execute({
    sql: `INSERT INTO deal_activities (id, user_id, listing_id, type, content, metadata)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      id, userId, listingId, type, content,
      metadata ? JSON.stringify(metadata) : null,
    ],
  });
}

export async function getDealActivities(userId: string, listingId: string): Promise<DealActivity[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: `SELECT * FROM deal_activities WHERE user_id = ? AND listing_id = ? ORDER BY created_at DESC`,
    args: [userId, listingId],
  });
  return res.rows as unknown as DealActivity[];
}

export async function deleteDealActivity(userId: string, activityId: string): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: "DELETE FROM deal_activities WHERE id = ? AND user_id = ?",
    args: [activityId, userId],
  });
}

// ── Monthly P&L ─────────────────────────────────────────────────────────────
export interface MonthlyPnL {
  month: string; // YYYY-MM
  deals_won: number;
  deals_sold: number;
  invested_eur: number;
  sold_eur: number;
  margin_eur: number;
}

export async function getMonthlyPnL(userId: string, months = 12): Promise<MonthlyPnL[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: `SELECT
            strftime('%Y-%m', won_at) month,
            COUNT(*) deals_won,
            SUM(CASE WHEN price_sold_eur IS NOT NULL THEN 1 ELSE 0 END) deals_sold,
            COALESCE(SUM(COALESCE(price_eur_paid,0)), 0) invested_eur,
            COALESCE(SUM(COALESCE(price_sold_eur,0)), 0) sold_eur,
            COALESCE(SUM(CASE WHEN price_sold_eur IS NOT NULL
              THEN price_sold_eur - COALESCE(price_eur_paid,0) - COALESCE(fees_eur,0)
              ELSE 0 END), 0) margin_eur
          FROM deal_pipeline
          WHERE user_id = ? AND status = 'won' AND won_at IS NOT NULL
            AND won_at >= datetime('now', ? || ' months')
          GROUP BY month
          ORDER BY month DESC`,
    args: [userId, `-${months}`],
  });
  return res.rows as unknown as MonthlyPnL[];
}

// ── Stocking cost helpers ────────────────────────────────────────────────────
export async function getDaysInStock(userId: string): Promise<Map<string, number>> {
  const client = await getClient();
  const res = await client.execute({
    sql: `SELECT listing_id,
            CAST(julianday('now') - julianday(COALESCE(won_at, created_at)) AS INTEGER) days_in_stock
          FROM deal_pipeline
          WHERE user_id = ? AND status = 'won'`,
    args: [userId],
  });
  const map = new Map<string, number>();
  for (const row of res.rows as unknown as { listing_id: string; days_in_stock: number }[]) {
    map.set(row.listing_id, Number(row.days_in_stock));
  }
  return map;
}

// ── Price drop alerts ────────────────────────────────────────────────────────
export interface PriceDropAlert {
  listing_id: string;
  user_id: string;
  email: string;
  old_price: number;
  new_price: number;
  brand: string;
  model: string;
  url: string;
}

export async function getPendingPriceDropAlerts(since: string): Promise<PriceDropAlert[]> {
  const client = await getClient();
  // Find listings with a price drop since `since`, whose owners have notif_price_drop = 1
  const res = await client.execute({
    sql: `SELECT DISTINCT
            ph_new.listing_id,
            u.id user_id,
            u.email,
            ph_old.price_eur old_price,
            ph_new.price_eur new_price,
            l.brand,
            l.model,
            l.url
          FROM price_history ph_new
          JOIN price_history ph_old ON ph_old.listing_id = ph_new.listing_id
            AND ph_old.observed_at < ph_new.observed_at
          JOIN listings l ON l.id = ph_new.listing_id
          JOIN (
            SELECT DISTINCT sl.user_id, sl.listing_id FROM saved_listings sl
            UNION
            SELECT DISTINCT dp.user_id, dp.listing_id FROM deal_pipeline dp
              WHERE dp.status IN ('watching','to_call','negotiating')
          ) watched ON watched.listing_id = ph_new.listing_id
          JOIN users u ON u.id = watched.user_id AND u.notif_price_drop = 1
          WHERE ph_new.observed_at >= ?
            AND ph_new.price_eur < ph_old.price_eur
          ORDER BY ph_new.observed_at DESC`,
    args: [since],
  });
  return res.rows as unknown as PriceDropAlert[];
}

// ── "Listing disappeared" alerts ─────────────────────────────────────────────
export interface ListingGoneAlert {
  listing_id: string;
  user_id: string;
  email: string;
  brand: string;
  model: string;
  price_eur: number;
}

export async function getListingsGoneForWatching(staleSinceHours = 48): Promise<ListingGoneAlert[]> {
  const client = await getClient();
  const cutoff = new Date(Date.now() - staleSinceHours * 3600_000).toISOString();
  const res = await client.execute({
    sql: `SELECT DISTINCT
            l.id listing_id,
            u.id user_id,
            u.email,
            l.brand,
            l.model,
            l.price_eur
          FROM listings l
          JOIN (
            SELECT DISTINCT sl.user_id, sl.listing_id FROM saved_listings sl
            UNION
            SELECT DISTINCT dp.user_id, dp.listing_id FROM deal_pipeline dp
              WHERE dp.status IN ('watching','to_call','negotiating')
          ) watched ON watched.listing_id = l.id
          JOIN users u ON u.id = watched.user_id AND u.notif_listing_gone = 1
          WHERE l.fetched_at < ?`,
    args: [cutoff],
  });
  return res.rows as unknown as ListingGoneAlert[];
}

// ── Days on market helper ────────────────────────────────────────────────────
export function daysOnMarket(listing: { first_seen_at?: string | null; posted_at?: string }): number {
  const ref = listing.first_seen_at ?? listing.posted_at;
  if (!ref) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000));
}
