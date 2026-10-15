import { getStripe, isStripeConfigured, planForPriceId } from "@/server/billing/stripe";
import { ensureDatabaseReady, getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { handleStripeEvent } from "@/server/services/subscriptions";

/**
 * Webhooks Stripe. La signature est vérifiée sur le corps brut avant tout traitement ;
 * un événement déjà traité est ignoré (Stripe peut renvoyer le même événement).
 */
export async function POST(request: Request): Promise<Response> {
  const secret = getServerEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret || !isStripeConfigured()) return Response.json({ error: "Stripe n'est pas configuré." }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Signature manquante." }, { status: 400 });

  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return Response.json({ error: "Signature invalide." }, { status: 400 });
  }

  await ensureDatabaseReady();
  // Une erreur ici renvoie 500 : Stripe renverra l'événement plus tard.
  const result = await handleStripeEvent(getDb(), event, {
    retrieveSubscription: (id) => stripe.subscriptions.retrieve(id),
    planForPriceId: (priceId) => planForPriceId(priceId),
  });
  return Response.json({ received: true, result });
}
