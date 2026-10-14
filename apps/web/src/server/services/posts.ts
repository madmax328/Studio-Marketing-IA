import { ObjectId, type Db, type Filter } from "mongodb";
import {
  checkTextLength,
  EDITABLE_POST_STATUSES,
  postDraftSchema,
  SOCIAL_NETWORKS,
  type PostStatus,
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
