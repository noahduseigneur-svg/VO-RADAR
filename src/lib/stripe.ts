import Stripe from "stripe";

export const PLANS = {
  solo: {
    name: "Solo",
    price_eur: 199,
    tagline: "1 utilisateur, sourcing illimité",
    features: [
      "Flux temps réel multi-sources",
      "Scoring & alertes illimitées",
      "Export CSV",
      "Support email",
    ],
    stripe_price_id: process.env.STRIPE_PRICE_SOLO ?? "price_demo_solo",
  },
  pro: {
    name: "Pro",
    price_eur: 399,
    tagline: "Jusqu'à 5 utilisateurs",
    features: [
      "Tout Solo +",
      "Alertes SMS & Slack",
      "API d'export vers votre CRM",
      "Historique de prix 12 mois",
      "Support prioritaire",
    ],
    stripe_price_id: process.env.STRIPE_PRICE_PRO ?? "price_demo_pro",
    highlight: true,
  },
  groupe: {
    name: "Groupe",
    price_eur: 799,
    tagline: "Multi-sites, utilisateurs illimités",
    features: [
      "Tout Pro +",
      "Multi-concessions / hiérarchie",
      "Account manager dédié",
      "SLA 99,9%",
      "Onboarding sur site",
    ],
    stripe_price_id: process.env.STRIPE_PRICE_GROUPE ?? "price_demo_groupe",
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
}

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
