import { randomUUID } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { MAX_UPLOAD_BYTES, templateRenderSchema, TEMPLATE_LABELS } from "@smia/shared";
import { collections, type MediaAssetDoc } from "@/server/db/collections";
import { inspectImage, toEmbeddableDataUrl, toJpeg } from "@/server/media/images";
import { workspaceStoragePrefix, type MediaStorage } from "@/server/media/storage";
import { renderTemplatePng } from "@/server/media/templates";
import { recordAudit } from "@/server/services/audit";
import { getBrand } from "@/server/services/brands";
import { UserFacingError } from "@/server/services/errors";
import { assertPermission } from "@/server/services/permissions";
import type { WorkspaceAccess } from "@/server/services/workspaces";

export const MEDIA_PAGE_SIZE = 24;
const DEFAULT_COLOR = "#4f46e5";
const DEFAULT_SECONDARY = "#f4f4f5";

function assertStorage(storage: MediaStorage) {
  if (!storage.isConfigured()) {
    throw new UserFacingError("Le stockage des médias n'est pas encore activé sur cette installation.", "unavailable");
  }
}

/** Chemin de stockage d'un envoi : le serveur l'impose, le navigateur ne choisit que le nom. */
export function uploadKeyFor(access: WorkspaceAccess, fileName: string): string {
  const safe = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return `${workspaceStoragePrefix(access.workspace._id.toHexString())}uploads/${randomUUID()}-${safe || "image"}`;
}

export async function listMedia(db: Db, access: WorkspaceAccess, page = 1) {
  assertPermission(access, "content:read");
  const filter = { workspaceId: access.workspace._id };
  const current = Math.max(1, Math.floor(page));
  const { mediaAssets } = collections(db);
  const [items, total] = await Promise.all([
    mediaAssets.find(filter).sort({ createdAt: -1 }).skip((current - 1) * MEDIA_PAGE_SIZE).limit(MEDIA_PAGE_SIZE).toArray(),
    mediaAssets.countDocuments(filter),
  ]);
  return { items, total, page: current, pageCount: Math.max(1, Math.ceil(total / MEDIA_PAGE_SIZE)) };
}

export async function getMedia(db: Db, access: WorkspaceAccess, mediaId: string): Promise<MediaAssetDoc> {
  assertPermission(access, "content:read");
  const media = ObjectId.isValid(mediaId)
    ? await collections(db).mediaAssets.findOne({ _id: new ObjectId(mediaId), workspaceId: access.workspace._id })
    : null;
  if (!media) throw new UserFacingError("Média introuvable.", "not_found");
  return media;
}

/**
 * Enregistre un fichier envoyé directement au stockage par le navigateur.
 * Le fichier n'est accepté qu'après vérification de son emplacement, de sa taille et de son contenu réel.
 */
export async function registerUpload(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  storage: MediaStorage,
  input: { storageKey: unknown; name: unknown; brandId?: unknown },
): Promise<MediaAssetDoc> {
  assertPermission(access, "content:write");
  assertStorage(storage);
  const storageKey = typeof input.storageKey === "string" ? input.storageKey : "";
  const prefix = `${workspaceStoragePrefix(access.workspace._id.toHexString())}uploads/`;
  if (!storageKey.startsWith(prefix) || storageKey.includes("..")) {
    throw new UserFacingError("Fichier invalide.", "forbidden");
  }

  const existing = await collections(db).mediaAssets.findOne({ storageKey, workspaceId: access.workspace._id });
  if (existing) return existing;

  const stat = await storage.stat(storageKey);
  if (!stat) throw new UserFacingError("Le fichier envoyé est introuvable. Réessayez l'envoi.", "not_found");
  if (stat.size > MAX_UPLOAD_BYTES) {
    await storage.remove([storageKey]);
    throw new UserFacingError("Fichier trop volumineux (15 Mo maximum).", "invalid_input");
  }

  const bytes = await storage.readBuffer(storageKey);
  const info = bytes ? await inspectImage(bytes) : null;
  if (!bytes || !info) {
    await storage.remove([storageKey]);
    throw new UserFacingError("Ce fichier n'est pas une image JPEG, PNG ou WebP valide.", "invalid_input");
  }

  const brandId =
    typeof input.brandId === "string" && input.brandId ? (await getBrand(db, access, input.brandId))._id : null;
  const now = new Date();
  const media: MediaAssetDoc = {
    _id: new ObjectId(),
    workspaceId: access.workspace._id,
    brandId,
    createdByUserId: userId,
    kind: "image",
    source: "upload",
    name: (typeof input.name === "string" ? input.name : "image").slice(0, 120),
    mimeType: info.mimeType,
    size: bytes.length,
    width: info.width,
    height: info.height,
    storageKey,
    status: "ready",
    createdAt: now,
    updatedAt: now,
  };
  await collections(db).mediaAssets.insertOne(media);
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "media.uploaded", targetId: media._id.toHexString() });
  return media;
}

