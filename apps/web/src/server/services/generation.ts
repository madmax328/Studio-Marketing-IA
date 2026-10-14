import { ObjectId, type Db } from "mongodb";
import {
  checkTextLength,
  composePostText,
  generationRequestSchema,
  type GeneratedPost,
  type GenerationOutput,
} from "@smia/shared";
import { TextGenerationError, type ProviderResult, type TextGenerationProvider } from "@/server/ai/types";
import { collections, type GenerationJobDoc } from "@/server/db/collections";
import { recordAudit } from "@/server/services/audit";
import { getBrand } from "@/server/services/brands";
import { UserFacingError } from "@/server/services/errors";
import { assertPermission } from "@/server/services/permissions";
import { DEFAULT_WORKSPACE_LIMITS, type WorkspaceAccess } from "@/server/services/workspaces";

export interface GeneratedPostView extends GeneratedPost {
  /** Texte final (corps + hashtags) proposé dans l'éditeur. */
  composedText: string;
  /** Problèmes détectés (ex. texte trop long) : jamais corrigés en silence. */
  warnings: string[];
}

export interface GenerationView {
  jobId: string;
  brandId: string;
  posts: GeneratedPostView[];
  missingInformation: string[];
}

export function monthlyTextGenerationLimit(access: WorkspaceAccess): number {
  return access.workspace.limits.monthlyTextGenerations ?? DEFAULT_WORKSPACE_LIMITS.monthlyTextGenerations;
}

/** Générations IA du mois civil en cours (UTC), tous types confondus : réussies ou en cours. Les échecs ne comptent pas. */
export async function countMonthlyTextGenerations(db: Db, access: WorkspaceAccess, now = new Date()): Promise<number> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return collections(db).generationJobs.countDocuments({
    workspaceId: access.workspace._id,
    status: { $in: ["processing", "succeeded"] },
    createdAt: { $gte: monthStart },
  });
}

/** Enregistre l'accord de l'espace pour envoyer les données de marque au fournisseur d'IA. */
export async function acceptAiConsent(db: Db, access: WorkspaceAccess, userId: string, provider: TextGenerationProvider) {
  assertPermission(access, "workspace:manage");
  await collections(db).workspaces.updateOne(
    { _id: access.workspace._id },
    { $set: { aiConsent: { provider: provider.id, acceptedAt: new Date(), acceptedByUserId: userId }, updatedAt: new Date() } },
  );
  await recordAudit(db, {
    workspaceId: access.workspace._id,
    actorUserId: userId,
    action: "ai.consent_accepted",
    metadata: { provider: provider.id },
  });
}

export function hasAiConsent(access: WorkspaceAccess, provider: TextGenerationProvider): boolean {
  return access.workspace.aiConsent?.provider === provider.id;
}

/**
 * Exécute un appel au fournisseur d'IA avec les garde-fous communs :
 * fournisseur configuré, accord RGPD, quota mensuel, et une seule exécution par requestId
 * (une demande déjà réussie renvoie son résultat enregistré sans nouvel appel ni nouveau décompte).
 */
