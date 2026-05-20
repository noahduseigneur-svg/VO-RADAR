import type { Listing } from "./types";

export interface LiquidityScore {
  days_estimate: number;
  label: string;
  tier: "fast" | "normal" | "slow" | "very_slow";
  color: string;
  explanation: string;
}

const CURRENT_MONTH = new Date().getMonth() + 1; // 1-12

export function estimateLiquidity(listing: Listing): LiquidityScore {
  let base = 14;

  // Base by segment
  if (listing.fuel === "electrique") {
    base = 28;
  } else if (listing.body_type === "citadine") {
    base = listing.price_eur < 20_000 ? 7 : 11;
  } else if (listing.body_type === "suv") {
    base = listing.price_eur < 30_000 ? 11 : 16;
  } else if (listing.body_type === "berline") {
    base = listing.fuel === "diesel" ? 20 : 14;
  } else if (listing.body_type === "break") {
    base = listing.fuel === "diesel" ? 18 : 14;
  } else if (listing.body_type === "cabriolet") {
    // Seasonal: spring/summer = fast, autumn/winter = slow
    base = (CURRENT_MONTH >= 4 && CURRENT_MONTH <= 8) ? 14 : 35;
  } else if (listing.body_type === "utilitaire") {
    base = 9;
  } else if (listing.body_type === "coupe") {
    base = 18;
  } else if (listing.fuel === "hybride") {
    base = 13;
  }

  const explanations: string[] = [];

  // Price vs market adjustment
  if (listing.delta_pct <= -10) {
    base -= 3;
    explanations.push("sous-coté → vite parti");
  } else if (listing.delta_pct >= 10) {
    base += 5;
    explanations.push("surcôté → moins demandé");
  }

  // Mileage
  if (listing.mileage_km > 150_000) {
    base += 6;
    explanations.push(">150k km → cercle acheteurs réduit");
  } else if (listing.mileage_km < 30_000) {
    base -= 2;
    explanations.push("<30k km → prime faible km");
  }

  // Age
  const age = new Date().getFullYear() - listing.year;
  if (age >= 9) {
    base += 6;
    explanations.push("ancienneté >8 ans → rotation lente");
  } else if (age <= 2) {
    base -= 2;
    explanations.push("récent → très demandé");
  }

  // Engine reliability
  if (listing.engine_rating === "avoid") {
    base += 5;
    explanations.push("moteur à éviter → freine vente");
  } else if (listing.engine_rating === "risky") {
    base += 2;
  }

  // Diesel penalty (trend 2026)
  if (listing.fuel === "diesel" && listing.critair >= 3) {
    base += 4;
    explanations.push("diesel Crit'Air 3+ → ZFE");
  }

  const days = Math.max(4, Math.round(base));

  const tier: LiquidityScore["tier"] =
    days < 10 ? "fast" :
    days < 22 ? "normal" :
    days < 40 ? "slow" : "very_slow";

  const label =
    tier === "fast" ? "Très liquide" :
    tier === "normal" ? "Bonne rotation" :
    tier === "slow" ? "Rotation normale" : "Rotation lente";

  const color =
    tier === "fast" ? "text-emerald-400" :
    tier === "normal" ? "text-lime-400" :
    tier === "slow" ? "text-amber-400" : "text-rose-400";

  return {
    days_estimate: days,
    label,
    tier,
    color,
    explanation: explanations.join(" · ") || "rotation standard du segment",
  };
}
