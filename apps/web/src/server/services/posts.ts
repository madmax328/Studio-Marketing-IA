import { ObjectId, type Db, type Filter } from "mongodb";
import {
  checkTextLength,
  EDITABLE_POST_STATUSES,
  postDraftSchema,
  postScheduleSchema,
  SOCIAL_NETWORK_IDS,
  SOCIAL_NETWORKS,
  zonedToUtc,
  type PostStatus,
  type SocialNetworkId,
} from "@smia/shared";
import { collections, type PostDoc } from "@/server/db/collections";
import { recordAudit } from "@/server/services/audit";
import { getBrand } from "@/server/services/brands";
import { UserFacingError } from "@/server/services/errors";
import { assertPermission } from "@/server/services/permissions";
import type { WorkspaceAccess } from "@/server/services/workspaces";

export const POSTS_PAGE_SIZE = 20;

export interface PostPage {
  items: PostDoc[];
  total: number;
  page: number;
  pageCount: number;
}

export async function listPosts(
  db: Db,
  access: WorkspaceAccess,
  options: { status?: PostStatus | undefined; page?: number } = {},
): Promise<PostPage> {
  assertPermission(access, "content:read");
  const filter: Filter<PostDoc> = { workspaceId: access.workspace._id };
  if (options.status) filter.status = options.status;
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const { posts } = collections(db);

  const [items, total] = await Promise.all([
    posts
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * POSTS_PAGE_SIZE)
      .limit(POSTS_PAGE_SIZE)
      .toArray(),
    posts.countDocuments(filter),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / POSTS_PAGE_SIZE)) };
}

export async function getPost(db: Db, access: WorkspaceAccess, postId: string): Promise<PostDoc> {
  assertPermission(access, "content:read");
  const post = ObjectId.isValid(postId)
    ? await collections(db).posts.findOne({ _id: new ObjectId(postId), workspaceId: access.workspace._id })
    : null;
  if (!post) throw new UserFacingError("Publication introuvable.", "not_found");
  return post;
}

