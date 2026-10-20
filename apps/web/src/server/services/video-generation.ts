import { randomUUID } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import sharp from "sharp";
import { videoGenerationRequestSchema, type CreditOperation } from "@smia/shared";
import { buildVideoPrompt } from "@/server/ai/image-prompt";
import { TextGenerationError, type VideoGenerationProvider } from "@/server/ai/types";
import { collections, type GenerationJobDoc, type MediaAssetDoc } from "@/server/db/collections";
import { inspectVideo, videoProblems } from "@/server/media/video";
import { workspaceStoragePrefix, type MediaStorage } from "@/server/media/storage";
import { recordAudit } from "@/server/services/audit";
import { chargeCredits, refundCredits } from "@/server/services/billing";
import { getBrand } from "@/server/services/brands";
import { UserFacingError } from "@/server/services/errors";
import { hasAiConsent } from "@/server/services/generation";
import { assertPermission } from "@/server/services/permissions";
import type { WorkspaceAccess } from "@/server/services/workspaces";

/** Au-delà, une création restée en cours est abandonnée (et remboursée). */
const MAX_JOB_MS = 60 * 60_000;
/** Une finalisation interrompue (plantage) peut être reprise après ce délai. */
const FINALIZE_LOCK_MS = 5 * 60_000;

interface VideoJobResult {
  providerJobId?: string;
  progress?: number | null;
  finalizingAt?: Date | null;
  mediaId?: string;
}

export type VideoJobView =
  | { status: "processing"; progress: number | null }
  | { status: "done"; mediaId: string }
  | { status: "failed"; error: string };

const operationFor = (seconds: number): CreditOperation => (seconds > 4 ? "video_generation_8s" : "video_generation_4s");
const chargeKey = (job: Pick<GenerationJobDoc, "_id">) => `job:${job._id.toHexString()}`;

/**
 * Lance la création d'une vidéo par IA : accord, crédits débités (remboursés si elle échoue), une seule exécution
 * par demande. La vidéo arrive quelques minutes plus tard (voir `advanceVideoJob`).
 */
export async function startVideoGeneration(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  input: unknown,
  provider: VideoGenerationProvider,
  storage: MediaStorage,
  now = new Date(),
): Promise<{ jobId: string }> {
  assertPermission(access, "content:write");
  if (!provider.isConfigured()) throw new UserFacingError("La création de vidéos par IA n'est pas encore disponible.", "unavailable");
  if (!storage.isConfigured()) throw new UserFacingError("Le stockage des médias n'est pas encore activé.", "unavailable");
  if (!hasAiConsent(access, provider)) {
    throw new UserFacingError(`Vous devez d'abord accepter l'envoi de votre description à ${provider.label}.`, "consent_required");
  }
  const parsed = videoGenerationRequestSchema.safeParse(input);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Demande invalide.", "invalid_input");
  const request = parsed.data;
  const brand = await getBrand(db, access, request.brandId);
  const { generationJobs } = collections(db);

  const existing = await generationJobs.findOne({ workspaceId: access.workspace._id, requestId: request.requestId });
  if (existing) return { jobId: existing._id.toHexString() };

  const job: GenerationJobDoc = {
    _id: new ObjectId(),
    workspaceId: access.workspace._id,
    brandId: brand._id,
    userId,
    requestId: request.requestId,
    kind: "video",
    provider: provider.id,
    model: null,
    status: "processing",
    request: { description: request.description, orientation: request.orientation, seconds: request.seconds },
    result: {},
    error: null,
    usage: null,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await generationJobs.insertOne(job);
  } catch (error) {
    const concurrent = await generationJobs.findOne({ workspaceId: access.workspace._id, requestId: request.requestId });
    if (concurrent) return { jobId: concurrent._id.toHexString() };
    throw error;
  }

  try {
    await chargeCredits(db, access.workspace, { operation: operationFor(request.seconds), idempotencyKey: chargeKey(job), generationJobId: job._id });
  } catch (error) {
    await generationJobs.updateOne({ _id: job._id }, { $set: { status: "failed", error: error instanceof UserFacingError ? error.message : "Crédits indisponibles.", updatedAt: new Date() } });
    throw error;
  }

  try {
    const started = await provider.startVideo({ prompt: buildVideoPrompt(brand, request), orientation: request.orientation, seconds: request.seconds });
    await generationJobs.updateOne({ _id: job._id }, { $set: { model: started.model, "result.providerJobId": started.id, updatedAt: new Date() } });
  } catch (error) {
    const message = error instanceof TextGenerationError ? error.message : "La création de la vidéo n'a pas pu démarrer. Réessayez.";
    await failJob(db, job, message);
    if (!(error instanceof TextGenerationError)) console.error("Démarrage de vidéo impossible", error);
    throw new UserFacingError(message, "unavailable");
  }
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "media.ai_video_started", targetId: job._id.toHexString() });
  return { jobId: job._id.toHexString() };
}

