import { ObjectId, type Db } from "mongodb";
import { creditPeriod, CREDIT_COSTS, type CreditOperation, type PlanId, type PlanLimits } from "@smia/shared";
import { collections, type CreditAccountDoc, type PlanDoc, type SubscriptionDoc, type WorkspaceDoc } from "@/server/db/collections";
import { UserFacingError } from "@/server/services/errors";
import { assertPermission } from "@/server/services/permissions";
import type { WorkspaceAccess } from "@/server/services/workspaces";

/** Limites appliquées si l'offre gratuite est introuvable en base (ne devrait pas arriver après la migration 006). */
const FALLBACK_FREE_LIMITS: PlanLimits = { maxBrands: 1, monthlyCredits: 20, maxSocialAccounts: 2, maxMembers: 1, maxClientSpaces: 0 };

/** Limites d'équipe par défaut (si l'offre en base ne les précise pas). */
export const TEAM_LIMIT_DEFAULTS: Record<PlanId, Pick<PlanLimits, "maxMembers" | "maxClientSpaces">> = {
  free: { maxMembers: 1, maxClientSpaces: 0 },
  solo: { maxMembers: 2, maxClientSpaces: 0 },
  business: { maxMembers: 5, maxClientSpaces: 0 },
  agency: { maxMembers: 15, maxClientSpaces: 20 },
};

/** Statuts Stripe pour lesquels l'offre payante reste active (« past_due » : délai de grâce pendant les relances). */
const PAID_STATUSES: SubscriptionDoc["status"][] = ["active", "trialing", "past_due"];

export async function listPlans(db: Db): Promise<PlanDoc[]> {
  return collections(db).plans.find({ active: true }).sort({ order: 1 }).toArray();
}

type BillableWorkspace = Pick<WorkspaceDoc, "_id" | "limitOverrides" | "billingWorkspaceId">;

/** Espace qui porte l'abonnement et les crédits : celui de l'agence pour un espace client, sinon l'espace lui-même. */
export async function billingWorkspaceOf(db: Db, workspace: BillableWorkspace): Promise<BillableWorkspace> {
  if (!workspace.billingWorkspaceId) return workspace;
  const parent = await collections(db).workspaces.findOne(
    { _id: workspace.billingWorkspaceId },
    { projection: { _id: 1, limitOverrides: 1, billingWorkspaceId: 1 } },
  );
  // Agence supprimée : l'espace client retombe sur ses propres droits (offre gratuite).
  return parent ? { ...parent, billingWorkspaceId: null } : { ...workspace, billingWorkspaceId: null };
}

export async function getSubscription(db: Db, workspaceId: ObjectId): Promise<SubscriptionDoc | null> {
  return collections(db).subscriptions.findOne({ _id: workspaceId });
}

/** Offre réellement en vigueur pour un espace, et ses limites (dérogations comprises). */
export async function getEffectivePlan(
  db: Db,
  workspace: BillableWorkspace,
): Promise<{ planId: PlanId; plan: PlanDoc | null; subscription: SubscriptionDoc | null; limits: PlanLimits }> {
  const billing = await billingWorkspaceOf(db, workspace);
  const subscription = await getSubscription(db, billing._id);
  const planId: PlanId = subscription && PAID_STATUSES.includes(subscription.status) ? subscription.planId : "free";
  const plan = (await collections(db).plans.findOne({ _id: planId })) ?? (await collections(db).plans.findOne({ _id: "free" }));
  const effectiveId = plan?._id ?? "free";
  const limits: PlanLimits = { ...TEAM_LIMIT_DEFAULTS[effectiveId], ...(plan?.limits ?? FALLBACK_FREE_LIMITS), ...(workspace.limitOverrides ?? {}) };
  return { planId: effectiveId, plan, subscription, limits };
}

