import type { Fuel, CritAirClass } from "./types";

// Classification Crit'Air d'après date 1ère immat + carburant.
// Source : ministère de la Transition écologique (arrêté du 21 juin 2016).
//
// ZFE (Zones à Faibles Émissions) actives en 2026 :
//   - Paris / Grand Paris : Crit'Air 3 et + bannis (donc Crit'Air 0/1/2 autorisés)
//   - Lyon Métropole : Crit'Air 4 et + bannis
//   - Marseille / Aix-Marseille : Crit'Air 4 et + bannis
//   - Strasbourg / Eurométropole : Crit'Air 4 et + bannis (5 et plus annoncé 2025)
//   - Rouen : Crit'Air 4 et + bannis
//   - Toulouse : Crit'Air 4 et + bannis
//   - Grenoble : Crit'Air 4 et + bannis
//   - Reims : Crit'Air 4 et + bannis
//   - Montpellier : Crit'Air 4 et + bannis
//
// Pour un concessionnaire qui rachète, c'est crucial : un diesel Crit'Air 3 perd
// 15-25% de sa valeur de revente s'il faut le vendre en zone Paris.

export function classifyCritAir(fuel: Fuel, year: number): CritAirClass {
  if (fuel === "electrique") return 0;
  // Hybride rechargeable → assimilé essence selon Euro
  if (fuel === "hybride") {
    if (year >= 2011) return 1;
    if (year >= 2006) return 2;
    return 3;
  }
  if (fuel === "essence" || fuel === "gpl") {
    if (year >= 2011) return 1;
    if (year >= 2006) return 2;
    if (year >= 1997) return 3;
    return -1; // non classé
  }
  // diesel
  if (year >= 2011) return 2;
  if (year >= 2006) return 3;
  if (year >= 2001) return 4;
  if (year >= 1997) return 5;
  return -1;
}

export interface ZfeImpact {
  critair: CritAirClass;
  label: string;
  paris_ok: boolean;
  lyon_ok: boolean;
  major_cities_ok: boolean;     // toutes ZFE majeures (Strasbourg/Toulouse/Grenoble…)
  score_adjustment: number;     // -12..+2
  resale_warning: string | null;
}

export function evaluateCritAir(fuel: Fuel, year: number): ZfeImpact {
  const critair = classifyCritAir(fuel, year);
  const paris_ok = critair >= 0 && critair <= 2;
  const lyon_ok = critair >= 0 && critair <= 3;
  const major_cities_ok = critair >= 0 && critair <= 3;

  let adjustment = 0;
  let warning: string | null = null;

  if (critair === 0) {
    adjustment = +2;
  } else if (critair === 1) {
    adjustment = +1;
  } else if (critair === 2) {
    adjustment = 0;
  } else if (critair === 3) {
    adjustment = -4;
    warning = "Banni de la ZFE Paris/IDF — revente difficile en Île-de-France";
  } else if (critair === 4) {
    adjustment = -10;
    warning = "Banni de toutes les grandes ZFE (Paris, Lyon, Marseille, etc.)";
  } else if (critair === 5) {
    adjustment = -12;
    warning = "Banni de toutes les ZFE françaises majeures";
  } else {
    adjustment = -12;
    warning = "Non classé Crit'Air — circulation très restreinte";
  }

  return {
    critair,
    label: critair === -1 ? "Non classé" : `Crit'Air ${critair}`,
    paris_ok,
    lyon_ok,
    major_cities_ok,
    score_adjustment: adjustment,
    resale_warning: warning,
  };
}
