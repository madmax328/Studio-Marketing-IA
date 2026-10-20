import { randomUUID } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { ALL_FORMATS, BufferSource, Input } from "mediabunny";
import { BRAND_TONE_LABELS, voiceoverRequestSchema } from "@smia/shared";
import { TextGenerationError, type SpeechGenerationProvider } from "@/server/ai/types";
import { collections } from "@/server/db/collections";
import { workspaceStoragePrefix, type MediaStorage } from "@/server/media/storage";
import { getBrand } from "@/server/services/brands";
import { UserFacingError } from "@/server/services/errors";
import { runAiJob } from "@/server/services/generation";
import { assertPermission } from "@/server/services/permissions";
import type { WorkspaceAccess } from "@/server/services/workspaces";

/** Les fichiers de voix ne servent qu'au montage : ils sont effacés passé ce délai. */
export const VOICEOVER_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface VoiceoverClip {
  slide: number;
  storageKey: string;
  seconds: number;
}

export interface VoiceoverResult {
  jobId: string;
  clips: { slide: number; seconds: number }[];
}

/** Durée d'un fichier audio (null s'il n'est pas lisible). */
export async function audioSeconds(bytes: Buffer): Promise<number | null> {
  try {
    const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
    if (!(await input.getPrimaryAudioTrack())) return null;
    const seconds = await input.computeDuration();
    return seconds > 0 ? seconds : null;
  } catch {
    return null;
  }
}

/**
 * Crée la voix off d'une vidéo du studio : une piste par diapositive, rangée temporairement dans le stockage
 * de l'espace. Seul le texte à lire est envoyé au fournisseur, avec le ton de la marque.
 */
export async function generateVoiceover(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  input: unknown,
  provider: SpeechGenerationProvider,
  storage: MediaStorage,
): Promise<VoiceoverResult> {
  assertPermission(access, "content:write");
  if (!storage.isConfigured()) throw new UserFacingError("Le stockage des médias n'est pas encore activé.", "unavailable");
  const parsed = voiceoverRequestSchema.safeParse(input);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Demande invalide.", "invalid_input");
  const request = parsed.data;
  if (new Set(request.lines.map((line) => line.slide)).size !== request.lines.length) {
    throw new UserFacingError("Demande invalide.", "invalid_input");
  }
  const brand = await getBrand(db, access, request.brandId);
  const instructions =
    `Voix off française d'une courte vidéo pour les réseaux sociaux. Ton ${BRAND_TONE_LABELS[brand.tone].toLowerCase()}, naturel et articulé. ` +
    "Lisez exactement le texte, sans rien ajouter.";

  const { jobId, output } = await runAiJob<{ clips: VoiceoverClip[] }>(
    db,
    access,
    userId,
    provider,
    {
      requestId: request.requestId,
      kind: "voiceover",
      operation: "voiceover",
      brandId: brand._id,
      request: { voice: request.voice, slides: request.lines.map((line) => line.slide) },
    },
    async () => {
      const prefix = `${workspaceStoragePrefix(access.workspace._id.toHexString())}voix/`;
      const clips: VoiceoverClip[] = [];
      try {
        const results = await Promise.all(
          request.lines.map((line) => provider.generateSpeech({ text: line.text, voice: request.voice, instructions })),
        );
        let characters = 0;
        for (const [index, result] of results.entries()) {
          const line = request.lines[index];
          if (!line) continue;
          const seconds = await audioSeconds(result.output);
          if (!seconds) throw new TextGenerationError("Le son reçu est illisible. Réessayez.", true);
          const storageKey = `${prefix}${randomUUID()}.mp3`;
          await storage.put(storageKey, result.output, "audio/mpeg");
          clips.push({ slide: line.slide, storageKey, seconds });
          characters += result.usage.inputTokens;
        }
        return { output: { clips }, model: results[0]?.model ?? "", usage: { inputTokens: characters, outputTokens: 0 } };
      } catch (error) {
        // Échec partiel : rien ne reste dans le stockage (les crédits sont rendus par runAiJob).
        await storage.remove(clips.map((clip) => clip.storageKey)).catch(() => undefined);
        throw error;
      }
    },
  );
  return { jobId: jobId.toHexString(), clips: output.clips.map(({ slide, seconds }) => ({ slide, seconds })) };
}

/** Fichier d'une voix off de l'espace (vérifié par l'espace : un identifiant venu du navigateur ne suffit pas). */
export async function getVoiceoverClip(db: Db, access: WorkspaceAccess, jobId: string, slide: number): Promise<VoiceoverClip> {
  if (!ObjectId.isValid(jobId) || !Number.isInteger(slide)) throw new UserFacingError("Introuvable.", "not_found");
  const job = await collections(db).generationJobs.findOne({
    _id: new ObjectId(jobId),
    workspaceId: access.workspace._id,
    kind: "voiceover",
    status: "succeeded",
  });
  const clips = (job?.result as { clips?: VoiceoverClip[] } | null)?.clips ?? [];
  const clip = clips.find((item) => item.slide === slide);
  if (!clip) throw new UserFacingError("Introuvable.", "not_found");
  return clip;
}

/** Efface les fichiers de voix off qui ont servi (planificateur). Renvoie le nombre de demandes nettoyées. */
export async function purgeOldVoiceovers(db: Db, storage: MediaStorage, now = new Date(), limit = 50): Promise<number> {
  const { generationJobs } = collections(db);
  const jobs = await generationJobs
    .find({ kind: "voiceover", status: "succeeded", createdAt: { $lt: new Date(now.getTime() - VOICEOVER_RETENTION_MS) }, "result.clips.0": { $exists: true } })
    .limit(limit)
    .toArray();
  for (const job of jobs) {
    const clips = (job.result as { clips?: VoiceoverClip[] } | null)?.clips ?? [];
    await storage.remove(clips.map((clip) => clip.storageKey));
    await generationJobs.updateOne({ _id: job._id }, { $set: { "result.clips": [], updatedAt: now } });
  }
  return jobs.length;
}