export async function createDraft(db: Db, access: WorkspaceAccess, userId: string, input: unknown): Promise<PostDoc> {
  assertPermission(access, "content:write");
  const parsed = postDraftSchema.safeParse(input);
  if (!parsed.success) {
    throw new UserFacingError(parsed.error.issues[0]?.message ?? "Données invalides.", "invalid_input");
  }
  const data = parsed.data;
  assertTextFits(data.network, data.text);

  const brand = await getBrand(db, access, data.brandId);
  const c = collections(db);

  let generationJobId: ObjectId | null = null;
  if (data.generationJobId && ObjectId.isValid(data.generationJobId)) {
    const job = await c.generationJobs.findOne(
      { _id: new ObjectId(data.generationJobId), workspaceId: access.workspace._id },
      { projection: { _id: 1 } },
    );
    generationJobId = job?._id ?? null;
  }

  const now = new Date();
  const post: PostDoc = {
    _id: new ObjectId(),
    workspaceId: access.workspace._id,
    brandId: brand._id,
    network: data.network,
    status: "draft",
    text: data.text,
    rationale: data.rationale,
    generationJobId,
    scheduledAt: null,
    timeZone: brand.timeZone,
    publishedAt: null,
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
  await c.posts.insertOne(post);
  await recordAudit(db, {
    workspaceId: access.workspace._id,
    actorUserId: userId,
    action: "post.draft_created",
    targetId: post._id.toHexString(),
  });
  return post;
}

export async function updatePostText(
  db: Db,
  access: WorkspaceAccess,
  postId: string,
  rawText: unknown,
): Promise<PostDoc> {
  assertPermission(access, "content:write");
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text) throw new UserFacingError("Le texte est vide.", "invalid_input");

  const post = await getPost(db, access, postId);
  assertEditable(post);
  assertTextFits(post.network, text);

  const updated = await collections(db).posts.findOneAndUpdate(
    { _id: post._id, workspaceId: access.workspace._id, status: { $in: [...EDITABLE_POST_STATUSES] } },
    { $set: { text, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new UserFacingError("Cette publication ne peut plus être modifiée.", "conflict");
  return updated;
}

export async function deletePost(db: Db, access: WorkspaceAccess, userId: string, postId: string): Promise<void> {
  assertPermission(access, "content:write");
  const post = await getPost(db, access, postId);
  assertEditable(post);
  const result = await collections(db).posts.deleteOne({
    _id: post._id,
    workspaceId: access.workspace._id,
    status: { $in: [...EDITABLE_POST_STATUSES] },
  });
  if (result.deletedCount === 0) throw new UserFacingError("Cette publication ne peut plus être supprimée.", "conflict");
  await recordAudit(db, {
    workspaceId: access.workspace._id,
    actorUserId: userId,
    action: "post.deleted",
    targetId: post._id.toHexString(),
  });
}

function assertEditable(post: PostDoc) {
  if (!EDITABLE_POST_STATUSES.includes(post.status)) {
    throw new UserFacingError("Cette publication ne peut plus être modifiée.", "conflict");
  }
}

function assertTextFits(network: PostDoc["network"], text: string) {
  const problem = checkTextLength(network, text);
  if (problem) throw new UserFacingError(problem, "invalid_input");
}

export const MAX_MEDIA_PER_POST = 10;

/** Remplace les médias joints à une publication (uniquement des médias du même espace). */
export async function setPostMedia(db: Db, access: WorkspaceAccess, postId: string, rawIds: unknown): Promise<PostDoc> {
  assertPermission(access, "content:write");
  const ids = Array.isArray(rawIds) ? rawIds.filter((id): id is string => typeof id === "string") : [];
  if (ids.length > MAX_MEDIA_PER_POST) {
    throw new UserFacingError(`${MAX_MEDIA_PER_POST} images maximum par publication.`, "invalid_input");
  }
  const post = await getPost(db, access, postId);
  assertEditable(post);
  const network = SOCIAL_NETWORKS[post.network];
  if (ids.length > 0 && !network.publishableMedia.includes("image")) {
    throw new UserFacingError(`${network.label} n'accepte pas d'images.`, "invalid_input");
  }
  if (ids.length > 1 && !network.publishableMedia.includes("carousel")) {
    throw new UserFacingError(`${network.label} n'accepte qu'une image par publication.`, "invalid_input");
  }

  const objectIds = [...new Set(ids)].filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  const found = await collections(db)
    .mediaAssets.find({ _id: { $in: objectIds }, workspaceId: access.workspace._id }, { projection: { _id: 1 } })
    .toArray();
  if (found.length !== objectIds.length) throw new UserFacingError("Média introuvable.", "not_found");

  const updated = await collections(db).posts.findOneAndUpdate(
    { _id: post._id, workspaceId: access.workspace._id, status: { $in: [...EDITABLE_POST_STATUSES] } },
    { $set: { mediaIds: objectIds, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new UserFacingError("Cette publication ne peut plus être modifiée.", "conflict");
  return updated;
}

/** Délai minimal entre maintenant et l'heure programmée. */
export const MIN_SCHEDULE_DELAY_MS = 5 * 60_000;

/**
 * Problèmes qui empêchent de programmer une publication (liste vide = programmable).
 * Les connexions aux réseaux sont vérifiées au moment de l'envoi, pas ici.
 */
export function schedulingProblems(post: Pick<PostDoc, "network" | "text" | "mediaIds">): string[] {
  const network = SOCIAL_NETWORKS[post.network];
  const problems: string[] = [];
  const length = checkTextLength(post.network, post.text);
  if (length) problems.push(length);
  const media = post.mediaIds ?? [];
  if (media.length === 0 && !network.allowsTextOnly) {
    problems.push(
      network.publishableMedia.includes("image")
        ? `${network.label} exige une image : ajoutez-en une à la publication.`
        : `${network.label} exige une vidéo : la création de vidéos arrive dans une prochaine étape.`,
    );
  }
  return problems;
}

function parseLocalDateTime(input: unknown, timeZone: string, now = new Date()): Date {
  const parsed = postScheduleSchema.safeParse(input);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Date invalide.", "invalid_input");
  const result = zonedToUtc(parsed.data.date, parsed.data.time, timeZone);
  if (!result.ok) {
    throw new UserFacingError(
      result.reason === "nonexistent"
        ? "Cette heure n'existe pas ce jour-là (changement d'heure). Choisissez une autre heure."
        : "Date ou heure invalide.",
      "invalid_input",
    );
  }
  if (result.instant.getTime() < now.getTime() + MIN_SCHEDULE_DELAY_MS) {
    throw new UserFacingError("Choisissez une date et une heure dans le futur (au moins 5 minutes).", "invalid_input");
  }
  return result.instant;
}

/**
 * Fixe la date d'une publication.
 * - mode "plan" : la date est notée mais la publication reste un brouillon ;
 * - mode "schedule" : la publication est programmée (contenu vérifié).
 */
export async function setPostSchedule(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  postId: string,
  input: unknown,
  mode: "plan" | "schedule",
): Promise<PostDoc> {
  assertPermission(access, mode === "schedule" ? "content:publish" : "content:write");
  const post = await getPost(db, access, postId);
  if (!["draft", "scheduled", "failed"].includes(post.status)) {
    throw new UserFacingError("Cette publication ne peut plus être déplacée.", "conflict");
  }
  const scheduledAt = parseLocalDateTime(input, post.timeZone);

  let status: PostStatus = post.status === "failed" ? "draft" : post.status;
  if (mode === "schedule") {
    const problems = schedulingProblems(post);
    if (problems.length > 0) throw new UserFacingError(problems.join(" "), "invalid_input");
    status = "scheduled";
  }

  const updated = await collections(db).posts.findOneAndUpdate(
    { _id: post._id, workspaceId: access.workspace._id, status: post.status },
    { $set: { scheduledAt, status, "publishing.nextAttemptAt": null, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new UserFacingError("La publication a changé entre-temps. Rechargez la page.", "conflict");
  if (mode === "schedule") {
    await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "post.scheduled", targetId: postId });
  }
  return updated;
}

/** Annule la programmation : la publication redevient un brouillon (sa date est conservée). */
export async function unschedulePost(db: Db, access: WorkspaceAccess, userId: string, postId: string): Promise<PostDoc> {
  assertPermission(access, "content:publish");
  const post = await getPost(db, access, postId);
  const updated = await collections(db).posts.findOneAndUpdate(
    { _id: post._id, workspaceId: access.workspace._id, status: "scheduled" },
    { $set: { status: "draft", updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new UserFacingError("Cette publication n'est pas (ou plus) programmée.", "conflict");
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "post.unscheduled", targetId: postId });
  return updated;
}

/** Duplique une publication en brouillon sans date. */
export async function duplicatePost(db: Db, access: WorkspaceAccess, userId: string, postId: string): Promise<PostDoc> {
  assertPermission(access, "content:write");
  const post = await getPost(db, access, postId);
  const now = new Date();
  // Le suivi d'envoi n'est pas copié (un champ null empêcherait la mise à jour de ses sous-champs).
  const { publishing: _publishing, ...rest } = post;
  const copy: PostDoc = {
    ...rest,
    _id: new ObjectId(),
    status: "draft",
    scheduledAt: null,
    publishedAt: null,
    slotId: null,
    createdAt: now,
    updatedAt: now,
  };
  await collections(db).posts.insertOne(copy);
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "post.duplicated", targetId: postId });
  return copy;
}

export interface CalendarFilters {
  brandId?: string | undefined;
  network?: string | undefined;
  campaignId?: string | undefined;
  status?: string | undefined;
}

/** Publications datées sur une période [from, to[ (instants UTC), avec filtres vérifiés. */
export async function listCalendarPosts(
  db: Db,
  access: WorkspaceAccess,
  from: Date,
  to: Date,
  filters: CalendarFilters = {},
): Promise<PostDoc[]> {
  assertPermission(access, "content:read");
  const filter: Filter<PostDoc> = { workspaceId: access.workspace._id, scheduledAt: { $gte: from, $lt: to } };
  if (filters.brandId && ObjectId.isValid(filters.brandId)) filter.brandId = new ObjectId(filters.brandId);
  if (filters.campaignId && ObjectId.isValid(filters.campaignId)) filter.campaignId = new ObjectId(filters.campaignId);
  if (filters.network && (SOCIAL_NETWORK_IDS as readonly string[]).includes(filters.network)) {
    filter.network = filters.network as SocialNetworkId;
  }
  if (filters.status && ["draft", "scheduled", "processing", "published", "failed", "cancelled"].includes(filters.status)) {
    filter.status = filters.status as PostStatus;
  }
  return collections(db).posts.find(filter).sort({ scheduledAt: 1 }).limit(1000).toArray();
}

/** Libellé de statut honnête : une publication « envoyée » en simulation n'est jamais présentée comme publiée. */
export function postStatusLabel(post: Pick<PostDoc, "status" | "publishing">, labels: Record<PostStatus, string>): string {
  if (post.status === "published" && post.publishing?.simulated) return "Simulée (rien n'a été publié)";
  return labels[post.status];
}
