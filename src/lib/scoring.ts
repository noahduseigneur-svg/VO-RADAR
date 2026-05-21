import type { Listing, SellerKind, Fuel, BodyType, ReliabilityRating, CritAirClass } from "./types";
import { identifyEngine, type EngineProfile } from "./reliability";
import { evaluateCritAir } from "./critair";
import { detectBodyType, bodyTrend } from "./bodywork";
import { assessMileage, type ComparablesResult, type MileageAssessment } from "./comparables";

// Scoring v2 — multi-critères, intransigeant, explicable.
// Combine :
//   - Delta prix vs cote modèle (±50)
//   - Delta prix vs comparables réels (±20)
//   - Fiabilité moteur (-25 à +12)
//   - Crit'Air / ZFE (-12 à +2)
//   - Type carrosserie + tendance (-3 à +5)
//   - Anomalie kilométrage (-8 à +3)
//   - Vendeur particulier vs pro (+12 si particulier)
//   - Fraîcheur (±15)
//   - Complétude annonce (-8 si <3 photos)
//
// Score 0..100, où 50 = neutre. Chaque facteur contribue explicitement →
// breakdown visible côté UI ("Pourquoi ce score ?").

export interface ScoreFactor {
  label: string;
  delta: number;     // contribution au score
  detail?: string;
}

export interface ScoreBreakdown {
  score: number;
  factors: ScoreFactor[];
}

export interface ScoringContext {
  market_value_eur: number;
  market_confidence: "calibrated" | "fallback";
  comparables?: ComparablesResult;
  body_type?: BodyType;
  mileage_assessment?: MileageAssessment;
}

export function scoreListingFull(
  args: {
    brand: string;
    model: string;
    version: string | null;
    engine_designation: string | null;
    price_eur: number;
    seller_kind: SellerKind;
    posted_at: string;
    photos_count: number;
    mileage_km: number;
    year: number;
    fuel: Fuel;
  },
  ctx: ScoringContext,
): ScoreBreakdown & {
  market_value_eur: number;
  delta_eur: number;
  delta_pct: number;
  engine_rating: ReliabilityRating;
  engine_profile_id: string | null;
  critair: CritAirClass;
  body_type: BodyType;
  comparables_median_eur: number | null;
  comparables_n: number;
} {
  const factors: ScoreFactor[] = [];

  // --- 1. Delta prix vs cote modèle ---
  const delta_eur = ctx.market_value_eur - args.price_eur;
  const delta_pct = delta_eur / ctx.market_value_eur;

  let priceDelta = 0;
  if (ctx.market_confidence === "calibrated") {
    priceDelta = Math.max(-50, Math.min(50, (delta_pct / 0.30) * 50));
    factors.push({
      label: priceDelta > 0 ? "Sous-côté vs cote" : "Surcoté vs cote",
      delta: Math.round(priceDelta),
      detail: `${delta_pct > 0 ? "+" : ""}${(delta_pct * 100).toFixed(1)}% vs cote estimée ${ctx.market_value_eur.toLocaleString("fr-FR")} €`,
    });
  } else {
    factors.push({
      label: "Cote non calibrée",
      delta: 0,
      detail: "Modèle pas dans la base de cote interne — score neutre sur le prix",
    });
  }

  // --- 2. Delta prix vs comparables réels ---
  let comparablesDelta = 0;
  if (ctx.comparables && ctx.comparables.median_eur && ctx.comparables.n >= 3) {
    const c_delta = (ctx.comparables.median_eur - args.price_eur) / ctx.comparables.median_eur;
    const weight = ctx.comparables.confidence === "high" ? 20 : ctx.comparables.confidence === "medium" ? 12 : 6;
    comparablesDelta = Math.max(-weight, Math.min(weight, (c_delta / 0.20) * weight));
    factors.push({
      label: comparablesDelta > 0 ? "Moins cher que des comparables réels" : "Plus cher que des comparables réels",
      delta: Math.round(comparablesDelta),
      detail: `${ctx.comparables.n} annonces similaires, médiane ${ctx.comparables.median_eur.toLocaleString("fr-FR")} € (P25-P75 : ${ctx.comparables.p25_eur?.toLocaleString("fr-FR")} – ${ctx.comparables.p75_eur?.toLocaleString("fr-FR")} €)`,
    });
  }

  // --- 3. Fiabilité moteur ---
  const eng = identifyEngine(args.brand, args.model, args.version, args.engine_designation);
  if (eng.profile) {
    factors.push({
      label: ratingLabel(eng.rating, eng.profile),
      delta: eng.score_adjustment,
      detail: eng.profile.issues[0] ?? eng.profile.notes ?? "",
    });
  }

  // --- 4. Crit'Air / ZFE ---
  const zfe = evaluateCritAir(args.fuel, args.year);
  if (zfe.score_adjustment !== 0) {
    factors.push({
      label: zfe.score_adjustment > 0 ? `${zfe.label} — ZFE OK partout` : `${zfe.label} — restrictions ZFE`,
      delta: zfe.score_adjustment,
      detail: zfe.resale_warning ?? "",
    });
  }

  // --- 5. Type carrosserie + tendance marché ---
  const body = ctx.body_type ?? detectBodyType(args.model, `${args.brand} ${args.model}`, args.version);
  const trend = bodyTrend(body, args.fuel);
  if (trend.score_adjustment !== 0) {
    factors.push({
      label: `Carrosserie ${body} : ${trend.velocity === "fast" ? "rotation rapide" : trend.velocity === "slow" ? "rotation lente" : "demande normale"}`,
      delta: trend.score_adjustment,
      detail: trend.note,
    });
  }

  // --- 6. Anomalie kilométrage ---
  const km = ctx.mileage_assessment ?? assessMileage(args.year, args.mileage_km);
  if (km.score_adjustment !== 0) {
    factors.push({
      label: km.status === "suspicious_low" ? "Kilométrage suspect" :
             km.status === "very_high" ? "Kilométrage très élevé" :
             km.status === "high" ? "Kilométrage au-dessus moyenne" :
             "Kilométrage faible",
      delta: km.score_adjustment,
      detail: km.note,
    });
  }

  // --- 7. Type de vendeur ---
  if (args.seller_kind === "particulier") {
    factors.push({ label: "Vendeur particulier", delta: +12, detail: "Pas de marge marchand baked-in" });
  }

  // --- 8. Fraîcheur de l'annonce ---
  const hoursOld = (Date.now() - new Date(args.posted_at).getTime()) / 36e5;
  const freshness = Math.max(0, Math.min(1, 1 - hoursOld / 48)) * 15;
  if (freshness >= 3) {
    factors.push({
      label: hoursOld < 6 ? "Annonce très récente" : "Annonce récente",
      delta: Math.round(freshness),
      detail: `Publiée il y a ${Math.round(hoursOld)} h`,
    });
  }

  // --- 9. Complétude annonce ---
  if (args.photos_count < 3) {
    factors.push({ label: "Peu de photos", delta: -8, detail: `${args.photos_count} photo(s) — vendeur cache potentiellement quelque chose` });
  }

  // --- Calcul final ---
  const raw = 50 + factors.reduce((s, f) => s + f.delta, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    score,
    factors,
    market_value_eur: ctx.market_value_eur,
    delta_eur: Math.round(delta_eur),
    delta_pct: Math.round(delta_pct * 1000) / 10,
    engine_rating: eng.rating,
    engine_profile_id: eng.profile?.id ?? null,
    critair: zfe.critair,
    body_type: body,
    comparables_median_eur: ctx.comparables?.median_eur ?? null,
    comparables_n: ctx.comparables?.n ?? 0,
  };
}

