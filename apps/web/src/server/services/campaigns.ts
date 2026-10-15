import { randomUUID } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import {
  campaignInputSchema,
  campaignStrategySchema,
  composePostText,
  daysBetween,
  MAX_CAMPAIGN_SLOTS,
  spreadSlots,
  weekdayOf,
  zonedToUtc,
  type CampaignPostsOutput,
  type CampaignSlot,
  type StrategyOutput,
} from "@smia/shared";
import type { TextGenerationProvider } from "@/server/ai/types";
import { collections, type CampaignDoc, type PostDoc } from "@/server/db/collections";
import { recordAudit } from "@/server/services/audit";
import { getBrand } from "@/server/services/brands";
import { UserFacingError } from "@/server/services/errors";
import { runAiJob } from "@/server/services/generation";
import { assertPermission } from "@/server/services/permissions";
import { getPost, schedulingProblems } from "@/server/services/posts";
import type { WorkspaceAccess } from "@/server/services/workspaces";

/** Nombre de créneaux rédigés par appel à l'IA (garde chaque appel court). */
export const CAMPAIGN_BATCH_SIZE = 4;
const WEEKDAY_LABELS = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

function invalid(error: { issues: { message: string }[] }): UserFacingError {
  return new UserFacingError(error.issues[0]?.message ?? "Données invalides.", "invalid_input");
}

export async function createCampaign(db: Db, access: WorkspaceAccess, userId: string, input: unknown): Promise<CampaignDoc> {
  assertPermission(access, "content:write");
  const parsed = campaignInputSchema.safeParse(input);
  if (!parsed.success) throw invalid(parsed.error);
  const data = parsed.data;
  const brand = await getBrand(db, access, data.brandId);

  const slotCount = spreadSlots(data.startDate, data.endDate, data.postsPerWeek, data.defaultTime).length;
  if (slotCount > MAX_CAMPAIGN_SLOTS) {
    throw new UserFacingError(
      `Cette campagne prévoit ${slotCount} publications par réseau : réduisez la durée ou la fréquence (${MAX_CAMPAIGN_SLOTS} maximum).`,
      "invalid_input",
    );
  }

  const now = new Date();
  const campaign: CampaignDoc = {
    _id: new ObjectId(),
    workspaceId: access.workspace._id,
    brandId: brand._id,
    createdByUserId: userId,
    name: data.name,
    objective: data.objective,
    networks: data.networks,
    highlights: data.highlights,
    startDate: data.startDate,
    endDate: data.endDate,
    postsPerWeek: data.postsPerWeek,
    defaultTime: data.defaultTime,
    timeZone: brand.timeZone,
    status: "draft",
    strategy: null,
    missingInformation: [],
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
  await collections(db).campaigns.insertOne(campaign);
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "campaign.created", targetId: campaign._id.toHexString() });
  return campaign;
}

export async function listCampaigns(db: Db, access: WorkspaceAccess): Promise<CampaignDoc[]> {
  assertPermission(access, "content:read");
  return collections(db).campaigns.find({ workspaceId: access.workspace._id }).sort({ createdAt: -1 }).limit(100).toArray();
}

export async function getCampaign(db: Db, access: WorkspaceAccess, campaignId: string): Promise<CampaignDoc> {
  assertPermission(access, "content:read");
  const campaign = ObjectId.isValid(campaignId)
    ? await collections(db).campaigns.findOne({ _id: new ObjectId(campaignId), workspaceId: access.workspace._id })
    : null;
  if (!campaign) throw new UserFacingError("Campagne introuvable.", "not_found");
  return campaign;
}

function campaignContext(campaign: CampaignDoc, brand: Awaited<ReturnType<typeof getBrand>>) {
  return {
    brand,
    name: campaign.name,
    objective: campaign.objective,
    networks: campaign.networks,
    highlights: campaign.highlights,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
  };
}

