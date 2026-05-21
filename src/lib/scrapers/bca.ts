import type { Scraper, RawListing } from "./types";
import type { BodyType } from "../types";
import { sleep, mapFuel, mapGearbox } from "./json-ld-dealer";

// BCA (British Car Auctions) France — principal portail d'enchères B2B pour les
// professionnels VO. Requiert un compte dealer actif.
//
// Variables d'environnement nécessaires :
//   BCA_EMAIL    — email du compte dealer BCA
//   BCA_PASSWORD — mot de passe
//   BCA_COUNTRY  — code pays (défaut : "FR")
//   BCA_PAGE_SIZE — nb de lots par page (défaut : 100, max : 200)
//
// Si BCA_EMAIL/BCA_PASSWORD ne sont pas définis, le scraper retourne []
// silencieusement (pas d'erreur).
//
// Architecture BCA :
//   Auth  : POST /en_FR/account/login.json → Set-Cookie (session)
//   Search: GET  /en_FR/buy-with-us/search.json?... → { vehicles: [...] }
//   Detail: GET  /en_FR/buy-with-us/vehicle/{id}.json → lot complet
//
// Note : bca.com est derrière Cloudflare. L'accès direct avec un compte
// dealer valide fonctionne en production. Si Cloudflare bloque, configurer
// BCA_PROXY (ex: "http://proxy:3128") pour un proxy résidentiel.

const BASE = process.env.BCA_BASE_URL ?? "https://www.bca.com";
const COUNTRY = process.env.BCA_COUNTRY ?? "FR";
const LOCALE = `en_${COUNTRY}`;
const PAGE_SIZE = Math.min(Number(process.env.BCA_PAGE_SIZE ?? 100), 200);
const CRAWL_DELAY = Number(process.env.BCA_CRAWL_DELAY_MS ?? 4000);

const UA = process.env.SCRAPER_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// ─── Session Management ───────────────────────────────────────────────────

let sessionCookies: string = "";
let sessionExpiresAt: number = 0;

async function fetchWithSession(url: string, opts: RequestInit = {}): Promise<Response> {
  const proxy = process.env.BCA_PROXY;
  // Node 18+ native fetch; proxy support via undici or HTTPS_PROXY env
  if (proxy) process.env.HTTPS_PROXY = proxy;

  return fetch(url, {
    ...opts,
    headers: {
      "User-Agent": UA,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      "Cookie": sessionCookies,
      "Referer": `${BASE}/${LOCALE}/buy-with-us/search/`,
      "X-Requested-With": "XMLHttpRequest",
      ...(opts.headers ?? {}),
    },
  });
}

async function extractSetCookies(res: Response): Promise<string> {
  const raw = res.headers.get("set-cookie") ?? "";
  // Flatten multiple Set-Cookie headers into a single Cookie string
  return raw.split(/,(?=[a-zA-Z_]+[^;]*=)/).map((c) => c.split(";")[0].trim()).join("; ");
}

async function authenticate(): Promise<boolean> {
  const email = process.env.BCA_EMAIL;
  const password = process.env.BCA_PASSWORD;
  if (!email || !password) return false;

  // BCA uses a form POST for login (server-rendered + JSON endpoint)
  const loginUrl = `${BASE}/${LOCALE}/account/login.json`;
  const body = new URLSearchParams({ email, password, rememberMe: "false" });

  try {
    const res = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "Referer": `${BASE}/${LOCALE}/account/login/`,
      },
      body: body.toString(),
      redirect: "manual",
    });

    const cookies = await extractSetCookies(res);
    if (!cookies) {
      // Some BCA regions use a different login flow (redirect-based)
      console.warn("[bca] Login returned no cookies — trying redirect flow");
      return false;
    }

    // Verify we actually logged in by checking for session cookie presence
    if (!cookies.includes("BCAsessionid") && !cookies.includes("JSESSIONID") &&
        !cookies.includes("bca_session") && !cookies.includes("auth")) {
      const json = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (json.success === false || json.error) {
        console.error("[bca] Login failed:", json.error ?? json.message ?? "unknown");
        return false;
      }
    }

    sessionCookies = cookies;
    sessionExpiresAt = Date.now() + 55 * 60 * 1000; // refresh every 55 min
    console.log("[bca] Authenticated ✓");
    return true;
  } catch (err) {
    console.error("[bca] Auth error:", err);
    return false;
  }
}

