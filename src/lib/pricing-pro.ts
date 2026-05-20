import type { Fuel, Gearbox, BodyType, Listing } from "./types";
import { estimateMarketValueDetailed } from "./pricing";
import { detectOptions, type OptionFinding } from "./pricing-options";
import { seasonalMultiplier } from "./pricing-seasonality";
import { knnPricing, type KnnPricingResult } from "./pricing-knn";

// Pricing PRO : combine 3 signaux pour estimer la "vraie" valeur d'une annonce
//   1. Cote théorique (anchor model) → toujours disponible
//   2. Options & finitions premium → bonus € depuis le titre
//   3. Comparables réels (kNN sur la DB) → vérité terrain quand on a du volume
//   + Ajustement saisonnier
//
// Sortie : valeur consolidée + intervalle de confiance + décomposition explicable.

export interface PricingBreakdown {
  label: string;
  delta_eur: number;
}

export interface ProPricingResult {
  // Prix juste estimé (et bornes)
  fair_price_eur: number;
  p25_eur: number;
  p75_eur: number;

  // Composantes
  theoretical_eur: number;        // cote modèle pure (sans options, sans kNN)
  options_delta_eur: number;
  options: OptionFinding[];
  seasonal_multiplier: number;
  seasonal_reason: string;
  knn?: KnnPricingResult;

  // Confiance globale
  confidence: "calibrated_knn" | "calibrated_anchor" | "anchor_only" | "fallback";
  confidence_label: string;

  // Décomposition pour l'UI
  breakdown: PricingBreakdown[];

  // Pour le scoring final
  market_value_eur: number;       // = fair_price_eur (alias pour compat)
  delta_eur: number;              // vs prix demandé
  delta_pct: number;
}

export interface ProPricingInput {
  brand: string;
  model: string;
  year: number;
  mileage_km: number;
  fuel: Fuel;
  gearbox: Gearbox;
  power_hp: number | null;
  body_type: BodyType;
  price_eur: number;
  title?: string | null;
  version?: string | null;
  engine_designation?: string | null;
  excludeId?: string;
}

export async function computeProPrice(input: ProPricingInput): Promise<ProPricingResult> {
  const breakdown: PricingBreakdown[] = [];

  // 1. Cote théorique de base (anchor)
  const anchor = estimateMarketValueDetailed({
    brand: input.brand, model: input.model, year: input.year,
    mileage_km: input.mileage_km, fuel: input.fuel, gearbox: input.gearbox,
    power_hp: input.power_hp, asking_price_eur: input.price_eur,
  });
  const theoretical = anchor.market_value_eur;
  breakdown.push({ label: "Cote modèle (base)", delta_eur: theoretical });

  // 2. Options détectées
  const options = detectOptions({ title: input.title, version: input.version, engine_designation: input.engine_designation });
  if (options.total_delta_eur > 0) {
    breakdown.push({ label: `Options & finitions (${options.detected.length})`, delta_eur: options.total_delta_eur });
  }

  // 3. Ajustement saisonnier
  const season = seasonalMultiplier(input.body_type, input.fuel);
  let withOptionsAndSeason = (theoretical + options.total_delta_eur) * season.multiplier;
  if (season.multiplier !== 1) {
    breakdown.push({
      label: `Saisonnalité (${(season.multiplier > 1 ? "+" : "")}${Math.round((season.multiplier - 1) * 100)}%)`,
      delta_eur: Math.round(withOptionsAndSeason - (theoretical + options.total_delta_eur)),
    });
  }

  // 4. Comparables réels (kNN)
  const knn = await knnPricing({
    brand: input.brand, model: input.model, year: input.year,
    mileage_km: input.mileage_km, fuel: input.fuel, gearbox: input.gearbox,
    power_hp: input.power_hp, excludeId: input.excludeId,
  });

  // 5. Consolidation finale
  let fair: number;
  let p25: number;
  let p75: number;
  let confidence: ProPricingResult["confidence"];
  let confLabel: string;

  if (knn.confidence === "high") {
    // Beaucoup de comparables : la médiane kNN est la référence (avec bonus options non capturé par le marché)
    fair = knn.fair_price_eur;
    p25 = knn.p25_eur;
    p75 = knn.p75_eur;
    confidence = "calibrated_knn";
    confLabel = `${knn.k} comparables réels (confiance élevée)`;
    breakdown.push({ label: `Cote kNN (${knn.k} comparables, médiane)`, delta_eur: knn.fair_price_eur });
  } else if (knn.confidence === "medium" && knn.fair_price_eur > 0) {
    // Mix anchor + kNN, 60/40 vers kNN
    fair = Math.round(knn.fair_price_eur * 0.6 + withOptionsAndSeason * 0.4);
    p25 = knn.p25_eur;
    p75 = knn.p75_eur;
    confidence = "calibrated_knn";
    confLabel = `${knn.k} comparables (confiance moyenne, mix cote modèle)`;
    breakdown.push({ label: `Cote kNN (${knn.k} comparables, pondérée)`, delta_eur: knn.fair_price_eur });
  } else if (knn.confidence === "low" && knn.fair_price_eur > 0) {
    // Peu de comparables : mix 30 kNN / 70 anchor
    fair = Math.round(knn.fair_price_eur * 0.3 + withOptionsAndSeason * 0.7);
    p25 = Math.round(fair * 0.92);
    p75 = Math.round(fair * 1.08);
    confidence = "calibrated_anchor";
    confLabel = `${knn.k} comparable${knn.k > 1 ? "s" : ""} seulement (confiance faible)`;
  } else if (anchor.confidence === "calibrated") {
    // Pas de comparables, mais anchor calibré
    fair = Math.round(withOptionsAndSeason);
    p25 = Math.round(fair * 0.90);
    p75 = Math.round(fair * 1.10);
    confidence = "anchor_only";
    confLabel = "Cote modèle interne (pas de comparables)";
  } else {
    // Anchor en fallback → on s'appuie sur le prix vendeur
    fair = input.price_eur;
    p25 = Math.round(fair * 0.85);
    p75 = Math.round(fair * 1.15);
    confidence = "fallback";
    confLabel = "Modèle non calibré — cote basée sur le prix vendeur";
  }

  const delta = fair - input.price_eur;
  const deltaPct = fair > 0 ? Math.round((delta / fair) * 1000) / 10 : 0;

  return {
    fair_price_eur: Math.max(0, Math.round(fair)),
    p25_eur: Math.max(0, Math.round(p25)),
    p75_eur: Math.max(0, Math.round(p75)),
    theoretical_eur: theoretical,
    options_delta_eur: options.total_delta_eur,
    options: options.detected,
    seasonal_multiplier: season.multiplier,
    seasonal_reason: season.reason,
    knn: knn.k > 0 ? knn : undefined,
    confidence,
    confidence_label: confLabel,
    breakdown,
    market_value_eur: Math.max(0, Math.round(fair)),
    delta_eur: Math.round(delta),
    delta_pct: deltaPct,
  };
}
