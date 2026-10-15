import { ObjectId, type Db } from "mongodb";
import type Stripe from "stripe";
import type { PlanId } from "@smia/shared";
import { collections, type SubscriptionDoc } from "@/server/db/collections";
import { recordAudit } from "@/server/services/audit";
import { getSubscription, syncCreditAllowance } from "@/server/services/billing";
import { UserFacingError } from "@/server/services/errors";
import { assertPermission } from "@/server/services/permissions";
import type { WorkspaceAccess } from "@/server/services/workspaces";

const ACTIVE: SubscriptionDoc["status"][] = ["active", "trialing", "past_due"];

export interface BillingDeps {
  stripe: Stripe;
  appUrl: string;
  priceIds: Partial<Record<PlanId, string>>;
  planForPriceId(priceId: string): PlanId | null;
}

async function ensureCustomer(db: Db, access: WorkspaceAccess, email: string, deps: BillingDeps): Promise<string> {
  const existing = await getSubscription(db, access.workspace._id);
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;
  const customer = await deps.stripe.customers.create(
    { email, name: access.workspace.name, metadata: { workspaceId: access.workspace._id.toHexString() } },
    // Clé d'idempotence : deux clics simultanés ne créent pas deux clients.
    { idempotencyKey: `customer-${access.workspace._id.toHexString()}` },
  );
  await collections(db).subscriptions.updateOne(
    { _id: access.workspace._id },
    {
      $set: { stripeCustomerId: customer.id, updatedAt: new Date() },
      $setOnInsert: {
        planId: "free",
        status: "incomplete",
        stripeSubscriptionId: null,
        stripePriceId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        lastEventAt: null,
      },
    },
    { upsert: true },
  );
  return customer.id;
}

/** Page de paiement Stripe pour souscrire à une offre (propriétaire de l'espace uniquement). */
export async function createCheckout(db: Db, access: WorkspaceAccess, email: string, planId: unknown, deps: BillingDeps): Promise<string> {
  assertPermission(access, "billing:manage");
  if (typeof planId !== "string" || !(planId in deps.priceIds)) {
    throw new UserFacingError("Cette offre n'est pas encore disponible à la souscription.", "unavailable");
  }
  const current = await getSubscription(db, access.workspace._id);
  if (current?.stripeSubscriptionId && ACTIVE.includes(current.status)) {
    throw new UserFacingError("Vous avez déjà un abonnement : changez d'offre depuis « Gérer mon abonnement ».", "conflict");
  }
  const customer = await ensureCustomer(db, access, email, deps);
  const workspaceId = access.workspace._id.toHexString();
  const session = await deps.stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: workspaceId,
    line_items: [{ price: deps.priceIds[planId as PlanId] as string, quantity: 1 }],
    subscription_data: { metadata: { workspaceId } },
    metadata: { workspaceId },
    allow_promotion_codes: true,
    locale: "fr",
    success_url: `${deps.appUrl}/abonnement?paiement=ok`,
    cancel_url: `${deps.appUrl}/abonnement?paiement=annule`,
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé de page de paiement.");
  return session.url;
}

/** Portail client Stripe : changer d'offre, moyen de paiement, factures, résiliation. */
export async function createPortal(db: Db, access: WorkspaceAccess, deps: BillingDeps): Promise<string> {
  assertPermission(access, "billing:manage");
  const subscription = await getSubscription(db, access.workspace._id);
  if (!subscription?.stripeCustomerId) throw new UserFacingError("Aucun abonnement à gérer pour le moment.", "not_found");
  const session = await deps.stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${deps.appUrl}/abonnement`,
    locale: "fr",
  });
  return session.url;
}

/**
 * Applique l'état d'un abonnement Stripe à l'espace concerné.
 * L'état est toujours relu chez Stripe : l'ordre d'arrivée des webhooks n'a pas d'importance.
 */
export async function applyStripeSubscription(db: Db, subscription: Stripe.Subscription, planForPriceId: BillingDeps["planForPriceId"]) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const metadataId = subscription.metadata?.workspaceId;
  let workspaceId: ObjectId | null = metadataId && ObjectId.isValid(metadataId) ? new ObjectId(metadataId) : null;
  if (!workspaceId) {
    const byCustomer = await collections(db).subscriptions.findOne({ stripeCustomerId: customerId }, { projection: { _id: 1 } });
    workspaceId = byCustomer?._id ?? null;
  }
  if (!workspaceId) {
    console.error("Abonnement Stripe sans espace associé", subscription.id);
    return;
  }

  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const planId = priceId ? planForPriceId(priceId) : null;
  if (priceId && !planId) console.error("Prix Stripe sans offre correspondante", priceId);

  const status = subscription.status as SubscriptionDoc["status"];
  await collections(db).subscriptions.updateOne(
    { _id: workspaceId },
    {
      $set: {
        planId: planId ?? "free",
        status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        lastEventAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
  await syncCreditAllowance(db, workspaceId);
  await recordAudit(db, {
    workspaceId,
    actorUserId: null,
    action: "billing.subscription_updated",
    metadata: { planId: planId ?? "free", status },
  });
}

/** Traite un événement webhook Stripe déjà authentifié (signature vérifiée). Idempotent. */
export async function handleStripeEvent(
  db: Db,
  event: Stripe.Event,
  deps: { retrieveSubscription(id: string): Promise<Stripe.Subscription>; planForPriceId: BillingDeps["planForPriceId"] },
): Promise<"processed" | "duplicate" | "ignored"> {
  const c = collections(db);
  if (await c.stripeEvents.findOne({ _id: event.id })) return "duplicate";

  let handled = true;
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const id = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (id) await applyStripeSubscription(db, await deps.retrieveSubscription(id), deps.planForPriceId);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await applyStripeSubscription(db, await deps.retrieveSubscription(event.data.object.id), deps.planForPriceId);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      const subscription = customerId ? await c.subscriptions.findOne({ stripeCustomerId: customerId }) : null;
      if (subscription) {
        await c.notifications.insertOne({
          _id: new ObjectId(),
          workspaceId: subscription._id,
          kind: "payment_failed",
          title: "Paiement de l'abonnement refusé",
          body: "Le paiement de votre abonnement n'a pas abouti. Mettez à jour votre moyen de paiement pour conserver votre offre.",
          link: "/abonnement",
          readAt: null,
          createdAt: new Date(),
        });
      }
      break;
    }
    default:
      handled = false;
  }

  try {
    await c.stripeEvents.insertOne({ _id: event.id, type: event.type, processedAt: new Date() });
  } catch {
    // Événement traité en parallèle par une autre instance : le traitement est idempotent.
  }
  return handled ? "processed" : "ignored";
}

/** Résilie immédiatement les abonnements des espaces d'un utilisateur (avant suppression de son compte). */
export async function cancelSubscriptionsOfOwner(db: Db, ownerUserId: string, stripe: Stripe | null): Promise<void> {
  const owned = await collections(db).workspaces.find({ ownerUserId }, { projection: { _id: 1 } }).toArray();
  const subscriptions = await collections(db)
    .subscriptions.find({ _id: { $in: owned.map((w) => w._id) }, stripeSubscriptionId: { $ne: null }, status: { $in: ACTIVE } })
    .toArray();
  if (subscriptions.length === 0) return;
  if (!stripe) throw new Error("Abonnement actif mais Stripe n'est pas configuré : suppression impossible sans résiliation.");
  for (const subscription of subscriptions) {
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId as string);
  }
}