async function ensureSession(): Promise<boolean> {
  if (sessionCookies && Date.now() < sessionExpiresAt) return true;
  return authenticate();
}

// ─── Vehicle Parsing ──────────────────────────────────────────────────────

interface BcaVehicle {
  vehicleId?: string;
  lotId?: string;
  vin?: string;
  registrationNumber?: string;
  make?: string;
  manufacturer?: string;
  model?: string;
  derivative?: string;
  variant?: string;
  bodyStyle?: string;
  fuelType?: string;
  transmission?: string;
  engineSize?: string;
  powerBhp?: number | string;
  powerKw?: number | string;
  mileage?: number | string;
  odometerReading?: number | string;
  registrationYear?: number | string;
  registrationDate?: string;
  firstRegistrationDate?: string;
  colour?: string;
  startingBid?: number | string;
  estimateHigh?: number | string;
  estimateLow?: number | string;
  buyNowPrice?: number | string;
  auctionDate?: string;
  saleDate?: string;
  location?: string;
  centre?: string;
  saleLocation?: string;
  salesCentre?: string;
  vehicleUrl?: string;
  images?: string[] | { url: string }[];
}

function parseNum(v: number | string | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.]/g, ""));
  return isNaN(n) || n <= 0 ? null : n;
}

function extractYear(v: BcaVehicle): number {
  if (v.registrationYear) {
    const y = Number(v.registrationYear);
    if (y > 1990 && y <= new Date().getFullYear() + 1) return y;
  }
  for (const d of [v.registrationDate, v.firstRegistrationDate]) {
    if (d) {
      const y = Number(d.slice(0, 4));
      if (y > 1990 && y <= new Date().getFullYear() + 1) return y;
    }
  }
  return new Date().getFullYear();
}

function extractPrice(v: BcaVehicle): number {
  // BCA shows start bid, buy-now, or estimate. Prefer buy-now or start bid.
  const buyNow = parseNum(v.buyNowPrice);
  if (buyNow && buyNow > 500) return buyNow;
  const start = parseNum(v.startingBid);
  if (start && start > 500) return start;
  const hi = parseNum(v.estimateHigh);
  const lo = parseNum(v.estimateLow);
  if (hi && lo) return Math.round((hi + lo) / 2);
  if (hi) return hi;
  if (lo) return lo;
  return 0; // pricing engine will estimate from market value
}

function extractPower(v: BcaVehicle): number | null {
  const bhp = parseNum(v.powerBhp);
  if (bhp && bhp > 30 && bhp < 1500) return Math.round(bhp);
  const kw = parseNum(v.powerKw);
  if (kw && kw > 20) return Math.round(kw * 1.34102); // kW → ch
  // Fallback: try to extract from engine size or derivative text
  const text = `${v.derivative ?? ""} ${v.variant ?? ""}`;
  const m = text.match(/(\d{3})\s*(?:ch|bhp|hp)\b/i);
  return m ? Number(m[1]) : null;
}

function extractRegion(v: BcaVehicle): string | null {
  const loc = v.location ?? v.centre ?? v.saleLocation ?? v.salesCentre ?? null;
  return loc ? String(loc).trim() : null;
}

function mapBodyStyle(raw: string | undefined): BodyType {
  if (!raw) return "inconnu";
  const v = raw.toLowerCase();
  if (v.includes("suv") || v.includes("4x4") || v.includes("crossover")) return "suv";
  if (v.includes("break") || v.includes("estate") || v.includes("touring")) return "break";
  if (v.includes("cabriolet") || v.includes("convertible") || v.includes("roadster")) return "cabriolet";
  if (v.includes("coupé") || v.includes("coupe")) return "coupe";
  if (v.includes("monospace") || v.includes("mpv") || v.includes("van")) return "monospace";
  if (v.includes("citadine") || v.includes("hatchback") || v.includes("5-door") || v.includes("3-door")) return "citadine";
  if (v.includes("berline") || v.includes("saloon") || v.includes("sedan")) return "berline";
  return "inconnu";
}

