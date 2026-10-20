import { ObjectId, type Db } from "mongodb";
import { z } from "zod";
import { generationOutputSchema, generationRequestSchema, type GenerationOutput } from "@smia/shared";
import { buildUserPrompt, SYSTEM_PROMPT } from "@/server/ai/prompt";
import { collections, type GenerationJobDoc } from "@/server/db/collections";
import { bestPerformingPosts } from "@/server/services/analytics";
import { recordAudit } from "@/server/services/audit";
import { getBrand } from "@/server/services/brands";
import { UserFacingError } from "@/server/services/errors";
import { toView, type GenerationView } from "@/server/services/generation";
import { assertPermission } from "@/server/services/permissions";
import type { WorkspaceAccess } from "@/server/services/workspaces";

/** Fournisseur « IA locale » : le modèle tourne sur l'ordinateur de l'utilisateur (application de bureau). */
export const LOCAL_PROVIDER_ID = "local";
/** Temps laissé à l'ordinateur pour produire la réponse. */
const LOCAL_JOB_TTL_MS = 15 * 60_000;

export interface LocalGenerationRequest {
  jobId: string;
  system: string;
  user: string;
  /** Schéma JSON imposé au modèle local (sortie structurée). */
  schema: unknown;
}

/**
 * Prépare une génération locale : mêmes consignes que le cloud, construites ici à partir de la marque vérifiée.
 * Aucun crédit (rien n'est envoyé à un service payant) et aucun accord fournisseur (les données restent sur l'ordinateur).
 */
export async function prepareLocalGeneration(db: Db, access: WorkspaceAccess, userId: string, input: unknown, now = new Date()): Promise<LocalGenerationRequest> {
  assertPermission(access, "content:write");
  const parsed = generationRequestSchema.safeParse(input);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Demande invalide.", "invalid_input");
  const request = parsed.data;
  const brand = await getBrand(db, access, request.brandId);
  const { requestId, brandId: _brandId, ...details } = request;

  const existing = await collections(db).generationJobs.findOne({ workspaceId: access.workspace._id, requestId });
  if (existing) throw new UserFacingError("Cette demande a déjà été envoyée. Relancez la génération.", "conflict");

  const pastPerformance = await bestPerformingPosts(db, access.workspace._id, brand._id);
  const user = buildUserPrompt({
    brand,
    networks: request.networks,
    kind: request.kind,
    brief: request.brief,
    tone: request.tone ?? brand.tone,
    variantsPerNetwork: request.variantsPerNetwork,
    pastPerformance,
  });
  const job: GenerationJobDoc = {
    _id: new ObjectId(),
    workspaceId: access.workspace._id,
    brandId: brand._id,
    userId,
    requestId,
    kind: "text",
    provider: LOCAL_PROVIDER_ID,
    model: null,
    status: "processing",
    request: details,
    result: null,
    error: null,
    usage: null,
    createdAt: now,
    updatedAt: now,
  };
  await collections(db).generationJobs.insertOne(job);
  return { jobId: job._id.toHexString(), system: SYSTEM_PROMPT, user, schema: z.toJSONSchema(generationOutputSchema) };
}

/**
 * Reçoit la réponse du modèle local et la valide exactement comme une réponse du cloud (schéma, réseaux demandés).
 * La demande doit venir de la même personne, du même espace, et être récente.
 */
export async function completeLocalGeneration(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  params: { jobId: string; output: unknown; model: unknown },
  now = new Date(),
): Promise<GenerationView> {
  assertPermission(access, "content:write");
  const { generationJobs } = collections(db);
  const job = ObjectId.isValid(params.jobId)
    ? await generationJobs.findOne({
        _id: new ObjectId(params.jobId),
        workspaceId: access.workspace._id,
        userId,
        provider: LOCAL_PROVIDER_ID,
        status: "processing",
        createdAt: { $gt: new Date(now.getTime() - LOCAL_JOB_TTL_MS) },
      })
    : null;
  if (!job) throw new UserFacingError("Cette génération a expiré. Relancez-la.", "not_found");

  const fail = async (message: string) => {
    await generationJobs.updateOne({ _id: job._id }, { $set: { status: "failed", error: message, updatedAt: now } });
    return new UserFacingError(message, "unavailable");
  };

  let raw: unknown = params.output;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw await fail("Le modèle local a renvoyé une réponse illisible. Réessayez, ou choisissez un modèle plus grand.");
    }
  }
  const parsed = generationOutputSchema.safeParse(raw);
  if (!parsed.success) throw await fail("La réponse du modèle local ne respecte pas le format attendu. Réessayez, ou choisissez un modèle plus grand.");
  const networks = (job.request as { networks?: string[] }).networks ?? [];
  const output: GenerationOutput = {
    posts: parsed.data.posts.filter((post) => networks.includes(post.network)),
    missingInformation: parsed.data.missingInformation,
  };
  if (output.posts.length === 0) throw await fail("Le modèle local n'a produit aucune publication exploitable. Réessayez.");

  const model = typeof params.model === "string" && /^[\w.:/-]{1,100}$/.test(params.model) ? params.model : "inconnu";
  await generationJobs.updateOne(
    { _id: job._id, status: "processing" },
    { $set: { status: "succeeded", result: output, model: `local:${model}`, usage: { inputTokens: 0, outputTokens: 0 }, updatedAt: now } },
  );
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "ai.local_generation", targetId: job._id.toHexString() });
  return toView(job._id, job.brandId, output);
}