/** Compte de crédits du mois en cours, créé à la première utilisation avec l'allocation de l'offre. */
export async function getCreditAccount(db: Db, member: BillableWorkspace, now = new Date()): Promise<CreditAccountDoc> {
  // Les espaces clients d'une agence puisent dans les crédits de l'agence.
  const workspace = await billingWorkspaceOf(db, member);
  const period = creditPeriod(now);
  const _id = `${workspace._id.toHexString()}:${period}`;
  const existing = await collections(db).creditAccounts.findOne({ _id });
  if (existing) return existing;
  const { limits } = await getEffectivePlan(db, workspace);
  try {
    await collections(db).creditAccounts.insertOne({
      _id,
      workspaceId: workspace._id,
      period,
      allowance: limits.monthlyCredits,
      used: 0,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }
  return (await collections(db).creditAccounts.findOne({ _id })) as CreditAccountDoc;
}

export function remainingCredits(account: CreditAccountDoc): number {
  return Math.max(0, account.allowance - account.used);
}

/**
 * Débite des crédits pour une opération. Le débit est conditionnel (jamais de solde négatif)
 * et inscrit au journal avec une clé unique : une même opération n'est jamais comptée deux fois.
 */
export async function chargeCredits(
  db: Db,
  member: BillableWorkspace,
  params: { operation: CreditOperation; idempotencyKey: string; generationJobId: ObjectId | null },
  now = new Date(),
): Promise<void> {
  const c = collections(db);
  const workspace = await billingWorkspaceOf(db, member);
  const source = workspace._id.equals(member._id) ? {} : { sourceWorkspaceId: member._id };
  const cost = CREDIT_COSTS[params.operation];
  const already = await c.creditTransactions.findOne({ workspaceId: workspace._id, idempotencyKey: params.idempotencyKey });
  if (already) return;

  const account = await getCreditAccount(db, workspace, now);
  const debited = await c.creditAccounts.findOneAndUpdate(
    { _id: account._id, $expr: { $lte: [{ $add: ["$used", cost] }, "$allowance"] } },
    { $inc: { used: cost }, $set: { updatedAt: now } },
  );
  if (!debited) {
    throw new UserFacingError(
      `Crédits insuffisants pour cette opération (${cost} nécessaire${cost > 1 ? "s" : ""}). Vos crédits se renouvellent le 1er du mois ; vous pouvez aussi changer d'offre.`,
      "limit_reached",
    );
  }
  try {
    await c.creditTransactions.insertOne({
      _id: new ObjectId(),
      workspaceId: workspace._id,
      period: account.period,
      amount: -cost,
      kind: "charge",
      operation: params.operation,
      idempotencyKey: params.idempotencyKey,
      generationJobId: params.generationJobId,
      ...source,
      createdAt: now,
    });
  } catch (error) {
    // Débit concurrent de la même opération : on annule le nôtre.
    await c.creditAccounts.updateOne({ _id: account._id }, { $inc: { used: -cost } });
    if (!isDuplicateKey(error)) throw error;
  }
}

/** Rembourse une opération qui a échoué (une seule fois, sur le mois du débit). */
export async function refundCredits(
  db: Db,
  member: Pick<WorkspaceDoc, "_id" | "billingWorkspaceId">,
  params: { chargeKey: string; generationJobId: ObjectId | null },
  now = new Date(),
): Promise<void> {
  const c = collections(db);
  const workspaceId = (await billingWorkspaceOf(db, member))._id;
  const charge = await c.creditTransactions.findOne({ workspaceId, idempotencyKey: params.chargeKey, kind: "charge" });
  if (!charge) return;
  try {
    await c.creditTransactions.insertOne({
      _id: new ObjectId(),
      workspaceId,
      period: charge.period,
      amount: -charge.amount,
      kind: "refund",
      operation: charge.operation,
      idempotencyKey: `refund:${params.chargeKey}`,
      generationJobId: params.generationJobId,
      ...(charge.sourceWorkspaceId ? { sourceWorkspaceId: charge.sourceWorkspaceId } : {}),
      createdAt: now,
    });
  } catch (error) {
    if (isDuplicateKey(error)) return; // déjà remboursé
    throw error;
  }
  await c.creditAccounts.updateOne(
    { _id: `${workspaceId.toHexString()}:${charge.period}` },
    { $inc: { used: charge.amount }, $set: { updatedAt: now } },
  );
}

/** Applique l'allocation de l'offre actuelle au mois en cours (après un changement d'offre). */
export async function syncCreditAllowance(db: Db, workspaceId: ObjectId, now = new Date()): Promise<void> {
  const workspace = await collections(db).workspaces.findOne({ _id: workspaceId }, { projection: { limitOverrides: 1 } });
  if (!workspace) return;
  const { limits } = await getEffectivePlan(db, workspace);
  await collections(db).creditAccounts.updateOne(
    { _id: `${workspaceId.toHexString()}:${creditPeriod(now)}` },
    { $set: { allowance: limits.monthlyCredits, updatedAt: now } },
  );
}

export async function listCreditTransactions(db: Db, access: WorkspaceAccess, limit = 50) {
  assertPermission(access, "workspace:read");
  // Espace client : seulement ses propres opérations, dans le journal de l'agence.
  const filter = access.workspace.billingWorkspaceId
    ? { workspaceId: access.workspace.billingWorkspaceId, sourceWorkspaceId: access.workspace._id }
    : { workspaceId: access.workspace._id };
  return collections(db)
    .creditTransactions.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 200))
    .toArray();
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;
}