function adaptVehicle(v: BcaVehicle): RawListing | null {
  const id = v.vehicleId ?? v.lotId ?? v.vin;
  if (!id) return null;

  const brand = (v.make ?? v.manufacturer ?? "").trim();
  const model = (v.model ?? "").trim();
  if (!brand || !model) return null;

  const version = v.derivative ?? v.variant ?? null;
  const mileage = parseNum(v.mileage ?? v.odometerReading) ?? 0;
  const price = extractPrice(v);
  const year = extractYear(v);

  return {
    id: `bca-${id}`,
    source: "bca",
    source_id: String(id),
    url: v.vehicleUrl ? (v.vehicleUrl.startsWith("http") ? v.vehicleUrl : `${BASE}${v.vehicleUrl}`) : `${BASE}/${LOCALE}/buy-with-us/search/`,
    title: `${brand} ${model}${version ? ` ${version}` : ""}`,
    brand,
    model,
    version,
    engine_designation: null,
    body_type: mapBodyStyle(v.bodyStyle),
    year,
    mileage_km: Math.round(mileage),
    fuel: mapFuel(v.fuelType ?? null),
    gearbox: mapGearbox(v.transmission ?? null),
    power_hp: extractPower(v),
    price_eur: Math.round(price),
    seller_kind: "pro",
    postal_code: null,
    region: extractRegion(v),
    photos_count: Array.isArray(v.images) ? v.images.length : 0,
    photo_url: (() => {
      if (!Array.isArray(v.images) || v.images.length === 0) return null;
      const first = v.images[0];
      if (typeof first === 'string') return first;
      if (typeof first === 'object' && first !== null) return (first as { url: string }).url ?? null;
      return null;
    })(),
    posted_at: v.auctionDate ?? v.saleDate ?? new Date().toISOString(),
  };
}

// ─── Main Fetch ───────────────────────────────────────────────────────────

async function fetchPage(page: number): Promise<BcaVehicle[]> {
  const url = `${BASE}/${LOCALE}/buy-with-us/search.json?` + new URLSearchParams({
    country: COUNTRY,
    pageSize: String(PAGE_SIZE),
    pageNumber: String(page),
    sortOrder: "saleDate_asc",
    vehicleType: "Car",
  }).toString();

  const res = await fetchWithSession(url);

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      // Session expired — try re-auth
      sessionCookies = "";
      sessionExpiresAt = 0;
      const ok = await authenticate();
      if (!ok) return [];
      return fetchPage(page);
    }
    console.warn(`[bca] Page ${page} → HTTP ${res.status}`);
    return [];
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("json")) return []; // got HTML (login wall or Cloudflare)

  const json = await res.json() as {
    vehicles?: BcaVehicle[];
    lots?: BcaVehicle[];
    results?: BcaVehicle[];
    data?: { vehicles?: BcaVehicle[] };
    totalPages?: number;
    totalResults?: number;
  };

  return json.vehicles ?? json.lots ?? json.results ?? json.data?.vehicles ?? [];
}

async function fetchBca(opts: { sinceHours?: number; limit?: number }): Promise<RawListing[]> {
  if (!process.env.BCA_EMAIL || !process.env.BCA_PASSWORD) {
    // No credentials — log once and return empty
    if (!bcaNoCredsWarned) {
      console.info("[bca] Skipped — set BCA_EMAIL + BCA_PASSWORD to enable this source");
      bcaNoCredsWarned = true;
    }
    return [];
  }

  const ok = await ensureSession();
  if (!ok) {
    console.error("[bca] Cannot authenticate — skipping this run");
    return [];
  }

  const maxListings = opts.limit ?? 500;
  const results: RawListing[] = [];

  for (let page = 1; results.length < maxListings; page++) {
    const vehicles = await fetchPage(page);
    if (vehicles.length === 0) break;

    for (const v of vehicles) {
      const listing = adaptVehicle(v);
      if (listing) results.push(listing);
    }

    if (vehicles.length < PAGE_SIZE) break; // last page
    if (results.length >= maxListings) break;

    await sleep(CRAWL_DELAY);
  }

  console.log(`[bca] Fetched ${results.length} lots`);
  return results;
}

let bcaNoCredsWarned = false;

export const bcaScraper: Scraper = {
  name: "bca",
  fetch: fetchBca,
};
