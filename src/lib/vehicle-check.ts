import type { Listing } from "./types";

export interface CtStatus {
  /** null = impossible à calculer */
  due_date: Date | null;
  is_expired: boolean;
  expires_soon: boolean; // < 6 mois
  months_remaining: number | null;
  label: string;
  color: "green" | "amber" | "red" | "gray";
}

// En France : premier CT à 4 ans, puis tous les 2 ans
export function estimateCtStatus(listing: Listing): CtStatus {
  const firstRegYear = listing.year;
  if (!firstRegYear || firstRegYear < 1990) {
    return { due_date: null, is_expired: false, expires_soon: false, months_remaining: null, label: "Inconnu", color: "gray" };
  }

  // Estimation : première mise en circulation au 1er juillet de l'année d'immatriculation
  const firstReg = new Date(firstRegYear, 6, 1);
  const now = new Date();
  const ageYears = (now.getTime() - firstReg.getTime()) / (365.25 * 86400_000);

  if (ageYears < 4) {
    const dueDate = new Date(firstReg);
    dueDate.setFullYear(dueDate.getFullYear() + 4);
    const months = Math.round((dueDate.getTime() - now.getTime()) / (30 * 86400_000));
    return {
      due_date: dueDate,
      is_expired: false,
      expires_soon: months < 6,
      months_remaining: months,
      label: `CT à faire dans ~${months} mois`,
      color: months < 6 ? "amber" : "green",
    };
  }

  // Calcule la prochaine date d'expiration en remontant depuis firstReg
  const yearsSinceFirst = ageYears - 4;
  const cyclesPassed = Math.floor(yearsSinceFirst / 2);
  const lastCtDate = new Date(firstReg);
  lastCtDate.setFullYear(lastCtDate.getFullYear() + 4 + cyclesPassed * 2);
  const nextDue = new Date(lastCtDate);
  nextDue.setFullYear(nextDue.getFullYear() + 2);

  const msRemaining = nextDue.getTime() - now.getTime();
  const months = Math.round(msRemaining / (30 * 86400_000));
  const isExpired = msRemaining < 0;
  const expiresSoon = !isExpired && months < 6;

  return {
    due_date: nextDue,
    is_expired: isExpired,
    expires_soon: expiresSoon,
    months_remaining: isExpired ? 0 : months,
    label: isExpired
      ? "CT probablement expiré"
      : expiresSoon
      ? `CT expire dans ~${months} mois`
      : `CT OK (expire ~${nextDue.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })})`,
    color: isExpired ? "red" : expiresSoon ? "amber" : "green",
  };
}

// Normalise la plaque : "AB-123-CD" → "AB123CD", "AB 123 CD" → "AB123CD"
export function normalizePlate(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-_.]/g, "").slice(0, 9);
}

// Génère les liens de vérification pour une plaque
export function buildCheckLinks(plate: string, listing: Listing) {
  const p = normalizePlate(plate);
  const pDash = p.replace(/^([A-Z]{2})(\d{3})([A-Z]{2})$/, "$1-$2-$3");
  return {
    histovec: `https://histovec.interieur.gouv.fr/histovec/app/#/?plaque=${encodeURIComponent(pDash)}&type=VP`,
    cartado: `https://www.cartado.fr/rapport/?plaque=${encodeURIComponent(pDash)}`,
    autoCheck: `https://www.autocheck.fr/vehiclecheck?vin=${encodeURIComponent(p)}`,
    googlePlate: `https://www.google.com/search?q="${encodeURIComponent(pDash)}"`,
    fni: `https://immatriculation.ants.gouv.fr/`,
  };
}

// Score de confiance globale de la vérification (0-100)
export function vehicleCheckScore(check: {
  ct_ok: 0 | 1 | null;
  accident_ok: 0 | 1 | null;
  docs_ok: 0 | 1 | null;
  body_ok: 0 | 1 | null;
  test_drive_ok: 0 | 1 | null;
}): { score: number; label: string; color: string } {
  const items = [check.ct_ok, check.accident_ok, check.docs_ok, check.body_ok, check.test_drive_ok];
  const filled = items.filter((v) => v !== null);
  if (filled.length === 0) return { score: 0, label: "Non contrôlé", color: "text-neutral-500" };
  const ok = filled.filter((v) => v === 1).length;
  const score = Math.round((ok / filled.length) * 100);
  return {
    score,
    label: score === 100 ? "Tous contrôles OK" : score >= 60 ? "Partiellement validé" : "Points bloquants",
    color: score === 100 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-rose-400",
  };
}
