import type { Fuel, Gearbox } from "./types";

// Lightweight market-value model. NOT a replacement for Argus/Autovista,
// but good enough to surface relative deals while we wait for a real cote API.
//
// Approach: base value per (brand, model, year) anchor, then adjust for
// mileage, fuel, gearbox, power, and seller type.
// If no anchor matches, we fall back to the seller's price (confidence = false)
// so we don't fabricate fake deltas.

interface ModelAnchor {
  // value of a 0 km car, current year
  base_new_eur: number;
  // annual depreciation rate applied geometrically per year of age
  depreciation_per_year: number;
  // €/km penalty above the "expected" mileage for the age
  per_km_above_expected: number;
  expected_km_per_year: number;
}

// Hand-tuned anchors for common French dealership inventory.
// Values approximate January 2026 list prices. Extend / replace with an
// Autovista/Argus feed in production.
const ANCHORS: Record<string, ModelAnchor> = {
  // Renault
  "renault:clio":      { base_new_eur: 21000, depreciation_per_year: 0.14, per_km_above_expected: 0.045, expected_km_per_year: 14000 },
  "renault:captur":    { base_new_eur: 26000, depreciation_per_year: 0.14, per_km_above_expected: 0.05,  expected_km_per_year: 14000 },
  "renault:megane":    { base_new_eur: 28000, depreciation_per_year: 0.15, per_km_above_expected: 0.05,  expected_km_per_year: 15000 },
  "renault:austral":   { base_new_eur: 38000, depreciation_per_year: 0.16, per_km_above_expected: 0.06,  expected_km_per_year: 15000 },
  "renault:arkana":    { base_new_eur: 30000, depreciation_per_year: 0.15, per_km_above_expected: 0.055, expected_km_per_year: 15000 },
  "renault:kadjar":    { base_new_eur: 28000, depreciation_per_year: 0.15, per_km_above_expected: 0.055, expected_km_per_year: 15000 },
  "renault:scenic":    { base_new_eur: 36000, depreciation_per_year: 0.16, per_km_above_expected: 0.06,  expected_km_per_year: 15000 },
  "renault:twingo":    { base_new_eur: 16000, depreciation_per_year: 0.13, per_km_above_expected: 0.035, expected_km_per_year: 13000 },
  "renault:zoe":       { base_new_eur: 32000, depreciation_per_year: 0.20, per_km_above_expected: 0.04,  expected_km_per_year: 14000 },
  // Peugeot
  "peugeot:208":       { base_new_eur: 22000, depreciation_per_year: 0.14, per_km_above_expected: 0.045, expected_km_per_year: 14000 },
  "peugeot:308":       { base_new_eur: 32000, depreciation_per_year: 0.15, per_km_above_expected: 0.055, expected_km_per_year: 15000 },
  "peugeot:2008":      { base_new_eur: 27000, depreciation_per_year: 0.14, per_km_above_expected: 0.05,  expected_km_per_year: 14000 },
  "peugeot:3008":      { base_new_eur: 38000, depreciation_per_year: 0.15, per_km_above_expected: 0.055, expected_km_per_year: 15000 },
  "peugeot:5008":      { base_new_eur: 42000, depreciation_per_year: 0.16, per_km_above_expected: 0.06,  expected_km_per_year: 15000 },
  "peugeot:508":       { base_new_eur: 45000, depreciation_per_year: 0.17, per_km_above_expected: 0.065, expected_km_per_year: 16000 },
  "peugeot:rifter":    { base_new_eur: 27000, depreciation_per_year: 0.14, per_km_above_expected: 0.05,  expected_km_per_year: 14000 },
  // Citroën
  "citroen:c1":        { base_new_eur: 14000, depreciation_per_year: 0.13, per_km_above_expected: 0.03,  expected_km_per_year: 13000 },
  "citroen:c3":        { base_new_eur: 19000, depreciation_per_year: 0.14, per_km_above_expected: 0.04,  expected_km_per_year: 14000 },
  "citroen:c4":        { base_new_eur: 26000, depreciation_per_year: 0.15, per_km_above_expected: 0.045, expected_km_per_year: 14000 },
  "citroen:c5":        { base_new_eur: 38000, depreciation_per_year: 0.17, per_km_above_expected: 0.06,  expected_km_per_year: 15000 },
  "citroen:c5-aircross": { base_new_eur: 35000, depreciation_per_year: 0.16, per_km_above_expected: 0.055, expected_km_per_year: 15000 },
  "citroen:berlingo":  { base_new_eur: 26000, depreciation_per_year: 0.14, per_km_above_expected: 0.05,  expected_km_per_year: 14000 },
  // Volkswagen
  "volkswagen:golf":   { base_new_eur: 32000, depreciation_per_year: 0.12, per_km_above_expected: 0.05,  expected_km_per_year: 15000 },
  "volkswagen:polo":   { base_new_eur: 23000, depreciation_per_year: 0.12, per_km_above_expected: 0.045, expected_km_per_year: 14000 },
  "volkswagen:tiguan": { base_new_eur: 42000, depreciation_per_year: 0.13, per_km_above_expected: 0.06,  expected_km_per_year: 15000 },
  "volkswagen:t-roc":  { base_new_eur: 32000, depreciation_per_year: 0.13, per_km_above_expected: 0.055, expected_km_per_year: 15000 },
  "volkswagen:t-cross":{ base_new_eur: 26000, depreciation_per_year: 0.13, per_km_above_expected: 0.045, expected_km_per_year: 14000 },
  "volkswagen:passat": { base_new_eur: 42000, depreciation_per_year: 0.14, per_km_above_expected: 0.06,  expected_km_per_year: 16000 },
  // BMW / Audi / Mercedes
  "bmw:serie-1":       { base_new_eur: 35000, depreciation_per_year: 0.13, per_km_above_expected: 0.06,  expected_km_per_year: 15000 },
  "bmw:serie-2":       { base_new_eur: 42000, depreciation_per_year: 0.13, per_km_above_expected: 0.065, expected_km_per_year: 15000 },
  "bmw:serie-3":       { base_new_eur: 48000, depreciation_per_year: 0.14, per_km_above_expected: 0.07,  expected_km_per_year: 15000 },
  "bmw:serie-5":       { base_new_eur: 65000, depreciation_per_year: 0.16, per_km_above_expected: 0.08,  expected_km_per_year: 16000 },
  "bmw:x1":            { base_new_eur: 42000, depreciation_per_year: 0.13, per_km_above_expected: 0.07,  expected_km_per_year: 15000 },
  "bmw:x3":            { base_new_eur: 55000, depreciation_per_year: 0.14, per_km_above_expected: 0.075, expected_km_per_year: 15000 },
  "audi:a1":           { base_new_eur: 28000, depreciation_per_year: 0.13, per_km_above_expected: 0.055, expected_km_per_year: 14000 },
  "audi:a3":           { base_new_eur: 38000, depreciation_per_year: 0.13, per_km_above_expected: 0.06,  expected_km_per_year: 15000 },
  "audi:a4":           { base_new_eur: 48000, depreciation_per_year: 0.14, per_km_above_expected: 0.07,  expected_km_per_year: 15000 },
  "audi:q2":           { base_new_eur: 35000, depreciation_per_year: 0.13, per_km_above_expected: 0.06,  expected_km_per_year: 15000 },
  "audi:q3":           { base_new_eur: 45000, depreciation_per_year: 0.13, per_km_above_expected: 0.07,  expected_km_per_year: 15000 },
  "audi:q5":           { base_new_eur: 60000, depreciation_per_year: 0.14, per_km_above_expected: 0.08,  expected_km_per_year: 15000 },
  "mercedes:classe-a": { base_new_eur: 40000, depreciation_per_year: 0.13, per_km_above_expected: 0.06,  expected_km_per_year: 15000 },
  "mercedes:classe-b": { base_new_eur: 42000, depreciation_per_year: 0.14, per_km_above_expected: 0.06,  expected_km_per_year: 15000 },
  "mercedes:classe-c": { base_new_eur: 55000, depreciation_per_year: 0.14, per_km_above_expected: 0.07,  expected_km_per_year: 15000 },
  "mercedes:cla":      { base_new_eur: 45000, depreciation_per_year: 0.14, per_km_above_expected: 0.065, expected_km_per_year: 15000 },
  "mercedes:gla":      { base_new_eur: 48000, depreciation_per_year: 0.14, per_km_above_expected: 0.07,  expected_km_per_year: 15000 },
  // Mini
  "mini:cooper":       { base_new_eur: 28000, depreciation_per_year: 0.13, per_km_above_expected: 0.055, expected_km_per_year: 14000 },
  "mini:countryman":   { base_new_eur: 38000, depreciation_per_year: 0.14, per_km_above_expected: 0.06,  expected_km_per_year: 15000 },
  // Dacia
  "dacia:sandero":     { base_new_eur: 15000, depreciation_per_year: 0.11, per_km_above_expected: 0.03,  expected_km_per_year: 14000 },
  "dacia:duster":      { base_new_eur: 20000, depreciation_per_year: 0.11, per_km_above_expected: 0.035, expected_km_per_year: 14000 },
  "dacia:jogger":      { base_new_eur: 19000, depreciation_per_year: 0.11, per_km_above_expected: 0.04,  expected_km_per_year: 14000 },
  "dacia:spring":      { base_new_eur: 18000, depreciation_per_year: 0.16, per_km_above_expected: 0.03,  expected_km_per_year: 12000 },
  // Toyota
  "toyota:aygo":       { base_new_eur: 14500, depreciation_per_year: 0.10, per_km_above_expected: 0.03,  expected_km_per_year: 13000 },
  "toyota:yaris":      { base_new_eur: 22000, depreciation_per_year: 0.10, per_km_above_expected: 0.04,  expected_km_per_year: 14000 },
  "toyota:yaris-cross":{ base_new_eur: 28000, depreciation_per_year: 0.11, per_km_above_expected: 0.045, expected_km_per_year: 14000 },
  "toyota:corolla":    { base_new_eur: 30000, depreciation_per_year: 0.10, per_km_above_expected: 0.045, expected_km_per_year: 15000 },
  "toyota:c-hr":       { base_new_eur: 33000, depreciation_per_year: 0.11, per_km_above_expected: 0.05,  expected_km_per_year: 15000 },
  "toyota:rav4":       { base_new_eur: 42000, depreciation_per_year: 0.11, per_km_above_expected: 0.06,  expected_km_per_year: 15000 },
  // Opel
  "opel:corsa":        { base_new_eur: 20000, depreciation_per_year: 0.14, per_km_above_expected: 0.04,  expected_km_per_year: 14000 },
  "opel:mokka":        { base_new_eur: 26000, depreciation_per_year: 0.14, per_km_above_expected: 0.05,  expected_km_per_year: 14000 },
  "opel:crossland":    { base_new_eur: 24000, depreciation_per_year: 0.14, per_km_above_expected: 0.045, expected_km_per_year: 14000 },
  "opel:grandland":    { base_new_eur: 32000, depreciation_per_year: 0.15, per_km_above_expected: 0.055, expected_km_per_year: 15000 },
  "opel:astra":        { base_new_eur: 28000, depreciation_per_year: 0.14, per_km_above_expected: 0.05,  expected_km_per_year: 15000 },
  // Fiat
  "fiat:500":          { base_new_eur: 19000, depreciation_per_year: 0.13, per_km_above_expected: 0.035, expected_km_per_year: 12000 },
  "fiat:panda":        { base_new_eur: 16000, depreciation_per_year: 0.13, per_km_above_expected: 0.035, expected_km_per_year: 13000 },
  "fiat:tipo":         { base_new_eur: 22000, depreciation_per_year: 0.14, per_km_above_expected: 0.045, expected_km_per_year: 14000 },
  // Alfa Romeo
  "alfa-romeo:tonale": { base_new_eur: 42000, depreciation_per_year: 0.16, per_km_above_expected: 0.06,  expected_km_per_year: 14000 },
  "alfa-romeo:giulia": { base_new_eur: 55000, depreciation_per_year: 0.18, per_km_above_expected: 0.07,  expected_km_per_year: 14000 },
  // Hyundai / Kia
  "hyundai:i10":       { base_new_eur: 16500, depreciation_per_year: 0.12, per_km_above_expected: 0.035, expected_km_per_year: 13000 },
  "hyundai:i20":       { base_new_eur: 20000, depreciation_per_year: 0.12, per_km_above_expected: 0.04,  expected_km_per_year: 14000 },
  "hyundai:i30":       { base_new_eur: 26000, depreciation_per_year: 0.13, per_km_above_expected: 0.045, expected_km_per_year: 15000 },
  "hyundai:kona":      { base_new_eur: 30000, depreciation_per_year: 0.13, per_km_above_expected: 0.05,  expected_km_per_year: 14000 },
  "hyundai:tucson":    { base_new_eur: 36000, depreciation_per_year: 0.13, per_km_above_expected: 0.055, expected_km_per_year: 15000 },
  "kia:picanto":       { base_new_eur: 16000, depreciation_per_year: 0.12, per_km_above_expected: 0.035, expected_km_per_year: 13000 },
  "kia:rio":           { base_new_eur: 20000, depreciation_per_year: 0.13, per_km_above_expected: 0.04,  expected_km_per_year: 14000 },
  "kia:stonic":        { base_new_eur: 24000, depreciation_per_year: 0.13, per_km_above_expected: 0.045, expected_km_per_year: 14000 },
  "kia:sportage":      { base_new_eur: 36000, depreciation_per_year: 0.13, per_km_above_expected: 0.055, expected_km_per_year: 15000 },
  "kia:ceed":          { base_new_eur: 26000, depreciation_per_year: 0.13, per_km_above_expected: 0.045, expected_km_per_year: 15000 },
  // Ford
  "ford:fiesta":       { base_new_eur: 20000, depreciation_per_year: 0.14, per_km_above_expected: 0.04,  expected_km_per_year: 14000 },
  "ford:focus":        { base_new_eur: 28000, depreciation_per_year: 0.15, per_km_above_expected: 0.05,  expected_km_per_year: 15000 },
  "ford:puma":         { base_new_eur: 28000, depreciation_per_year: 0.13, per_km_above_expected: 0.045, expected_km_per_year: 14000 },
  "ford:kuga":         { base_new_eur: 36000, depreciation_per_year: 0.15, per_km_above_expected: 0.055, expected_km_per_year: 15000 },
  // Nissan
  "nissan:micra":      { base_new_eur: 18000, depreciation_per_year: 0.13, per_km_above_expected: 0.04,  expected_km_per_year: 14000 },
  "nissan:juke":       { base_new_eur: 26000, depreciation_per_year: 0.13, per_km_above_expected: 0.045, expected_km_per_year: 14000 },
  "nissan:qashqai":    { base_new_eur: 34000, depreciation_per_year: 0.13, per_km_above_expected: 0.055, expected_km_per_year: 15000 },
  // Seat / Skoda
  "seat:ibiza":        { base_new_eur: 21000, depreciation_per_year: 0.13, per_km_above_expected: 0.04,  expected_km_per_year: 14000 },
  "seat:leon":         { base_new_eur: 30000, depreciation_per_year: 0.13, per_km_above_expected: 0.05,  expected_km_per_year: 15000 },
  "seat:arona":        { base_new_eur: 24000, depreciation_per_year: 0.13, per_km_above_expected: 0.045, expected_km_per_year: 14000 },
  "seat:ateca":        { base_new_eur: 32000, depreciation_per_year: 0.13, per_km_above_expected: 0.055, expected_km_per_year: 15000 },
  "skoda:fabia":       { base_new_eur: 22000, depreciation_per_year: 0.12, per_km_above_expected: 0.04,  expected_km_per_year: 14000 },
  "skoda:scala":       { base_new_eur: 26000, depreciation_per_year: 0.13, per_km_above_expected: 0.045, expected_km_per_year: 15000 },
  "skoda:kamiq":       { base_new_eur: 26000, depreciation_per_year: 0.12, per_km_above_expected: 0.045, expected_km_per_year: 14000 },
  "skoda:karoq":       { base_new_eur: 32000, depreciation_per_year: 0.13, per_km_above_expected: 0.055, expected_km_per_year: 15000 },
  "skoda:kodiaq":      { base_new_eur: 45000, depreciation_per_year: 0.14, per_km_above_expected: 0.065, expected_km_per_year: 15000 },
  "skoda:octavia":     { base_new_eur: 32000, depreciation_per_year: 0.13, per_km_above_expected: 0.05,  expected_km_per_year: 16000 },
  // Tesla
  "tesla:model-3":     { base_new_eur: 45000, depreciation_per_year: 0.18, per_km_above_expected: 0.05,  expected_km_per_year: 18000 },
  "tesla:model-y":     { base_new_eur: 50000, depreciation_per_year: 0.18, per_km_above_expected: 0.055, expected_km_per_year: 18000 },
  "tesla:model-s":     { base_new_eur: 95000, depreciation_per_year: 0.20, per_km_above_expected: 0.08,  expected_km_per_year: 18000 },
  "tesla:model-x":     { base_new_eur:110000, depreciation_per_year: 0.20, per_km_above_expected: 0.09,  expected_km_per_year: 18000 },
  // BYD / MG
  "mg:zs":             { base_new_eur: 25000, depreciation_per_year: 0.16, per_km_above_expected: 0.04,  expected_km_per_year: 14000 },
  "mg:4":              { base_new_eur: 32000, depreciation_per_year: 0.17, per_km_above_expected: 0.045, expected_km_per_year: 15000 },
};

