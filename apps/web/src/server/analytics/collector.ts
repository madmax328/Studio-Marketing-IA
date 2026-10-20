import { ObjectId, type Db } from "mongodb";
import { SOCIAL_NETWORKS, type PostMetrics } from "@smia/shared";
import { collections, type PostDoc, type PostMetricsState } from "@/server/db/collections";
import { decryptSecret } from "@/server/security/crypto";
import { MetricsError, type MetricsFetcher } from "./types";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

/** Premier relevé une heure après la publication (les réseaux ont besoin d'un peu de temps). */
export const FIRST_COLLECT_DELAY_MS = HOUR;
/** Au-delà de 30 jours, les chiffres bougent peu : le suivi s'arrête. */
export const TRACKING_DAYS = 30;
/** Réservation d'une publication pendant son relevé (évite deux relevés simultanés). */
const LEASE_MS = 10 * 60_000;

/** Prochain relevé : souvent au début, puis de plus en plus espacé ; null quand le suivi est terminé. */
export function nextCollectionAt(publishedAt: Date, now: Date): Date | null {
  const age = now.getTime() - publishedAt.getTime();
  if (age >= TRACKING_DAYS * DAY) return null;
  const interval = age < 2 * DAY ? 3 * HOUR : age < 7 * DAY ? 12 * HOUR : 2 * DAY;
  const next = new Date(now.getTime() + interval);
  const end = new Date(publishedAt.getTime() + TRACKING_DAYS * DAY);
  return next > end ? end : next;
}

export interface CollectorDeps {
  db: Db;
  fetchers: Partial<Record<string, MetricsFetcher>>;
  encryptionKey: string | undefined;
  now?: () => Date;
}

export interface CollectSummary {
  collected: number;
  unsupported: number;
  failed: number;
}

/** Réserve la prochaine publication réelle dont les chiffres sont à relever. */
async function claimNext(db: Db, now: Date): Promise<PostDoc | null> {
  return collections(db).posts.findOneAndUpdate(
    {
      status: "published",
      "publishing.simulated": { $ne: true },
      "publishing.externalId": { $type: "string" },
      publishedAt: { $gte: new Date(now.getTime() - TRACKING_DAYS * DAY), $lte: new Date(now.getTime() - FIRST_COLLECT_DELAY_MS) },
      $or: [{ metrics: { $exists: false } }, { "metrics.nextCollectAt": { $lte: now } }],
    },
    { $set: { "metrics.nextCollectAt": new Date(now.getTime() + LEASE_MS) } },
    { sort: { "metrics.nextCollectAt": 1, publishedAt: 1 }, returnDocument: "before" },
  );
}

/**
 * Relève les chiffres des publications réelles (jamais des simulations), jusqu'à `max` ou l'échéance.
 * Chaque relevé réussi est historisé ; un indicateur non fourni reste absent.
 */
export async function collectDueMetrics(deps: CollectorDeps, options: { max?: number; deadline?: number } = {}): Promise<CollectSummary> {
  const now = deps.now ?? (() => new Date());
  const summary: CollectSummary = { collected: 0, unsupported: 0, failed: 0 };
  const c = collections(deps.db);

  for (let i = 0; i < (options.max ?? 15); i += 1) {
    if (options.deadline && Date.now() > options.deadline) break;
    const post = await claimNext(deps.db, now());
    if (!post) break;
    // Valeurs par défaut complétées champ par champ : un relevé interrompu a pu laisser un état partiel.
    const previous: PostMetricsState = {
      values: {},
      collectedAt: null,
      nextCollectAt: null,
      unsupported: false,
      lastError: null,
      attempts: 0,
      ...post.metrics,
    };
    const save = (state: Partial<PostMetricsState>) =>
      c.posts.updateOne({ _id: post._id }, { $set: { metrics: { ...previous, ...state, attempts: previous.attempts + 1 } } });
    const stop = async (message: string, unsupported: boolean) => {
      await save({ nextCollectAt: null, unsupported, lastError: message });
      summary[unsupported ? "unsupported" : "failed"] += 1;
    };

    const account = post.publishing?.socialAccountId
      ? await c.socialAccounts.findOne({ _id: post.publishing.socialAccountId, workspaceId: post.workspaceId })
      : null;
    if (!account || account.provider === "simulation") {
      await stop("Le compte qui a publié n'est plus connecté.", false);
      continue;
    }
    const fetcher = deps.fetchers[account.provider];
    if (!fetcher) {
      await stop(`${SOCIAL_NETWORKS[post.network].label} ne fournit pas encore de statistiques dans le studio.`, true);
      continue;
    }
    if (!account.accessToken || !deps.encryptionKey || account.status !== "connected") {
      // On réessaiera plus tard : le compte peut être reconnecté entre-temps.
      await save({ nextCollectAt: nextCollectionAt(post.publishedAt ?? now(), now()), lastError: "Compte à reconnecter pour relever les chiffres." });
      summary.failed += 1;
      continue;
    }

    try {
      const values: PostMetrics = await fetcher.fetch({
        post,
        account,
        accessToken: decryptSecret(account.accessToken, deps.encryptionKey),
        externalId: post.publishing?.externalId ?? "",
      });
      const collectedAt = now();
      await save({ values, collectedAt, nextCollectAt: nextCollectionAt(post.publishedAt ?? collectedAt, collectedAt), unsupported: false, lastError: null });
      await c.analyticsSnapshots.insertOne({
        _id: new ObjectId(),
        workspaceId: post.workspaceId,
        postId: post._id,
        brandId: post.brandId,
        network: post.network,
        collectedAt,
        values,
      });
      summary.collected += 1;
    } catch (error) {
      if (error instanceof MetricsError && error.kind !== "retryable") {
        await stop(error.message, error.kind === "unsupported");
        continue;
      }
      if (!(error instanceof MetricsError)) console.error("Relevé de statistiques impossible", account.provider, error instanceof Error ? error.message : error);
      await save({
        nextCollectAt: nextCollectionAt(post.publishedAt ?? now(), now()),
        lastError: error instanceof MetricsError ? error.message : "Relevé impossible pour le moment.",
      });
      summary.failed += 1;
    }
  }
  return summary;
}
