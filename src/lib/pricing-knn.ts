import { rawQuery } from "./db";
import type { Fuel, Gearbox, Listing } from "./types";

// k-Nearest Neighbors pricing — pour un véhicule donné, trouve les K annonces
// les plus similaires dans la base et calcule un prix juste basé sur leurs
// prix réels. Beaucoup plus précis qu'un modèle d'anchor théorique dès qu'on
// a quelques centaines d'annonces.

export interface KnnNeighbor {
  listing: Listing;
  similarity: number;       // 0..1, 1 = jumeau parfait
  distance: number;         // 0..∞
}

export interface KnnPricingResult {
  fair_price_eur: number;          // prix juste estimé (médiane pondérée)
  p25_eur: number;
  p75_eur: number;
  std_dev_eur: number;
  confidence: "high" | "medium" | "low" | "none";
  neighbors: KnnNeighbor[];
  k: number;
}

interface KnnInput {
  brand: string;
  model: string;
  year: number;
  mileage_km: number;
  fuel: Fuel;
  gearbox: Gearbox;
  power_hp: number | null;
  excludeId?: string;
}

// Recherche en 3 tours élargis pour maximiser la chance d'avoir K voisins
const SEARCH_TIERS = [
  { yearTol: 1, kmTolPct: 0.20, sameFuel: true, sameGearbox: true, weight: 1.0 },
  { yearTol: 2, kmTolPct: 0.35, sameFuel: true, sameGearbox: false, weight: 0.85 },
  { yearTol: 3, kmTolPct: 0.55, sameFuel: false, sameGearbox: false, weight: 0.65 },
];

const K_TARGET = 12;

export async function knnPricing(input: KnnInput): Promise<KnnPricingResult> {
  const seen = new Set<string>();
  const candidates: { row: Listing; tierWeight: number }[] = [];

  for (const tier of SEARCH_TIERS) {
    if (candidates.length >= K_TARGET) break;
    const minKm = Math.max(0, Math.floor(input.mileage_km * (1 - tier.kmTolPct)));
    const maxKm = Math.ceil(input.mileage_km * (1 + tier.kmTolPct));
    const minYear = input.year - tier.yearTol;
    const maxYear = input.year + tier.yearTol;

    const sql = `
      SELECT * FROM listings
      WHERE brand = ?
        AND model = ?
        AND year BETWEEN ? AND ?
        AND mileage_km BETWEEN ? AND ?
        ${tier.sameFuel ? "AND fuel = ?" : ""}
        ${tier.sameGearbox ? "AND gearbox = ?" : ""}
        ${input.excludeId ? "AND id != ?" : ""}
      LIMIT 50
    `;
    const args: (string | number | null)[] = [
      input.brand, input.model,
      minYear, maxYear,
      minKm, maxKm,
    ];
    if (tier.sameFuel) args.push(input.fuel);
    if (tier.sameGearbox) args.push(input.gearbox);
    if (input.excludeId) args.push(input.excludeId);

    const rows = await rawQuery<Listing>(sql, args);

    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      candidates.push({ row, tierWeight: tier.weight });
    }
  }

  if (candidates.length === 0) {
    return {
      fair_price_eur: 0, p25_eur: 0, p75_eur: 0, std_dev_eur: 0,
      confidence: "none", neighbors: [], k: 0,
    };
  }

  // Compute similarity for each candidate
  const neighbors: KnnNeighbor[] = candidates.map(({ row, tierWeight }) => {
    const distance = computeDistance(input, row);
    const similarity = (1 / (1 + distance)) * tierWeight;
    return { listing: row, similarity, distance };
  }).sort((a, b) => b.similarity - a.similarity);

  // Take top K (or all if fewer)
  const topK = neighbors.slice(0, K_TARGET);

  // Weighted median + IQR
  const weighted = topK.map((n) => ({ price: n.listing.price_eur, weight: n.similarity }));
  const totalW = weighted.reduce((a, b) => a + b.weight, 0);
  if (totalW === 0) {
    return {
      fair_price_eur: 0, p25_eur: 0, p75_eur: 0, std_dev_eur: 0,
      confidence: "none", neighbors: topK, k: topK.length,
    };
  }

  const sorted = weighted.slice().sort((a, b) => a.price - b.price);
  const fairPrice = weightedPercentile(sorted, totalW, 0.5);
  const p25 = weightedPercentile(sorted, totalW, 0.25);
  const p75 = weightedPercentile(sorted, totalW, 0.75);

  const mean = weighted.reduce((a, b) => a + b.price * b.weight, 0) / totalW;
  const variance = weighted.reduce((a, b) => a + b.weight * Math.pow(b.price - mean, 2), 0) / totalW;
  const stdDev = Math.sqrt(variance);

  const confidence: KnnPricingResult["confidence"] =
    topK.length >= 8 ? "high" :
    topK.length >= 4 ? "medium" :
    topK.length >= 2 ? "low" : "none";

  return {
    fair_price_eur: Math.round(fairPrice),
    p25_eur: Math.round(p25),
    p75_eur: Math.round(p75),
    std_dev_eur: Math.round(stdDev),
    confidence,
    neighbors: topK,
    k: topK.length,
  };
}

// Distance pondérée — chaque feature contribue proportionnellement à son importance.
// Plus la distance est petite, plus le voisin est similaire.
function computeDistance(input: KnnInput, candidate: Listing): number {
  let d = 0;

  // Year : 1 an d'écart = pénalité 1.0
  const yearDelta = Math.abs(input.year - candidate.year);
  d += yearDelta * 1.0;

  // Mileage : 10 000 km d'écart = 1.0
  const kmDelta = Math.abs(input.mileage_km - candidate.mileage_km);
  d += (kmDelta / 10_000) * 1.0;

  // Fuel : mismatch = penalty fort
  if (input.fuel !== candidate.fuel) d += 2.5;

  // Gearbox : mismatch = penalty moyen
  if (input.gearbox !== candidate.gearbox) d += 1.0;

  // Power : 20 ch d'écart = 1.0
  if (input.power_hp && candidate.power_hp) {
    d += Math.abs(input.power_hp - candidate.power_hp) / 20;
  }

  return d;
}

function weightedPercentile(sorted: { price: number; weight: number }[], totalWeight: number, p: number): number {
  let cumWeight = 0;
  const target = totalWeight * p;
  for (const item of sorted) {
    cumWeight += item.weight;
    if (cumWeight >= target) return item.price;
  }
  return sorted[sorted.length - 1]?.price ?? 0;
}