export async function runAiJob<T>(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  provider: TextGenerationProvider,
  params: {
    requestId: string;
    kind: GenerationJobDoc["kind"];
    brandId: ObjectId;
    campaignId?: ObjectId;
    request: Record<string, unknown>;
  },
  run: () => Promise<ProviderResult<T>>,
): Promise<{ jobId: ObjectId; output: T }> {
  assertPermission(access, "content:write");
  if (!provider.isConfigured()) {
    throw new UserFacingError("La génération de texte n'est pas encore disponible.", "unavailable");
  }
  if (!hasAiConsent(access, provider)) {
    throw new UserFacingError("Vous devez d'abord accepter l'envoi des informations de votre marque à l'IA.", "consent_required");
  }
  const { generationJobs } = collections(db);

  const existing = await generationJobs.findOne({ workspaceId: access.workspace._id, requestId: params.requestId });
  if (existing) return outcomeOfExistingJob<T>(existing);

  const limit = monthlyTextGenerationLimit(access);
  if ((await countMonthlyTextGenerations(db, access)) >= limit) {
    throw new UserFacingError(
      `Vous avez utilisé vos ${limit} générations de ce mois. Passez à une offre supérieure pour en obtenir davantage.`,
      "limit_reached",
    );
  }

  const now = new Date();
  const job: GenerationJobDoc = {
    _id: new ObjectId(),
    workspaceId: access.workspace._id,
    brandId: params.brandId,
    ...(params.campaignId ? { campaignId: params.campaignId } : {}),
    userId,
    requestId: params.requestId,
    kind: params.kind,
    provider: provider.id,
    model: null,
    status: "processing",
    request: params.request,
    result: null,
    error: null,
    usage: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await generationJobs.insertOne(job);
  } catch (error) {
    // Deux envois simultanés de la même demande : on renvoie celle déjà enregistrée.
    const concurrent = await generationJobs.findOne({ workspaceId: access.workspace._id, requestId: params.requestId });
    if (concurrent) return outcomeOfExistingJob<T>(concurrent);
    throw error;
  }

  try {
    const result = await run();
    await generationJobs.updateOne(
      { _id: job._id },
      { $set: { status: "succeeded", result: result.output, model: result.model, usage: result.usage, updatedAt: new Date() } },
    );
    return { jobId: job._id, output: result.output };
  } catch (error) {
    const message =
      error instanceof TextGenerationError ? error.message : "La génération a échoué. Réessayez dans un instant.";
    await generationJobs.updateOne({ _id: job._id }, { $set: { status: "failed", error: message, updatedAt: new Date() } });
    if (!(error instanceof TextGenerationError)) console.error("Échec de génération", error);
    throw new UserFacingError(message, "unavailable");
  }
}

function outcomeOfExistingJob<T>(job: GenerationJobDoc): { jobId: ObjectId; output: T } {
  if (job.status === "succeeded" && job.result) return { jobId: job._id, output: job.result as T };
  if (job.status === "processing") {
    throw new UserFacingError("Cette génération est déjà en cours. Patientez quelques secondes.", "conflict");
  }
  throw new UserFacingError(job.error ?? "Cette génération a échoué. Relancez-la.", "unavailable");
}

/** Génère des publications pour une marque (studio de contenu). */
export async function generateTextPosts(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  input: unknown,
  provider: TextGenerationProvider,
): Promise<GenerationView> {
  assertPermission(access, "content:write");
  const parsed = generationRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new UserFacingError(parsed.error.issues[0]?.message ?? "Demande invalide.", "invalid_input");
  }
  const request = parsed.data;
  const brand = await getBrand(db, access, request.brandId);
  const { requestId, brandId, ...details } = request;

  const { jobId, output } = await runAiJob<GenerationOutput>(
    db,
    access,
    userId,
    provider,
    { requestId, kind: "text", brandId: brand._id, request: details },
    async () => {
      const result = await provider.generatePosts({
        brand,
        networks: request.networks,
        kind: request.kind,
        brief: request.brief,
        tone: request.tone ?? brand.tone,
        variantsPerNetwork: request.variantsPerNetwork,
      });
      // On ne garde que les réseaux demandés.
      const posts = result.output.posts.filter((post) => request.networks.includes(post.network));
      if (posts.length === 0) {
        throw new TextGenerationError("L'IA n'a produit aucune publication exploitable. Réessayez.", true);
      }
      return { ...result, output: { posts, missingInformation: result.output.missingInformation } };
    },
  );
  return toView(jobId, brand._id, output);
}

export function toView(jobId: ObjectId, brandId: ObjectId, output: GenerationOutput): GenerationView {
  return {
    jobId: jobId.toHexString(),
    brandId: brandId.toHexString(),
    missingInformation: output.missingInformation,
    posts: output.posts.map((post) => {
      const composedText = composePostText(post);
      const lengthProblem = checkTextLength(post.network, composedText);
      return { ...post, composedText, warnings: lengthProblem ? [lengthProblem] : [] };
    }),
  };
}
