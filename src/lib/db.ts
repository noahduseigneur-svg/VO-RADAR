import { createClient, type Client, type InStatement, type InValue } from "@libsql/client";
import type { Listing, AlertRule, User } from "./types";
import { generateSeedListings } from "./seed";
import { type GarageProfile, DEFAULT_PROFILE as DEFAULT_GARAGE } from "./margin";

let initPromise: Promise<Client> | null = null;

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
  `);

  // Migrations additives — ignorent l'erreur "duplicate column" si déjà appliquées
  await client.execute({
    sql: "ALTER TABLE users ADD COLUMN digest_enabled INTEGER NOT NULL DEFAULT 1",
    args: [],
  }).catch(() => {});
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
        postal_code, region, photos_count, posted_at, fetched_at,
        market_value_eur, delta_eur, delta_pct, score,
        engine_rating, critair, comparables_n, comparables_median_eur
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )
      ON CONFLICT(source, source_id) DO UPDATE SET
        price_eur = excluded.price_eur,
        mileage_km = excluded.mileage_km,
        fetched_at = excluded.fetched_at,
        market_value_eur = excluded.market_value_eur,
        delta_eur = excluded.delta_eur,
        delta_pct = excluded.delta_pct,
        score = excluded.score,
        engine_rating = excluded.engine_rating,
        critair = excluded.critair,
        comparables_n = excluded.comparables_n,
        comparables_median_eur = excluded.comparables_median_eur`,
      args: [
        r.id, r.source, r.source_id, r.url, r.title, r.brand, r.model,
        r.version ?? null, r.engine_designation ?? null, r.body_type,
        r.year, r.mileage_km, r.fuel, r.gearbox, r.power_hp ?? null,
        r.price_eur, r.seller_kind, r.postal_code ?? null, r.region ?? null,
        r.photos_count, r.posted_at, r.fetched_at,
        r.market_value_eur, r.delta_eur, r.delta_pct, r.score,
        r.engine_rating, r.critair, r.comparables_n, r.comparables_median_eur ?? null,
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
  search?: string;
  body_type?: string;
  hide_risky_engines?: boolean;
  max_critair?: number;
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
  return res.rows as unknown as Listing[];
}

export async function getDistinctRegions(): Promise<string[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT DISTINCT region FROM listings WHERE region IS NOT NULL AND region != '' ORDER BY region",
    args: [],
  });
  return (res.rows as unknown as { region: string }[]).map((r) => r.region);
}

export async function getListing(id: string): Promise<Listing | null> {
  const client = await getClient();
  const res = await client.execute({ sql: "SELECT * FROM listings WHERE id = ?", args: [id] });
  return (res.rows[0] as unknown as Listing | undefined) ?? null;
}

export async function getBrands(): Promise<string[]> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT DISTINCT brand FROM listings ORDER BY brand",
    args: [],
  });
  return (res.rows as unknown as { brand: string }[]).map((r) => r.brand);
}

export async function getSavedListingIds(userId: string): Promise<Set<string>> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT listing_id FROM saved_listings WHERE user_id = ?",
    args: [userId],
  });
  return new Set((res.rows as unknown as { listing_id: string }[]).map((r) => r.listing_id));
}

export async function countFreshSince(since: string): Promise<number> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT COUNT(*) n FROM listings WHERE fetched_at > ?",
    args: [since],
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
    { sql: "SELECT COUNT(*) n FROM listings", args: [] },
    { sql: "SELECT COUNT(*) n FROM listings WHERE posted_at > datetime('now','-24 hours')", args: [] },
    { sql: "SELECT COUNT(*) n FROM listings WHERE score >= 80", args: [] },
    { sql: "SELECT COALESCE(AVG(score),0) a FROM listings", args: [] },
    { sql: "SELECT brand, COUNT(*) n FROM listings GROUP BY brand ORDER BY n DESC LIMIT 8", args: [] },
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
  return res.rows as unknown as Listing[];
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
    sql: `INSERT INTO alert_rules (id, user_id, name, brand, model, max_price_eur, max_mileage_km, min_year, fuel, min_score, region, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      rule.id, rule.user_id, rule.name,
      rule.brand ?? null, rule.model ?? null,
      rule.max_price_eur ?? null, rule.max_mileage_km ?? null,
      rule.min_year ?? null, rule.fuel ?? null,
      rule.min_score, rule.region ?? null, rule.active,
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
  return res.rows as unknown as Listing[];
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
    sql: `INSERT INTO deal_pipeline (user_id, listing_id, status, note, target_price_eur, max_offer_eur, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, listing_id) DO UPDATE SET
            status = excluded.status,
            note = COALESCE(excluded.note, deal_pipeline.note),
            target_price_eur = COALESCE(excluded.target_price_eur, deal_pipeline.target_price_eur),
            max_offer_eur = COALESCE(excluded.max_offer_eur, deal_pipeline.max_offer_eur),
            updated_at = datetime('now')`,
    args: [
      userId, listingId, status,
      fields.note ?? null,
      fields.target_price_eur ?? null,
      fields.max_offer_eur ?? null,
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
    sql: `SELECT d.user_id, d.listing_id, d.status, d.note, d.target_price_eur, d.max_offer_eur, d.created_at, d.updated_at
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
  return (res.rows[0] as unknown as VehicleCheck | undefined) ?? null;
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

// Generic raw query helper — use sparingly for complex analytics SQL
export async function rawQuery<T = Record<string, unknown>>(sql: string, args: (string | number | null | boolean)[] = []): Promise<T[]> {
  const client = await getClient();
  const res = await client.execute({ sql, args });
  return res.rows as unknown as T[];
}

export async function getFreshListingIds(since: string): Promise<Set<string>> {
  const client = await getClient();
  const res = await client.execute({
    sql: "SELECT id FROM listings WHERE fetched_at >= ?",
    args: [since],
  });
  return new Set((res.rows as unknown as { id: string }[]).map((r) => r.id));
}
