import Stripe from "stripe";

export const PLANS = {
  solo: {
    name: "Indépendant",
    price_eur: 49,
    tagline: "1 utilisateur · marchands indépendants",
    features: [
      "Flux temps réel 9 sources (voitures + motos)",
      "Scoring & alertes illimitées",
      "Pipeline de deals + calculateur de marge",
      "Export CSV",
      "Support email 48h",
    ],
    stripe_price_id: process.env.STRIPE_PRICE_SOLO ?? "price_demo_solo",
  },
  pro: {
    name: "Concession",
    price_eur: 99,
    tagline: "Jusqu'à 5 acheteurs VO",
    features: [
      "Tout Indépendant +",
      "Sources étrangères (BE · DE · NL · ES · IT)",
      "Historique de prix 12 mois",
      "Digest email quotidien personnalisé",
      "Support prioritaire 24h",
    ],
    stripe_price_id: process.env.STRIPE_PRICE_PRO ?? "price_demo_pro",
    highlight: true,
  },
  groupe: {
    name: "Réseau",
    price_eur: 199,
    tagline: "Multi-sites, utilisateurs illimités",
    features: [
      "Tout Concession +",
      "Multi-concessions & hiérarchie",
      "API d'export vers votre DMS/CRM",
      "Account manager dédié",
      "SLA 99,9% · onboarding personnalisé",
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