async function failJob(db: Db, job: GenerationJobDoc, message: string): Promise<void> {
  const result = await collections(db).generationJobs.updateOne({ _id: job._id, status: "processing" }, { $set: { status: "failed", error: message, updatedAt: new Date() } });
  // La vidéo n'a rien produit : les crédits sont rendus (une seule fois).
  if (result.modifiedCount === 1) {
    const workspace = await collections(db).workspaces.findOne({ _id: job.workspaceId }, { projection: { _id: 1, billingWorkspaceId: 1 } });
    if (workspace) await refundCredits(db, workspace, { chargeKey: chargeKey(job), generationJobId: job._id });
  }
}

function view(job: GenerationJobDoc): VideoJobView {
  const result = (job.result ?? {}) as VideoJobResult;
  if (job.status === "succeeded" && result.mediaId) return { status: "done", mediaId: result.mediaId };
  if (job.status === "failed") return { status: "failed", error: job.error ?? "La création de la vidéo a échoué." };
  return { status: "processing", progress: result.progress ?? null };
}

/**
 * Fait avancer une création : demande l'état au fournisseur ; une fois prête, récupère la vidéo, la vérifie
 * (format accepté par les réseaux) et l'ajoute à la médiathèque. Sûr en cas d'appels simultanés.
 */
export async function advanceVideoJob(db: Db, job: GenerationJobDoc, provider: VideoGenerationProvider, storage: MediaStorage, now = new Date()): Promise<VideoJobView> {
  if (job.status !== "processing") return view(job);
  const { generationJobs } = collections(db);
  const result = (job.result ?? {}) as VideoJobResult;
  if (!result.providerJobId) {
    // Démarrage interrompu : rien n'a été lancé chez le fournisseur.
    if (now.getTime() - job.createdAt.getTime() > FINALIZE_LOCK_MS) await failJob(db, job, "La création de la vidéo n'a pas pu démarrer. Réessayez.");
    return view((await generationJobs.findOne({ _id: job._id })) ?? job);
  }
  if (now.getTime() - job.createdAt.getTime() > MAX_JOB_MS) {
    await failJob(db, job, "La création de la vidéo a pris trop de temps. Vos crédits ont été rendus.");
    return view((await generationJobs.findOne({ _id: job._id })) ?? job);
  }

  let state;
  try {
    state = await provider.getVideo(result.providerJobId);
  } catch (error) {
    if (error instanceof TextGenerationError && !error.retryable) {
      await failJob(db, job, error.message);
      return view((await generationJobs.findOne({ _id: job._id })) ?? job);
    }
    return { status: "processing", progress: result.progress ?? null };
  }
  if (state.status === "failed") {
    await failJob(db, job, state.error ? `Le service de vidéos n'a pas pu créer la vidéo (${state.error.slice(0, 200)}). Vos crédits ont été rendus.` : "Le service de vidéos n'a pas pu créer la vidéo. Vos crédits ont été rendus.");
    return view((await generationJobs.findOne({ _id: job._id })) ?? job);
  }
  if (state.status !== "completed") {
    await generationJobs.updateOne({ _id: job._id, status: "processing" }, { $set: { "result.progress": state.progress, updatedAt: now } });
    return { status: "processing", progress: state.progress };
  }

  // Une seule finalisation à la fois (deux onglets, ou le planificateur en même temps).
  const claimed = await generationJobs.findOneAndUpdate(
    {
      _id: job._id,
      status: "processing",
      $or: [{ "result.finalizingAt": { $exists: false } }, { "result.finalizingAt": null }, { "result.finalizingAt": { $lt: new Date(now.getTime() - FINALIZE_LOCK_MS) } }],
    },
    { $set: { "result.finalizingAt": now, "result.progress": 100, updatedAt: now } },
  );
  if (!claimed) return { status: "processing", progress: 100 };

  try {
    const video = await provider.downloadVideo(result.providerJobId, "video");
    const info = await inspectVideo(video);
    const problems = videoProblems(info);
    if (!info || problems.length > 0) {
      await failJob(db, job, `La vidéo reçue n'est pas publiable (${problems.join(" ")}). Vos crédits ont été rendus.`);
      return view((await generationJobs.findOne({ _id: job._id })) ?? job);
    }
    let poster: Buffer | null = null;
    try {
      poster = await sharp(await provider.downloadVideo(result.providerJobId, "thumbnail")).jpeg({ quality: 85 }).toBuffer();
    } catch {
      // L'aperçu est un confort : la vidéo reste utilisable sans.
    }

    const prefix = `${workspaceStoragePrefix(job.workspaceId.toHexString())}ia/`;
    const storageKey = `${prefix}${randomUUID()}.mp4`;
    const posterKey = poster ? `${prefix}${randomUUID()}.jpg` : undefined;
    await storage.put(storageKey, video, "video/mp4");
    if (poster && posterKey) await storage.put(posterKey, poster, "image/jpeg");

    const request = job.request as { description?: string };
    const media: MediaAssetDoc = {
      _id: new ObjectId(),
      workspaceId: job.workspaceId,
      brandId: job.brandId,
      createdByUserId: job.userId,
      kind: "video",
      source: "ai",
      name: (request.description ?? "Vidéo IA").slice(0, 120),
      mimeType: "video/mp4",
      size: video.length,
      width: info.width,
      height: info.height,
      durationSeconds: Math.round(info.durationSeconds * 10) / 10,
      storageKey,
      ...(posterKey ? { posterStorageKey: posterKey } : {}),
      status: "ready",
      createdAt: now,
      updatedAt: now,
    };
    await collections(db).mediaAssets.insertOne(media);
    await generationJobs.updateOne({ _id: job._id }, { $set: { status: "succeeded", "result.mediaId": media._id.toHexString(), "result.finalizingAt": null, updatedAt: new Date() } });
    await recordAudit(db, { workspaceId: job.workspaceId, actorUserId: job.userId, action: "media.ai_generated", targetId: media._id.toHexString() });
    return { status: "done", mediaId: media._id.toHexString() };
  } catch (error) {
    // Panne passagère pendant la récupération : on libère le verrou, nouvel essai au prochain suivi.
    console.error("Récupération de la vidéo impossible", error instanceof Error ? error.message : error);
    await generationJobs.updateOne({ _id: job._id }, { $set: { "result.finalizingAt": null, updatedAt: new Date() } });
    return { status: "processing", progress: 100 };
  }
}

