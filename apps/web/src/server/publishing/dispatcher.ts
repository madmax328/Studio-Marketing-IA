import { randomUUID } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { SOCIAL_NETWORKS } from "@smia/shared";
import { collections, type PostDoc, type SocialAccountDoc } from "@/server/db/collections";
import { decryptSecret } from "@/server/security/crypto";
import { recordAudit } from "@/server/services/audit";
import { schedulingProblems } from "@/server/services/posts";
import { PublishError, type PublishMedia, type SocialPublisher } from "./types";

/** Nombre maximal de tentatives pour une erreur temporaire. */
export const MAX_ATTEMPTS = 3;
/** Délai avant la tentative suivante (minutes), selon le numéro de la tentative échouée. */
export const RETRY_DELAYS_MINUTES = [5, 15, 60];
/** Au-delà, un traitement est considéré comme interrompu (plantage, délai dépassé). */
export const STALE_LOCK_MINUTES = 10;

export interface Notifier {
  publishFailed(post: PostDoc, reason: string): Promise<void>;
  accountExpired(account: SocialAccountDoc): Promise<void>;
}

export interface DispatcherDeps {
  db: Db;
  publishers: Partial<Record<SocialAccountDoc["provider"], SocialPublisher>>;
  notifier: Notifier;
  /** Clé de chiffrement des jetons ; absente si aucun connecteur réel n'est configuré. */
  encryptionKey: string | undefined;
  mediaFor(post: PostDoc): Promise<PublishMedia[]>;
  now?: () => Date;
}

export interface CycleSummary {
  published: number;
  retried: number;
  failed: number;
  recovered: number;
}

/**
 * Un passage du répartiteur : récupère les traitements interrompus, puis envoie les publications dues
 * une par une, jusqu'à `maxPosts` ou l'échéance. Chaque publication est réservée atomiquement :
 * deux passages simultanés ne peuvent pas envoyer la même publication.
 */
export async function runPublishingCycle(
  deps: DispatcherDeps,
  options: { maxPosts?: number; deadline?: number } = {},
): Promise<CycleSummary> {
  const now = deps.now ?? (() => new Date());
  const summary: CycleSummary = { published: 0, retried: 0, failed: 0, recovered: 0 };
  summary.recovered = await recoverStaleLocks(deps, now());

  const maxPosts = options.maxPosts ?? 25;
  for (let i = 0; i < maxPosts; i += 1) {
    if (options.deadline && Date.now() > options.deadline) break;
    const post = await claimNextDuePost(deps.db, now());
    if (!post) break;
    const outcome = await processPost(deps, post, now);
    summary[outcome] += 1;
  }
  return summary;
}

async function claimNextDuePost(db: Db, now: Date): Promise<PostDoc | null> {
  const lockId = randomUUID();
  return collections(db).posts.findOneAndUpdate(
    {
      status: "scheduled",
      scheduledAt: { $lte: now },
      $or: [{ "publishing.nextAttemptAt": { $exists: false } }, { "publishing.nextAttemptAt": null }, { "publishing.nextAttemptAt": { $lte: now } }],
    },
    {
      $set: { status: "processing", "publishing.lockedAt": now, "publishing.lockId": lockId, updatedAt: now },
      $inc: { "publishing.attempts": 1 },
    },
    { sort: { scheduledAt: 1 }, returnDocument: "after" },
  );
}

async function recoverStaleLocks(deps: DispatcherDeps, now: Date): Promise<number> {
  const limit = new Date(now.getTime() - STALE_LOCK_MINUTES * 60_000);
  const stale = await collections(deps.db)
    .posts.find({ status: "processing", "publishing.lockedAt": { $lt: limit } })
    .limit(50)
    .toArray();
  const reason =
    "L'envoi a été interrompu et son résultat est inconnu. Vérifiez sur le réseau si la publication est parue avant de la reprogrammer.";
  let count = 0;
  for (const post of stale) {
    const result = await collections(deps.db).posts.updateOne(
      { _id: post._id, status: "processing", "publishing.lockId": post.publishing?.lockId ?? null },
      { $set: { status: "failed", "publishing.lockedAt": null, "publishing.lockId": null, "publishing.lastError": reason, updatedAt: now } },
    );
    if (result.modifiedCount === 1) {
      count += 1;
      await deps.notifier.publishFailed(post, reason);
    }
  }
  return count;
}