function ratingLabel(rating: ReliabilityRating, p: EngineProfile): string {
  switch (rating) {
    case "excellent": return `Moteur fiable ✓ (${p.id.split("-").slice(0, 2).join(" ")})`;
    case "good":      return "Moteur fiable";
    case "average":   return "Moteur correct";
    case "risky":     return "Moteur à surveiller ⚠";
    case "avoid":     return "Moteur à risque ✕";
    default:          return "Moteur inconnu";
  }
}

// API compatible avec l'ancien enrichListing pour le pipeline
export function enrichListing<T extends Omit<Listing, "market_value_eur" | "delta_eur" | "delta_pct" | "score" | "engine_rating" | "critair" | "body_type" | "comparables_n" | "comparables_median_eur">>(
  base: T,
  marketValue: number,
  marketConfidence: "calibrated" | "fallback",
  comparables?: ComparablesResult,
): Listing {
  const out = scoreListingFull(
    {
      brand: base.brand,
      model: base.model,
      version: base.version,
      engine_designation: base.engine_designation,
      price_eur: base.price_eur,
      seller_kind: base.seller_kind,
      posted_at: base.posted_at,
      photos_count: base.photos_count,
      mileage_km: base.mileage_km,
      year: base.year,
      fuel: base.fuel,
    },
    {
      market_value_eur: marketValue,
      market_confidence: marketConfidence,
      comparables,
    },
  );
  return {
    ...base,
    market_value_eur: out.market_value_eur,
    delta_eur: out.delta_eur,
    delta_pct: out.delta_pct,
    score: out.score,
    engine_rating: out.engine_rating,
    critair: out.critair,
    body_type: out.body_type,
    comparables_n: out.comparables_n,
    comparables_median_eur: out.comparables_median_eur,
  };
}

// ── Scoring motos ─────────────────────────────────────────────────────────────
// Facteurs pertinents pour une moto (pas de Crit'Air, fiabilité, carrosserie voiture)
// Délégue sur les comparables kNN + kilométrage + vendeur + fraîcheur + photos.

