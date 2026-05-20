import type { Listing } from "./types";

export interface GarageProfile {
  transport_eur: number;
  recon_base_eur: number;
  recon_per_year_eur: number;
  recon_per_10k_km_eur: number;
  prep_ct_eur: number;
  fixed_costs_eur: number;
  target_margin_eur: number;
}

export const DEFAULT_PROFILE: GarageProfile = {
  transport_eur: 250,
  recon_base_eur: 200,
  recon_per_year_eur: 80,
  recon_per_10k_km_eur: 50,
  prep_ct_eur: 300,
  fixed_costs_eur: 400,
  target_margin_eur: 1000,
};

export interface MarginResult {
  buy_price_eur: number;
  transport_eur: number;
  recon_est_eur: number;
  prep_ct_eur: number;
  fixed_costs_eur: number;
  total_costs_eur: number;
  revient_eur: number;
  sell_price_eur: number;
  gross_margin_eur: number;
  net_after_target_eur: number;
  meets_target: boolean;
  verdict: "excellent" | "good" | "tight" | "loss";
  verdict_label: string;
  verdict_color: string;
  max_buy_price_eur: number;
}

export function estimateReconditioning(listing: Listing, profile: GarageProfile): number {
  const age = Math.max(0, new Date().getFullYear() - listing.year);
  const extraKm = Math.max(0, listing.mileage_km - 50_000);
  const engineSurcharge =
    listing.engine_rating === "avoid" ? 1_500 :
    listing.engine_rating === "risky" ? 800 : 0;

  return Math.round(
    profile.recon_base_eur
    + age * profile.recon_per_year_eur
    + (extraKm / 10_000) * profile.recon_per_10k_km_eur
    + engineSurcharge
  );
}

export function computeMargin(
  listing: Listing,
  profile: GarageProfile,
  reconOverride?: number,
): MarginResult {
  const recon = reconOverride ?? estimateReconditioning(listing, profile);
  const totalCosts = profile.transport_eur + recon + profile.prep_ct_eur + profile.fixed_costs_eur;
  const revient = listing.price_eur + totalCosts;
  const sellPrice = listing.market_value_eur;
  const grossMargin = sellPrice - revient;
  const netAfterTarget = grossMargin - profile.target_margin_eur;
  const meetsTarget = grossMargin >= profile.target_margin_eur;

  // Max buy price to still hit target margin
  const maxBuy = Math.max(0, sellPrice - totalCosts - profile.target_margin_eur);

  const verdict: MarginResult["verdict"] =
    grossMargin >= profile.target_margin_eur * 2 ? "excellent" :
    grossMargin >= profile.target_margin_eur ? "good" :
    grossMargin >= 0 ? "tight" : "loss";

  const verdictLabel =
    verdict === "excellent" ? "Excellente marge" :
    verdict === "good" ? "Marge atteinte" :
    verdict === "tight" ? "Marge insuffisante" : "Perte nette";

  const verdictColor =
    verdict === "excellent" ? "text-emerald-400" :
    verdict === "good" ? "text-lime-400" :
    verdict === "tight" ? "text-amber-400" : "text-rose-400";

  return {
    buy_price_eur: listing.price_eur,
    transport_eur: profile.transport_eur,
    recon_est_eur: recon,
    prep_ct_eur: profile.prep_ct_eur,
    fixed_costs_eur: profile.fixed_costs_eur,
    total_costs_eur: totalCosts,
    revient_eur: revient,
    sell_price_eur: sellPrice,
    gross_margin_eur: grossMargin,
    net_after_target_eur: netAfterTarget,
    meets_target: meetsTarget,
    verdict,
    verdict_label: verdictLabel,
    verdict_color: verdictColor,
    max_buy_price_eur: maxBuy,
  };
}