async function processPost(
  deps: DispatcherDeps,
  post: PostDoc,
  now: () => Date,
): Promise<"published" | "retried" | "failed"> {
  const c = collections(deps.db);
  const lockId = post.publishing?.lockId ?? null;
  const attempts = post.publishing?.attempts ?? 1;
  const network = SOCIAL_NETWORKS[post.network];

  const finish = async (set: Record<string, unknown>) =>
    c.posts.updateOne(
      { _id: post._id, status: "processing", "publishing.lockId": lockId },
      { $set: { ...set, "publishing.lockedAt": null, "publishing.lockId": null, "publishing.lastAttemptAt": now(), updatedAt: now() } },
    );

  const fail = async (reason: string): Promise<"failed"> => {
    await finish({ status: "failed", "publishing.lastError": reason, "publishing.nextAttemptAt": null, "publishing.resume": null });
    await recordAudit(deps.db, { workspaceId: post.workspaceId, actorUserId: null, action: "post.publish_failed", targetId: post._id.toHexString() });
    await deps.notifier.publishFailed(post, reason);
    return "failed";
  };

  // Le contenu a pu changer depuis la programmation.
  const problems = schedulingProblems(post);
  if (problems.length > 0) return fail(problems.join(" "));

  let account: SocialAccountDoc | null;
  if (post.socialAccountId) {
    account = await c.socialAccounts.findOne({ _id: post.socialAccountId, workspaceId: post.workspaceId, network: post.network });
    if (!account) {
      return fail(`Le compte ${network.label} choisi pour cette publication n'est plus connecté. Choisissez un compte, puis reprogrammez-la.`);
    }
    if (account.status !== "connected") {
      return fail(`Le compte ${account.displayName} doit être reconnecté dans « Réseaux sociaux ». Reprogrammez ensuite la publication.`);
    }
  } else {
    // Sans choix explicite, on n'envoie que s'il n'y a aucune ambiguïté sur le compte.
    const candidates = await c.socialAccounts
      .find({ workspaceId: post.workspaceId, network: post.network, status: "connected" })
      .limit(2)
      .toArray();
    if (candidates.length > 1) {
      return fail(`Plusieurs comptes ${network.label} sont connectés : choisissez celui à utiliser dans la publication, puis reprogrammez-la.`);
    }
    account = candidates[0] ?? null;
  }
  if (!account) {
    return fail(`Aucun compte ${network.label} n'est connecté. Connectez-le dans « Réseaux sociaux », puis reprogrammez la publication.`);
  }
  const publisher = deps.publishers[account.provider];
  if (!publisher) return fail(`La publication sur ${network.label} n'est pas encore disponible.`);

  let accessToken: string | null = null;
  if (account.provider !== "simulation") {
    if (!account.accessToken || !deps.encryptionKey) return fail("Le compte connecté n'a pas de jeton d'accès utilisable. Reconnectez-le.");
    if (account.tokenExpiresAt && account.tokenExpiresAt <= now()) {
      await markAccountExpired(deps, account);
      return fail(`L'autorisation du compte ${account.displayName} a expiré. Reconnectez-le.`);
    }
    accessToken = decryptSecret(account.accessToken, deps.encryptionKey);
  }

  let media: PublishMedia[];
  try {
    media = await deps.mediaFor(post);
  } catch {
    return retryOrFail(new PublishError("Les images de la publication sont momentanément illisibles.", "retryable"));
  }

  try {
    const result = await publisher.publish({ post, account, accessToken, media, resume: post.publishing?.resume ?? null });
    await finish({
      status: "published",
      publishedAt: now(),
      "publishing.socialAccountId": account._id,
      "publishing.externalId": result.externalId,
      "publishing.externalUrl": result.externalUrl,
      "publishing.simulated": result.simulated,
      "publishing.lastError": null,
      "publishing.nextAttemptAt": null,
      "publishing.resume": null,
    });
    await recordAudit(deps.db, {
      workspaceId: post.workspaceId,
      actorUserId: null,
      action: result.simulated ? "post.publish_simulated" : "post.published",
      targetId: post._id.toHexString(),
    });
    return "published";
  } catch (error) {
    // Une erreur inattendue pendant l'envoi : on ne sait pas si la publication est partie.
    const publishError =
      error instanceof PublishError
        ? error
        : new PublishError("Erreur inattendue pendant l'envoi : vérifiez sur le réseau si la publication est parue.", "uncertain");
    if (!(error instanceof PublishError)) console.error("Erreur inattendue du connecteur", account.provider, error);
    if (publishError.kind === "auth") {
      await markAccountExpired(deps, account);
      return fail(`${publishError.message} Reconnectez le compte ${account.displayName}.`);
    }
    return retryOrFail(publishError);
  }

  async function retryOrFail(error: PublishError): Promise<"retried" | "failed"> {
    if (error.kind === "retryable" && attempts < MAX_ATTEMPTS) {
      const delay = RETRY_DELAYS_MINUTES[attempts - 1] ?? 60;
      await finish({
        status: "scheduled",
        "publishing.lastError": error.message,
        "publishing.nextAttemptAt": new Date(now().getTime() + delay * 60_000),
        "publishing.resume": error.resume ?? null,
      });
      return "retried";
    }
    return fail(error.kind === "retryable" ? `${error.message} (${attempts} tentatives)` : error.message);
  }
}

async function markAccountExpired(deps: DispatcherDeps, account: SocialAccountDoc) {
  const result = await collections(deps.db).socialAccounts.updateOne(
    { _id: account._id, status: "connected" },
    { $set: { status: "expired", lastError: "Autorisation expirée ou révoquée.", updatedAt: new Date() } },
  );
  if (result.modifiedCount === 1) await deps.notifier.accountExpired(account);
}

/** Médias d'une publication, limités à son espace. */
export async function loadPostMedia(
  db: Db,
  post: PostDoc,
  access: { signedUrl(mediaId: string): string; read(storageKey: string): Promise<Buffer | null> },
): Promise<PublishMedia[]> {
  const ids = post.mediaIds ?? [];
  if (ids.length === 0) return [];
  const docs = await collections(db).mediaAssets.find({ _id: { $in: ids }, workspaceId: post.workspaceId }).toArray();
  return ids.flatMap((id: ObjectId) => {
    const doc = docs.find((d) => d._id.equals(id));
    if (!doc) return [];
    return [
      {
        mediaId: doc._id.toHexString(),
        mimeType: doc.mimeType,
        width: doc.width,
        height: doc.height,
        publicUrl: access.signedUrl(doc._id.toHexString()),
        read: async () => {
          const bytes = await access.read(doc.storageKey);
          if (!bytes) throw new PublishError("Une image jointe est introuvable dans le stockage.", "permanent");
          return bytes;
        },
      },
    ];
  });
}