const FUEL_MULT: Record<Fuel, number> = {
  essence: 1.0,
  diesel: 0.96,        // diesel discount on used market
  hybride: 1.08,
  electrique: 1.05,
  gpl: 0.92,
};

const GEARBOX_MULT: Record<Gearbox, number> = {
  manuelle: 1.0,
  automatique: 1.06,
};

const CURRENT_YEAR = new Date().getFullYear();

export interface PricingInput {
  brand: string;
  model: string;
  year: number;
  mileage_km: number;
  fuel: Fuel;
  gearbox: Gearbox;
  power_hp: number | null;
  asking_price_eur?: number;
}

export interface PricingResult {
  market_value_eur: number;
  confidence: "calibrated" | "fallback";
}

/** Returns market value + whether we have a calibrated anchor for this model. */
export function estimateMarketValueDetailed(input: PricingInput): PricingResult {
  const key = `${slug(input.brand)}:${slug(input.model)}`;
  const anchor = ANCHORS[key];

  if (!anchor) {
    // No calibration → trust the seller's price to avoid fabricating fake deltas.
    // The score system will treat this as neutral (score ~50).
    if (input.asking_price_eur && input.asking_price_eur > 0) {
      return { market_value_eur: input.asking_price_eur, confidence: "fallback" };
    }
    return { market_value_eur: 15000, confidence: "fallback" };
  }

  const age = Math.max(0, CURRENT_YEAR - input.year);
  let value = anchor.base_new_eur * Math.pow(1 - anchor.depreciation_per_year, age);

  const expectedKm = age * anchor.expected_km_per_year;
  const excessKm = Math.max(0, input.mileage_km - expectedKm);
  value -= excessKm * anchor.per_km_above_expected;

  const underKm = Math.max(0, expectedKm - input.mileage_km);
  value += underKm * anchor.per_km_above_expected * 0.5;

  value *= FUEL_MULT[input.fuel] ?? 1;
  value *= GEARBOX_MULT[input.gearbox] ?? 1;

  if (input.power_hp && input.power_hp > 110) {
    value *= 1 + Math.min(0.15, (input.power_hp - 110) / 600);
  }

  return { market_value_eur: Math.max(1000, Math.round(value)), confidence: "calibrated" };
}

/** Backwards-compatible: only returns the price. */
export function estimateMarketValue(input: PricingInput): number {
  return estimateMarketValueDetailed(input).market_value_eur;
}

export function slug(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
