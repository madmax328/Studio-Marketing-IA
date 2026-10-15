import "server-only";
import Stripe from "stripe";
import type { PlanId } from "@smia/shared";
import { getServerEnv } from "@/server/env";

let client: Stripe | undefined;

export function isStripeConfigured(): boolean {
  return Boolean(getServerEnv().STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = getServerEnv().STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe n'est pas configuré.");
  client ??= new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000 });
  return client;
}

/** Correspondance offre ↔ prix Stripe, configurée par variables d'environnement (différentes en test et en production). */
export function priceIdsByPlan(): Partial<Record<PlanId, string>> {
  const env = getServerEnv();
  return {
    ...(env.STRIPE_PRICE_SOLO ? { solo: env.STRIPE_PRICE_SOLO } : {}),
    ...(env.STRIPE_PRICE_BUSINESS ? { business: env.STRIPE_PRICE_BUSINESS } : {}),
    ...(env.STRIPE_PRICE_AGENCY ? { agency: env.STRIPE_PRICE_AGENCY } : {}),
  };
}

export function planForPriceId(priceId: string, mapping = priceIdsByPlan()): PlanId | null {
  const entry = Object.entries(mapping).find(([, id]) => id === priceId);
  return entry ? (entry[0] as PlanId) : null;
}

/** Prix affiché d'une offre, lu chez Stripe (jamais codé en dur). */
export async function priceLabel(priceId: string): Promise<string | null> {
  try {
    const price = await getStripe().prices.retrieve(priceId);
    if (price.unit_amount == null) return null;
    const amount = new Intl.NumberFormat("fr-FR", { style: "currency", currency: price.currency.toUpperCase() }).format(
      price.unit_amount / 100,
    );
    const interval = price.recurring?.interval === "year" ? "an" : "mois";
    return `${amount} / ${interval}`;
  } catch (error) {
    console.error("Prix Stripe illisible", priceId, error instanceof Error ? error.message : error);
    return null;
  }
}
