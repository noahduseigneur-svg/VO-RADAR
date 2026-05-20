export type Fuel = "essence" | "diesel" | "hybride" | "electrique" | "gpl";
export type Gearbox = "manuelle" | "automatique";
export type SellerKind = "particulier" | "pro";
export type BodyType = "citadine" | "berline" | "break" | "suv" | "monospace" | "cabriolet" | "coupe" | "utilitaire" | "inconnu";
export type ReliabilityRating = "excellent" | "good" | "average" | "risky" | "avoid" | "unknown";
export type CritAirClass = 0 | 1 | 2 | 3 | 4 | 5 | -1; // -1 = non classé

export interface Listing {
  id: string;
  source: string;
  source_id: string;
  url: string;
  title: string;
  brand: string;
  model: string;
  version: string | null;
  year: number;
  mileage_km: number;
  fuel: Fuel;
  gearbox: Gearbox;
  power_hp: number | null;
  price_eur: number;
  seller_kind: SellerKind;
  postal_code: string | null;
  region: string | null;
  photos_count: number;
  posted_at: string; // ISO
  fetched_at: string; // ISO
  engine_designation: string | null; // ex: "1.5 BlueHDi 130", "TCe 90"
  body_type: BodyType;
  // computed
  market_value_eur: number;
  delta_eur: number;
  delta_pct: number;
  score: number; // 0..100
  engine_rating: ReliabilityRating;
  critair: CritAirClass;
  comparables_n: number;
  comparables_median_eur: number | null;
}

export interface AlertRule {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  max_price_eur: number | null;
  max_mileage_km: number | null;
  min_year: number | null;
  fuel: Fuel | null;
  min_score: number; // default 70
  region: string | null;
  active: 0 | 1;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  dealership_name: string;
  plan: "trial" | "solo" | "pro" | "groupe";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: "trialing" | "active" | "past_due" | "canceled" | "incomplete";
  trial_ends_at: string;
  created_at: string;
  digest_enabled: number; // 1 = activé, 0 = désactivé
}