/** Suivi d'une création depuis l'interface (uniquement les créations de l'espace). */
export async function pollVideoGeneration(db: Db, access: WorkspaceAccess, jobId: string, provider: VideoGenerationProvider, storage: MediaStorage): Promise<VideoJobView> {
  assertPermission(access, "content:read");
  const job = ObjectId.isValid(jobId) ? await collections(db).generationJobs.findOne({ _id: new ObjectId(jobId), workspaceId: access.workspace._id, kind: "video" }) : null;
  if (!job) throw new UserFacingError("Création introuvable.", "not_found");
  return advanceVideoJob(db, job, provider, storage);
}

/** Créations en cours de l'espace (pour reprendre le suivi après un rechargement de page). */
export async function listPendingVideoJobs(db: Db, access: WorkspaceAccess): Promise<{ jobId: string; description: string }[]> {
  assertPermission(access, "content:read");
  const jobs = await collections(db).generationJobs.find({ workspaceId: access.workspace._id, kind: "video", status: "processing" }).sort({ createdAt: -1 }).limit(5).toArray();
  return jobs.map((job) => ({ jobId: job._id.toHexString(), description: String((job.request as { description?: string }).description ?? "") }));
}

/** Planificateur : fait avancer les créations en cours, même si plus personne ne regarde la page. */
export async function advancePendingVideos(db: Db, provider: VideoGenerationProvider, storage: MediaStorage, deadline: number, now = new Date()): Promise<number> {
  if (!provider.isConfigured() || !storage.isConfigured()) return 0;
  const jobs = await collections(db)
    .generationJobs.find({ kind: "video", status: "processing", createdAt: { $lt: new Date(now.getTime() - 60_000) } })
    .sort({ updatedAt: 1 })
    .limit(5)
    .toArray();
  let finished = 0;
  for (const job of jobs) {
    if (Date.now() > deadline) break;
    const result = await advanceVideoJob(db, job, provider, storage, now);
    if (result.status !== "processing") finished += 1;
  }
  return finished;
}