/** L'IA propose une stratégie : sujet, type et rôle de chaque créneau (dates calculées par l'application). */
export async function proposeStrategy(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  campaignId: string,
  requestId: unknown,
  provider: TextGenerationProvider,
): Promise<CampaignDoc> {
  const campaign = await getCampaign(db, access, campaignId);
  if (campaign.status === "validated" || campaign.status === "archived") {
    throw new UserFacingError("La stratégie est déjà validée.", "conflict");
  }
  if (typeof requestId !== "string" || requestId.length < 8) throw new UserFacingError("Demande invalide.", "invalid_input");
  const brand = await getBrand(db, access, campaign.brandId.toHexString());
  const dates = spreadSlots(campaign.startDate, campaign.endDate, campaign.postsPerWeek, campaign.defaultTime);

  const { output } = await runAiJob<StrategyOutput>(
    db,
    access,
    userId,
    provider,
    { requestId, kind: "campaign_strategy", operation: "campaign_strategy", brandId: brand._id, campaignId: campaign._id, request: { slots: dates.length } },
    () =>
      provider.generateCampaignStrategy({
        ...campaignContext(campaign, brand),
        slots: dates.map((slot, index) => ({ index, date: slot.date, weekday: WEEKDAY_LABELS[weekdayOf(slot.date)] ?? "" })),
      }),
  );

  const slots: CampaignSlot[] = dates.map((slot, index) => {
    const proposal = output.slots.find((item) => item.index === index);
    return {
      slotId: randomUUID(),
      date: slot.date,
      time: slot.time,
      // Créneau oublié par l'IA : signalé à l'utilisateur plutôt que comblé en silence.
      theme: proposal?.theme.trim() || "À définir",
      kind: proposal?.kind ?? "libre",
      role: proposal?.role.trim() ?? "",
    };
  });

  const updated = await collections(db).campaigns.findOneAndUpdate(
    { _id: campaign._id, workspaceId: access.workspace._id, status: { $in: ["draft", "strategy"] } },
    {
      $set: {
        status: "strategy",
        strategy: { summary: output.summary, keyMessages: output.keyMessages.slice(0, 10), slots },
        missingInformation: output.missingInformation,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new UserFacingError("La campagne a changé entre-temps. Rechargez la page.", "conflict");
  return updated;
}

/** Enregistre la stratégie modifiée par l'utilisateur ; `validate` la fige pour générer les publications. */
export async function saveStrategy(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  campaignId: string,
  input: unknown,
  validate: boolean,
): Promise<CampaignDoc> {
  assertPermission(access, "content:write");
  const campaign = await getCampaign(db, access, campaignId);
  if (campaign.status === "archived") throw new UserFacingError("Cette campagne est archivée.", "conflict");
  const parsed = campaignStrategySchema.safeParse(input);
  if (!parsed.success) throw invalid(parsed.error);
  const strategy = parsed.data;

  for (const slot of strategy.slots) {
    if (daysBetween(campaign.startDate, slot.date) < 0 || daysBetween(slot.date, campaign.endDate) < 0) {
      throw new UserFacingError(`La date du ${slot.date} est en dehors de la campagne.`, "invalid_input");
    }
  }
  if (new Set(strategy.slots.map((slot) => slot.slotId)).size !== strategy.slots.length) {
    throw new UserFacingError("Le plan contient des publications en double.", "invalid_input");
  }

  const updated = await collections(db).campaigns.findOneAndUpdate(
    { _id: campaign._id, workspaceId: access.workspace._id },
    { $set: { strategy, status: validate ? "validated" : "strategy", updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new UserFacingError("Campagne introuvable.", "not_found");
  if (validate) {
    await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "campaign.validated", targetId: campaignId });
  }
  return updated;
}

/** Créneaux du plan qui n'ont encore aucune publication. */
export async function pendingSlotIds(db: Db, access: WorkspaceAccess, campaign: CampaignDoc): Promise<string[]> {
  const done = await collections(db).posts.distinct("slotId", { workspaceId: access.workspace._id, campaignId: campaign._id });
  const doneSet = new Set(done.filter((id): id is string => typeof id === "string"));
  return (campaign.strategy?.slots ?? []).map((slot) => slot.slotId).filter((id) => !doneSet.has(id));
}

function slotInstant(campaign: CampaignDoc, slot: CampaignSlot): Date | null {
  const result = zonedToUtc(slot.date, slot.time, campaign.timeZone);
  return result.ok ? result.instant : null;
}

/**
 * Rédige les publications d'un lot de créneaux (au plus CAMPAIGN_BATCH_SIZE) et les enregistre en brouillons datés.
 * Les créneaux déjà rédigés sont ignorés : relancer un lot ne crée pas de doublons.
 */
export async function generateCampaignBatch(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  campaignId: string,
  requestId: unknown,
  provider: TextGenerationProvider,
): Promise<{ created: number; remaining: number; missingInformation: string[] }> {
  const campaign = await getCampaign(db, access, campaignId);
  if (campaign.status !== "validated" || !campaign.strategy) {
    throw new UserFacingError("Validez d'abord la stratégie.", "conflict");
  }
  if (typeof requestId !== "string" || requestId.length < 8) throw new UserFacingError("Demande invalide.", "invalid_input");
  const brand = await getBrand(db, access, campaign.brandId.toHexString());

  const pending = await pendingSlotIds(db, access, campaign);
  const batch = campaign.strategy.slots.filter((slot) => pending.includes(slot.slotId)).slice(0, CAMPAIGN_BATCH_SIZE);
  if (batch.length === 0) return { created: 0, remaining: 0, missingInformation: [] };

  const { output } = await runAiJob<CampaignPostsOutput>(
    db,
    access,
    userId,
    provider,
    { requestId, kind: "campaign_posts", operation: "campaign_posts", brandId: brand._id, campaignId: campaign._id, request: { slots: batch.map((s) => s.slotId) } },
    () =>
      provider.generateCampaignPosts({
        ...campaignContext(campaign, brand),
        summary: campaign.strategy?.summary ?? "",
        keyMessages: campaign.strategy?.keyMessages ?? [],
        slots: batch.map((slot, index) => ({ index, date: slot.date, theme: slot.theme, kind: slot.kind, role: slot.role })),
      }),
  );

  const now = new Date();
  const posts: PostDoc[] = [];
  batch.forEach((slot, index) => {
    for (const network of campaign.networks) {
      const generated = output.posts.find((post) => post.slotIndex === index && post.network === network);
      if (!generated) continue;
      posts.push({
        _id: new ObjectId(),
        workspaceId: access.workspace._id,
        brandId: brand._id,
        network,
        status: "draft",
        text: composePostText(generated),
        rationale: generated.rationale || slot.role,
        generationJobId: null,
        campaignId: campaign._id,
        slotId: slot.slotId,
        mediaIds: [],
        scheduledAt: slotInstant(campaign, slot),
        timeZone: campaign.timeZone,
        publishedAt: null,
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  // Un créneau sans aucune publication (IA incomplète) reste en attente et pourra être relancé.
  const freshPosts = [];
  for (const post of posts) {
    const exists = await collections(db).posts.findOne(
      { workspaceId: access.workspace._id, campaignId: campaign._id, slotId: post.slotId, network: post.network },
      { projection: { _id: 1 } },
    );
    if (!exists) freshPosts.push(post);
  }
  if (freshPosts.length > 0) await collections(db).posts.insertMany(freshPosts);

  const remaining = (await pendingSlotIds(db, access, campaign)).length;
  return { created: freshPosts.length, remaining, missingInformation: output.missingInformation };
}

/** Réécrit une seule publication de la campagne, sans toucher aux autres. */
export async function regenerateCampaignPost(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  postId: string,
  requestId: unknown,
  provider: TextGenerationProvider,
): Promise<PostDoc> {
  const post = await getPost(db, access, postId);
  if (!post.campaignId || !post.slotId) throw new UserFacingError("Cette publication ne fait pas partie d'une campagne.", "invalid_input");
  if (!["draft", "failed"].includes(post.status)) {
    throw new UserFacingError("Annulez d'abord la programmation pour régénérer cette publication.", "conflict");
  }
  if (typeof requestId !== "string" || requestId.length < 8) throw new UserFacingError("Demande invalide.", "invalid_input");
  const campaign = await getCampaign(db, access, post.campaignId.toHexString());
  const slot = campaign.strategy?.slots.find((item) => item.slotId === post.slotId);
  if (!slot) throw new UserFacingError("Le créneau de cette publication n'existe plus dans le plan.", "not_found");
  const brand = await getBrand(db, access, campaign.brandId.toHexString());

  const { output } = await runAiJob<CampaignPostsOutput>(
    db,
    access,
    userId,
    provider,
    { requestId, kind: "campaign_posts", operation: "campaign_post_regeneration", brandId: brand._id, campaignId: campaign._id, request: { regenerate: postId } },
    () =>
      provider.generateCampaignPosts({
        ...campaignContext(campaign, brand),
        networks: [post.network],
        summary: campaign.strategy?.summary ?? "",
        keyMessages: campaign.strategy?.keyMessages ?? [],
        slots: [{ index: 0, date: slot.date, theme: slot.theme, kind: slot.kind, role: slot.role }],
      }),
  );
  const generated = output.posts.find((item) => item.network === post.network);
  if (!generated) throw new UserFacingError("L'IA n'a pas produit de nouvelle version. Réessayez.", "unavailable");

  const updated = await collections(db).posts.findOneAndUpdate(
    { _id: post._id, workspaceId: access.workspace._id, status: { $in: ["draft", "failed"] } },
    { $set: { text: composePostText(generated), rationale: generated.rationale || slot.role, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new UserFacingError("La publication a changé entre-temps. Rechargez la page.", "conflict");
  return updated;
}

/** Programme d'un coup les brouillons datés et complets de la campagne ; renvoie ceux qui ne le sont pas, avec la raison. */
export async function scheduleCampaignPosts(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  campaignId: string,
  now = new Date(),
): Promise<{ scheduled: number; skipped: { postId: string; reason: string }[] }> {
  assertPermission(access, "content:publish");
  const campaign = await getCampaign(db, access, campaignId);
  const drafts = await collections(db)
    .posts.find({ workspaceId: access.workspace._id, campaignId: campaign._id, status: "draft" })
    .toArray();

  let scheduled = 0;
  const skipped: { postId: string; reason: string }[] = [];
  for (const post of drafts) {
    const problems = schedulingProblems(post);
    if (!post.scheduledAt) problems.push("Aucune date.");
    else if (post.scheduledAt.getTime() < now.getTime() + 5 * 60_000) problems.push("La date est passée.");
    if (problems.length > 0) {
      skipped.push({ postId: post._id.toHexString(), reason: problems.join(" ") });
      continue;
    }
    const result = await collections(db).posts.updateOne(
      { _id: post._id, workspaceId: access.workspace._id, status: "draft" },
      { $set: { status: "scheduled", updatedAt: new Date() } },
    );
    scheduled += result.modifiedCount;
  }
  if (scheduled > 0) {
    await recordAudit(db, {
      workspaceId: access.workspace._id,
      actorUserId: userId,
      action: "campaign.scheduled",
      targetId: campaignId,
      metadata: { scheduled },
    });
  }
  return { scheduled, skipped };
}

export async function archiveCampaign(db: Db, access: WorkspaceAccess, campaignId: string): Promise<void> {
  assertPermission(access, "content:write");
  const campaign = await getCampaign(db, access, campaignId);
  await collections(db).campaigns.updateOne(
    { _id: campaign._id, workspaceId: access.workspace._id },
    { $set: { status: "archived", updatedAt: new Date() } },
  );
}
