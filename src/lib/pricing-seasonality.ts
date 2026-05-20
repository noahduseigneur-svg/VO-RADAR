import type { BodyType, Fuel } from "./types";

// Ajustements de marché selon mois courant.
// Source : données saisonnalité concession (cabriolet été, SUV/4x4 hiver, baisse diesel...).

export interface SeasonalAdjustment {
  multiplier: number;       // ex: 1.05 = +5%
  reason: string;
}

export function seasonalMultiplier(body: BodyType, fuel: Fuel, monthZeroBased = new Date().getMonth()): SeasonalAdjustment {
  const month = monthZeroBased + 1; // 1..12

  // Cabriolet / roadster : explose au printemps, plonge en hiver
  if (body === "cabriolet") {
    if (month >= 4 && month <= 8) {
      return { multiplier: 1.08, reason: "Cabriolet en saison (printemps/été) → demande forte" };
    }
    if (month === 11 || month === 12 || month === 1 || month === 2) {
      return { multiplier: 0.92, reason: "Cabriolet hors saison (hiver) → demande faible" };
    }
    return { multiplier: 1.00, reason: "" };
  }

  // SUV / 4x4 : début d'hiver = hausse
  if (body === "suv") {
    if (month >= 10 && month <= 12) {
      return { multiplier: 1.03, reason: "SUV juste avant l'hiver → demande haussière" };
    }
    if (fuel === "hybride" || fuel === "electrique") {
      return { multiplier: 1.04, reason: "SUV hybride/électrique : segment porteur 2026" };
    }
    return { multiplier: 1.01, reason: "" };
  }

  // Carburant : tendance générale 2026
  if (fuel === "diesel") {
    return { multiplier: 0.97, reason: "Diesel : tendance baissière (ZFE)" };
  }
  if (fuel === "hybride") {
    return { multiplier: 1.04, reason: "Hybride : forte demande" };
  }
  if (fuel === "electrique") {
    // électrique a chuté en 2025-2026 (déstockage des invendus 2024)
    return { multiplier: 0.95, reason: "Électrique : surplus marché 2026" };
  }

  return { multiplier: 1.00, reason: "" };
}
