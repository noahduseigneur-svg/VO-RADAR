import { rawQuery } from "./db";
import type { Listing } from "./types";

// Trouve les annonces comparables en DB pour un listing donné, et calcule
// la médiane + p25/p75. C'est la "vérité terrain" la plus solide :
// le modèle de cote théorique ne vaut rien à côté de 5 annonces similaires
// vraiment publiées.

export interface ComparablesResult {
  n: number;
  median_eur: number | null;
  p25_eur: number | null;
  p75_eur: number | null;
  confidence: "high" | "medium" | "low";
  comparables: Listing[];
}

interface FindOptions {
  brand: string;
  model: string;
  year: number;
  mileage_km: number;
  fuel: string;
  excludeId?: string;
}

export async function findComparables(opts: FindOptions, limit = 10): Promise<ComparablesResult> {
  // Recherche élargie progressive : on commence strict puis on relâche.
  const tiers = [
    { yearTol: 1, kmTolPct: 0.20, sameFuel: true },
    { yearTol: 2, kmTolPct: 0.30, sameFuel: true },
    { yearTol: 3, kmTolPct: 0.40, sameFuel: false },
  ];

  for (const tier of tiers) {
    const minKm = Math.max(0, Math.floor(opts.mileage_km * (1 - tier.kmTolPct)));
    const maxKm = Math.ceil(opts.mileage_km * (1 + tier.kmTolPct));
    const minYear = opts.year - tier.yearTol;
    const maxYear = opts.year + tier.yearTol;

    const sql = `
      SELECT * FROM listings
      WHERE brand = ?
        AND model = ?
        AND year BETWEEN ? AND ?
        AND mileage_km BETWEEN ? AND ?
        ${tier.sameFuel ? "AND fuel = ?" : ""}
        ${opts.excludeId ? "AND id != ?" : ""}
      ORDER BY ABS(year - ?) ASC, ABS(mileage_km - ?) ASC
      LIMIT ?
    `;
    const args: (string | number | null)[] = [
      opts.brand,
      opts.model,
      minYear, maxYear,
      minKm, maxKm,
    ];
    if (tier.sameFuel) args.push(opts.fuel);
    if (opts.excludeId) args.push(opts.excludeId);
    args.push(opts.year, opts.mileage_km, limit);

    const rows = await rawQuery<Listing>(sql, args);

    if (rows.length >= 3) {
      const prices = rows.map((r) => r.price_eur).sort((a, b) => a - b);
      const confidence: "high" | "medium" | "low" =
        rows.length >= 6 ? "high" : rows.length >= 3 ? "medium" : "low";
      return {
        n: rows.length,
        median_eur: percentile(prices, 0.50),
        p25_eur: percentile(prices, 0.25),
        p75_eur: percentile(prices, 0.75),
        confidence,
        comparables: rows,
      };
    }
  }

  return { n: 0, median_eur: null, p25_eur: null, p75_eur: null, confidence: "low", comparables: [] };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

// Détecte si le kilométrage est anormal vs l'âge.
export interface MileageAssessment {
  expected_km: number;
  delta_km: number;
  delta_pct: number;
  status: "low" | "normal" | "high" | "suspicious_low" | "very_high";
  score_adjustment: number;
  note: string;
}

const KM_PER_YEAR = 13000;

export function assessMileage(year: number, mileage_km: number): MileageAssessment {
  const age = Math.max(0.5, new Date().getFullYear() - year);
  const expected = age * KM_PER_YEAR;
  const delta = mileage_km - expected;
  const pct = delta / expected;

  if (pct < -0.65) {
    return {
      expected_km: expected, delta_km: delta, delta_pct: Math.round(pct * 100),
      status: "suspicious_low",
      score_adjustment: -8,
      note: "Kilométrage anormalement bas pour l'âge — vérifier compteur (rapport Histovec obligatoire)",
    };
  }
  if (pct < -0.25) {
    return {
      expected_km: expected, delta_km: delta, delta_pct: Math.round(pct * 100),
      status: "low",
      score_adjustment: +3,
      note: "Kilométrage faible — valeur ajoutée",
    };
  }
  if (pct > 0.50) {
    return {
      expected_km: expected, delta_km: delta, delta_pct: Math.round(pct * 100),
      status: "very_high",
      score_adjustment: -6,
      note: "Kilométrage très élevé — usure avancée, négocier sur l'entretien",
    };
  }
  if (pct > 0.20) {
    return {
      expected_km: expected, delta_km: delta, delta_pct: Math.round(pct * 100),
      status: "high",
      score_adjustment: -2,
      note: "Kilométrage au-dessus de la moyenne",
    };
  }
  return {
    expected_km: expected, delta_km: delta, delta_pct: Math.round(pct * 100),
    status: "normal",
    score_adjustment: 0,
    note: "Kilométrage cohérent avec l'âge",
  };
}