/** Prépare les données d'un gabarit (marque, logo, photo de fond) et produit l'image JPEG. */
export async function renderTemplate(db: Db, access: WorkspaceAccess, storage: MediaStorage, input: unknown) {
  assertPermission(access, "content:read");
  const parsed = templateRenderSchema.safeParse(input);
  if (!parsed.success) {
    throw new UserFacingError(parsed.error.issues[0]?.message ?? "Données invalides.", "invalid_input");
  }
  const data = parsed.data;
  const brand = await getBrand(db, access, data.brandId);

  let backgroundDataUrl: string | null = null;
  if (TEMPLATE_LABELS[data.templateId].needsPhoto) {
    if (!data.backgroundMediaId) throw new UserFacingError("Choisissez une photo pour ce gabarit.", "invalid_input");
    assertStorage(storage);
    const background = await getMedia(db, access, data.backgroundMediaId);
    const bytes = await storage.readBuffer(background.storageKey);
    if (!bytes) throw new UserFacingError("La photo choisie est introuvable.", "not_found");
    backgroundDataUrl = await toEmbeddableDataUrl(bytes, 2160, false);
  }

  let logoDataUrl: string | null = null;
  if (data.showLogo && brand.logoMediaId && storage.isConfigured()) {
    const logo = await collections(db).mediaAssets.findOne({ _id: brand.logoMediaId, workspaceId: access.workspace._id });
    const bytes = logo ? await storage.readBuffer(logo.storageKey) : null;
    if (bytes) logoDataUrl = await toEmbeddableDataUrl(bytes, 600, true);
  }

  const png = await renderTemplatePng({
    templateId: data.templateId,
    format: data.format,
    title: data.title,
    subtitle: data.subtitle,
    brandName: brand.name,
    color: data.color ?? brand.brandColors[0] ?? DEFAULT_COLOR,
    secondaryColor: brand.brandColors[1] ?? DEFAULT_SECONDARY,
    backgroundDataUrl,
    logoDataUrl,
  });
  return { jpeg: await toJpeg(png), brand, data };
}

/** Crée un visuel à partir d'un gabarit et l'ajoute à la médiathèque. */
export async function createTemplateMedia(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  storage: MediaStorage,
  input: unknown,
): Promise<MediaAssetDoc> {
  assertPermission(access, "content:write");
  assertStorage(storage);
  const { jpeg, brand, data } = await renderTemplate(db, access, storage, input);
  const info = await inspectImage(jpeg);
  if (!info) throw new Error("Le visuel produit est invalide.");

  const storageKey = `${workspaceStoragePrefix(access.workspace._id.toHexString())}visuels/${randomUUID()}.jpg`;
  await storage.put(storageKey, jpeg, "image/jpeg");

  const now = new Date();
  const media: MediaAssetDoc = {
    _id: new ObjectId(),
    workspaceId: access.workspace._id,
    brandId: brand._id,
    createdByUserId: userId,
    kind: "image",
    source: "template",
    name: data.title.slice(0, 120),
    mimeType: "image/jpeg",
    size: jpeg.length,
    width: info.width,
    height: info.height,
    storageKey,
    status: "ready",
    createdAt: now,
    updatedAt: now,
  };
  await collections(db).mediaAssets.insertOne(media);
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "media.template_created", targetId: media._id.toHexString() });
  return media;
}

/** Supprime un média : retiré des publications et du logo, puis effacé du stockage. */
export async function deleteMedia(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  storage: MediaStorage,
  mediaId: string,
): Promise<void> {
  assertPermission(access, "content:write");
  const media = await getMedia(db, access, mediaId);
  const c = collections(db);
  await c.posts.updateMany({ workspaceId: access.workspace._id, mediaIds: media._id }, { $pull: { mediaIds: media._id } });
  await c.brands.updateMany({ workspaceId: access.workspace._id, logoMediaId: media._id }, { $set: { logoMediaId: null } });
  await c.mediaAssets.deleteOne({ _id: media._id, workspaceId: access.workspace._id });
  if (storage.isConfigured()) await storage.remove([media.storageKey]);
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "media.deleted", targetId: mediaId });
}

/** Définit (ou retire avec null) le logo d'une marque. */
export async function setBrandLogo(db: Db, access: WorkspaceAccess, brandId: string, mediaId: string | null): Promise<void> {
  assertPermission(access, "brand:write");
  const brand = await getBrand(db, access, brandId);
  const logoMediaId = mediaId ? (await getMedia(db, access, mediaId))._id : null;
  await collections(db).brands.updateOne(
    { _id: brand._id, workspaceId: access.workspace._id },
    { $set: { logoMediaId, updatedAt: new Date() } },
  );
}
