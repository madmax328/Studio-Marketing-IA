"use server";

import { getStripe, isStripeConfigured, planForPriceId, priceIdsByPlan } from "@/server/billing/stripe";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { UserFacingError } from "@/server/services/errors";
import { createCheckout, createPortal, type BillingDeps } from "@/server/services/subscriptions";
import { requireUser, requireWorkspace } from "@/server/session";
import type { ActionResult } from "@/server/actions/studio";

function deps(): BillingDeps {
  return { stripe: getStripe(), appUrl: getServerEnv().APP_URL, priceIds: priceIdsByPlan(), planForPriceId: (id) => planForPriceId(id) };
}

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof UserFacingError) return { ok: false, error: error.message };
  console.error("Erreur de facturation", error instanceof Error ? error.message : error);
  return { ok: false, error: "Le service de paiement est momentanément indisponible. Réessayez dans un instant." };
}

export async function startCheckoutAction(planId: string): Promise<ActionResult<{ url: string }>> {
  const user = await requireUser();
  const access = await requireWorkspace();
  if (!isStripeConfigured()) return { ok: false, error: "Le paiement en ligne n'est pas encore activé." };
  try {
    return { ok: true, data: { url: await createCheckout(getDb(), access, user.email, planId, deps()) } };
  } catch (error) {
    return failure(error);
  }
}

export async function openPortalAction(): Promise<ActionResult<{ url: string }>> {
  const access = await requireWorkspace();
  if (!isStripeConfigured()) return { ok: false, error: "Le paiement en ligne n'est pas encore activé." };
  try {
    return { ok: true, data: { url: await createPortal(getDb(), access, deps()) } };
  } catch (error) {
    return failure(error);
  }
}
