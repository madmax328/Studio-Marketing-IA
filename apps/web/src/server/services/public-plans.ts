import "server-only";
import type { PlanId, PlanLimits } from "@smia/shared";
import { isStripeConfigured, priceIdsByPlan, priceLabel } from "@/server/billing/stripe";
import { ensureDatabaseReady, getDb } from "@/server/db/client";
import { listPlans, TEAM_LIMIT_DEFAULTS } from "@/server/services/billing";

export interface PublicPlan {
  id: PlanId;
  name: string;
  description: string;
  features: string[];
  limits: PlanLimits;
  /** Prix lu chez Stripe ; null s'il n'est pas (encore) publié. */
  price: string | null;
}

/**
 * Offres affichées sur le site public, lues en base (modifiables sans code) avec leur prix Stripe.
 * Retourne null si la base est injoignable (ex. pendant la compilation) : la page affiche alors un renvoi.
 */
export async function getPublicPlans(): Promise<PublicPlan[] | null> {
  try {
    await ensureDatabaseReady();
    const plans = await listPlans(getDb());
    const stripeReady = isStripeConfigured();
    const priceIds = priceIdsByPlan();
    return await Promise.all(
      plans.map(async (plan) => ({
        id: plan._id,
        name: plan.name,
        description: plan.description,
        features: plan.features,
        limits: { ...TEAM_LIMIT_DEFAULTS[plan._id], ...plan.limits },
        price: plan._id === "free" ? "0 €" : stripeReady && priceIds[plan._id] ? await priceLabel(priceIds[plan._id] as string) : null,
      })),
    );
  } catch {
    return null;
  }
}