export function scoreMotoListing(
  args: {
    price_eur: number;
    seller_kind: SellerKind;
    posted_at: string;
    photos_count: number;
    mileage_km: number;
    year: number;
  },
  ctx: {
    market_value_eur: number;
    market_confidence: "calibrated" | "fallback";
    comparables?: ComparablesResult;
  },
): { score: number; market_value_eur: number; delta_eur: number; delta_pct: number; comparables_n: number; comparables_median_eur: number | null } {
  const factors: ScoreFactor[] = [];

  // 1. Delta prix vs cote/comparables
  const delta_eur = ctx.market_value_eur - args.price_eur;
  const delta_pct = ctx.market_value_eur > 0 ? delta_eur / ctx.market_value_eur : 0;

  if (ctx.market_confidence === "calibrated") {
    const priceDelta = Math.max(-40, Math.min(40, (delta_pct / 0.30) * 40));
    factors.push({
      label: priceDelta > 0 ? "Sous-côté vs comparables" : "Surcoté vs comparables",
      delta: Math.round(priceDelta),
      detail: `${delta_pct > 0 ? "+" : ""}${(delta_pct * 100).toFixed(1)}% vs médiane ${ctx.market_value_eur.toLocaleString("fr-FR")} €`,
    });
  }

  // 2. Delta vs comparables réels (kNN)
  if (ctx.comparables && ctx.comparables.median_eur && ctx.comparables.n >= 3) {
    const c_delta = (ctx.comparables.median_eur - args.price_eur) / ctx.comparables.median_eur;
    const weight = ctx.comparables.confidence === "high" ? 20 : ctx.comparables.confidence === "medium" ? 14 : 7;
    const compDelta = Math.max(-weight, Math.min(weight, (c_delta / 0.20) * weight));
    factors.push({
      label: compDelta > 0 ? "Moins cher que des motos similaires" : "Plus cher que des motos similaires",
      delta: Math.round(compDelta),
      detail: `${ctx.comparables.n} motos similaires, médiane ${ctx.comparables.median_eur.toLocaleString("fr-FR")} €`,
    });
  }

  // 3. Kilométrage (motos : < 20k km = faible, > 50k = élevé)
  const avgKmPerYear = args.mileage_km / Math.max(1, new Date().getFullYear() - args.year + 1);
  if (avgKmPerYear < 4000 && args.mileage_km < 20000) {
    factors.push({ label: "Kilométrage très faible", delta: +6, detail: `${args.mileage_km.toLocaleString("fr-FR")} km` });
  } else if (avgKmPerYear > 15000 || args.mileage_km > 60000) {
    factors.push({ label: "Kilométrage élevé", delta: -6, detail: `${args.mileage_km.toLocaleString("fr-FR")} km` });
  }

  // 4. Vendeur particulier
  if (args.seller_kind === "particulier") {
    factors.push({ label: "Vendeur particulier", delta: +10, detail: "Pas de marge marchand" });
  }

  // 5. Fraîcheur
  const hoursOld = (Date.now() - new Date(args.posted_at).getTime()) / 36e5;
  const freshness = Math.max(0, Math.min(1, 1 - hoursOld / 48)) * 12;
  if (freshness >= 3) {
    factors.push({
      label: hoursOld < 6 ? "Annonce très récente" : "Annonce récente",
      delta: Math.round(freshness),
      detail: `Publiée il y a ${Math.round(hoursOld)} h`,
    });
  }

  // 6. Photos
  if (args.photos_count < 3) {
    factors.push({ label: "Peu de photos", delta: -8, detail: `${args.photos_count} photo(s)` });
  }

  const raw = 50 + factors.reduce((s, f) => s + f.delta, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    score,
    market_value_eur: ctx.market_value_eur,
    delta_eur: Math.round(delta_eur),
    delta_pct: Math.round(delta_pct * 1000) / 10,
    comparables_n: ctx.comparables?.n ?? 0,
    comparables_median_eur: ctx.comparables?.median_eur ?? null,
  };
}

export function enrichMotoListing<T extends Omit<Listing, "market_value_eur" | "delta_eur" | "delta_pct" | "score" | "engine_rating" | "critair" | "body_type" | "comparables_n" | "comparables_median_eur">>(
  base: T,
  marketValue: number,
  marketConfidence: "calibrated" | "fallback",
  comparables?: ComparablesResult,
): Listing {
  const out = scoreMotoListing(
    {
      price_eur: base.price_eur,
      seller_kind: base.seller_kind,
      posted_at: base.posted_at,
      photos_count: base.photos_count,
      mileage_km: base.mileage_km,
      year: base.year,
    },
    { market_value_eur: marketValue, market_confidence: marketConfidence, comparables },
  );
  return {
    ...base,
    market_value_eur: out.market_value_eur,
    delta_eur: out.delta_eur,
    delta_pct: out.delta_pct,
    score: out.score,
    engine_rating: "unknown" as ReliabilityRating,
    critair: "NC" as unknown as CritAirClass,
    body_type: "inconnu" as BodyType,
    comparables_n: out.comparables_n,
    comparables_median_eur: out.comparables_median_eur,
  };
}
