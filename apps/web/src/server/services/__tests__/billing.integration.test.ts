/**
 * Abonnements et crédits sur une vraie base MongoDB (TEST_MONGODB_URI, fourni en CI).
 * Les objets Stripe sont construits à la main : aucun appel à Stripe.
 */
import { MongoClient, ObjectId, type Db } from "mongodb";
import type Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { collections } from "@/server/db/collections";
import { runMigrations } from "@/server/db/migrations";
import { chargeCredits, getCreditAccount, getEffectivePlan, refundCredits, remainingCredits } from "@/server/services/billing";
import { handleStripeEvent } from "@/server/services/subscriptions";
import { ensurePersonalWorkspace } from "@/server/services/workspaces";

const uri = process.env.TEST_MONGODB_URI;
const PRICES: Record<string, "solo" | "business"> = { price_solo: "solo", price_business: "business" };

function subscription(overrides: { id?: string; workspaceId: string; price: string; status: Stripe.Subscription.Status; cancel?: boolean }) {
  return {
    id: overrides.id ?? "sub_1",
    object: "subscription",
    customer: "cus_1",
    status: overrides.status,
    cancel_at_period_end: overrides.cancel ?? false,
    metadata: { workspaceId: overrides.workspaceId },
    items: { data: [{ price: { id: overrides.price }, current_period_end: 1_900_000_000 }] },
  } as unknown as Stripe.Subscription;
}

function event(id: string, type: string, object: unknown) {
  return { id, type, data: { object } } as unknown as Stripe.Event;
}

describe.skipIf(!uri)("abonnements et crédits (MongoDB réel)", () => {
  let client: MongoClient;
  let db: Db;
  let workspace: Awaited<ReturnType<typeof ensurePersonalWorkspace>>;

  beforeAll(async () => {
    client = new MongoClient(uri as string);
    await client.connect();
    db = client.db(`smia_test_bill_${Date.now()}`);
    await runMigrations(db, () => {});
    workspace = await ensurePersonalWorkspace(db, { id: "alice", name: "Alice" });
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  it("installe les 4 offres et place un nouvel espace sur l'offre gratuite", async () => {
    expect(await collections(db).plans.countDocuments()).toBe(4);
    const effective = await getEffectivePlan(db, workspace);
    expect(effective.planId).toBe("free");
    expect((await getCreditAccount(db, workspace)).allowance).toBe(effective.limits.monthlyCredits);
  });

  it("ne débite jamais deux fois la même opération et rembourse une seule fois", async () => {
    const key = "job:test-1";
    await chargeCredits(db, workspace, { operation: "campaign_posts", idempotencyKey: key, generationJobId: null });
    await chargeCredits(db, workspace, { operation: "campaign_posts", idempotencyKey: key, generationJobId: null });
    expect((await getCreditAccount(db, workspace)).used).toBe(2);
    await refundCredits(db, workspace._id, { chargeKey: key, generationJobId: null });
    await refundCredits(db, workspace._id, { chargeKey: key, generationJobId: null });
    expect((await getCreditAccount(db, workspace)).used).toBe(0);
  });

  it("des débits simultanés ne dépassent jamais le solde", async () => {
    const account = await getCreditAccount(db, workspace);
    await collections(db).creditAccounts.updateOne({ _id: account._id }, { $set: { allowance: 5, used: 0 } });
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        chargeCredits(db, workspace, { operation: "text_generation", idempotencyKey: `job:par-${i}`, generationJobId: null }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    const after = await getCreditAccount(db, workspace);
    expect(after.used).toBe(5);
    expect(remainingCredits(after)).toBe(0);
  });

  it("active l'offre payée, ajuste les crédits du mois et ignore un webhook déjà traité", async () => {
    const workspaceId = workspace._id.toHexString();
    const retrieve = vi.fn(async () => subscription({ workspaceId, price: "price_solo", status: "active" }));
    const deps = { retrieveSubscription: retrieve, planForPriceId: (id: string) => PRICES[id] ?? null };

    expect(await handleStripeEvent(db, event("evt_1", "checkout.session.completed", { subscription: "sub_1" }), deps)).toBe("processed");
    expect(await handleStripeEvent(db, event("evt_1", "checkout.session.completed", { subscription: "sub_1" }), deps)).toBe("duplicate");
    expect(retrieve).toHaveBeenCalledTimes(1);

    const effective = await getEffectivePlan(db, workspace);
    expect(effective.planId).toBe("solo");
    expect((await getCreditAccount(db, workspace)).allowance).toBe(effective.limits.monthlyCredits);
    expect((await collections(db).subscriptions.findOne({ _id: workspace._id }))?.currentPeriodEnd?.getTime()).toBe(1_900_000_000_000);
  });

  it("garde l'offre pendant un retard de paiement, revient au gratuit après résiliation", async () => {
    const workspaceId = workspace._id.toHexString();
    const deps = (status: Stripe.Subscription.Status) => ({
      retrieveSubscription: async () => subscription({ workspaceId, price: "price_business", status }),
      planForPriceId: (id: string) => PRICES[id] ?? null,
    });
    await handleStripeEvent(db, event("evt_2", "customer.subscription.updated", { id: "sub_1" }), deps("past_due"));
    expect((await getEffectivePlan(db, workspace)).planId).toBe("business");

    await handleStripeEvent(db, event("evt_3", "customer.subscription.deleted", { id: "sub_1" }), deps("canceled"));
    expect((await getEffectivePlan(db, workspace)).planId).toBe("free");
  });

  it("prévient l'utilisateur d'un paiement refusé", async () => {
    await handleStripeEvent(db, event("evt_4", "invoice.payment_failed", { customer: "cus_1" }), {
      retrieveSubscription: async () => {
        throw new Error("ne doit pas être appelé");
      },
      planForPriceId: () => null,
    });
    expect(await collections(db).notifications.countDocuments({ workspaceId: workspace._id, kind: "payment_failed" })).toBe(1);
  });

  it("n'applique pas un abonnement d'un espace inconnu", async () => {
    const stranger = new ObjectId().toHexString();
    await handleStripeEvent(db, event("evt_5", "customer.subscription.updated", { id: "sub_x" }), {
      retrieveSubscription: async () => ({ ...subscription({ workspaceId: stranger, price: "price_solo", status: "active" }), customer: "cus_inconnu" }) as Stripe.Subscription,
      planForPriceId: (id: string) => PRICES[id] ?? null,
    });
    // L'abonnement est enregistré pour l'espace indiqué par Stripe, sans toucher à celui d'Alice.
    expect((await getEffectivePlan(db, workspace)).planId).toBe("free");
  });
});
