import type { Db, ObjectId } from "mongodb";
import {
  computeRecommendations,
  engagementOf,
  METRIC_KEYS,
  type MetricKey,
  type PostMetrics,
  type Recommendation,
  type SocialNetworkId,
} from "@smia/shared";
import { collections, type PostDoc } from "@/server/db/collections";
import { assertPermission } from "@/server/services/permissions";
import type { WorkspaceAccess } from "@/server/services/workspaces";

export const ANALYTICS_PERIODS = [7, 30, 90] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export function parsePeriod(value: unknown): AnalyticsPeriod {
  const days = Number(value);
  return (ANALYTICS_PERIODS as readonly number[]).includes(days) ? (days as AnalyticsPeriod) : 30;
}

export interface MeasuredPostView {
  id: string;
  network: SocialNetworkId;
  excerpt: string;
  publishedAt: Date;
  timeZone: string;
  externalUrl: string | null;
  values: PostMetrics;
  engagement: number | null;
  collectedAt: Date;
}

export interface NetworkBreakdown {
  network: SocialNetworkId;
  published: number;
  measured: number;
  engagementAverage: number | null;
  /** Publications pour lesquelles le réseau ne fournit pas de chiffres. */
  unsupported: number;
}

export interface AnalyticsOverview {
  days: AnalyticsPeriod;
  from: Date;
  /** Publications réellement parues (les simulations sont comptées à part et jamais mesurées). */
  published: number;
  simulated: number;
  measured: number;
  /** En attente du premier relevé (moins d'une heure, ou relevé pas encore passé). */
  pending: number;
  /** Somme de chaque indicateur, et nombre de publications qui le fournissent. */
  totals: Partial<Record<MetricKey, { sum: number; posts: number }>>;
  engagementAverage: number | null;
  byNetwork: NetworkBreakdown[];
  topPosts: MeasuredPostView[];
  recent: MeasuredPostView[];
  recommendations: Recommendation[];
  /** Publications mesurées sur les 180 derniers jours, base des conseils. */
  recommendationBase: number;
  unsupportedMessages: string[];
}

const PROJECTION = {
  _id: 1,
  network: 1,
  text: 1,
  publishedAt: 1,
  timeZone: 1,
  mediaIds: 1,
  metrics: 1,
  "publishing.simulated": 1,
  "publishing.externalUrl": 1,
} as const;

type PostRow = Pick<PostDoc, "_id" | "network" | "text" | "publishedAt" | "timeZone" | "mediaIds" | "metrics" | "publishing">;

function toView(post: PostRow): MeasuredPostView | null {
  if (!post.metrics?.collectedAt || !post.publishedAt) return null;
  return {
    id: post._id.toHexString(),
    network: post.network,
    excerpt: post.text.length > 140 ? `${post.text.slice(0, 137).trimEnd()}…` : post.text,
    publishedAt: post.publishedAt,
    timeZone: post.timeZone,
    externalUrl: post.publishing?.externalUrl ?? null,
    values: post.metrics.values,
    engagement: engagementOf(post.metrics.values),
    collectedAt: post.metrics.collectedAt,
  };
}

const average = (values: number[]) => (values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length);

/** Vue d'ensemble des statistiques d'un espace, uniquement à partir des chiffres fournis par les réseaux. */
export async function getAnalyticsOverview(
  db: Db,
  access: WorkspaceAccess,
  options: { days?: AnalyticsPeriod; now?: Date } = {},
): Promise<AnalyticsOverview> {
  assertPermission(access, "content:read");
  const days = options.days ?? 30;
  const now = options.now ?? new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60_000);
  const c = collections(db);

  const rows = (await c.posts
    .find({ workspaceId: access.workspace._id, status: "published", publishedAt: { $gte: from } }, { projection: PROJECTION })
    .sort({ publishedAt: -1 })
    .limit(2000)
    .toArray()) as PostRow[];

  const real = rows.filter((post) => !post.publishing?.simulated);
  const measured = real.map(toView).filter((view): view is MeasuredPostView => view !== null);

  const totals: AnalyticsOverview["totals"] = {};
  for (const key of METRIC_KEYS) {
    const values = measured.map((post) => post.values[key]).filter((value): value is number => typeof value === "number");
    if (values.length > 0) totals[key] = { sum: values.reduce((sum, value) => sum + value, 0), posts: values.length };
  }

  const networks = [...new Set(real.map((post) => post.network))];
  const byNetwork: NetworkBreakdown[] = networks
    .map((network) => {
      const ofNetwork = real.filter((post) => post.network === network);
      const measuredOfNetwork = measured.filter((post) => post.network === network);
      return {
        network,
        published: ofNetwork.length,
        measured: measuredOfNetwork.length,
        engagementAverage: average(measuredOfNetwork.flatMap((post) => (post.engagement === null ? [] : [post.engagement]))),
        unsupported: ofNetwork.filter((post) => post.metrics?.unsupported).length,
      };
    })
    .sort((a, b) => b.published - a.published);

  const withEngagement = measured.filter((post) => post.engagement !== null);
  const topPosts = [...withEngagement].sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0)).slice(0, 5);

  // Les conseils s'appuient sur une période plus longue que l'affichage, pour avoir assez de recul.
  const base = await measuredForRecommendations(db, access.workspace._id, now);

  const unsupportedMessages = [
    ...new Set(real.filter((post) => post.metrics?.unsupported && post.metrics.lastError).map((post) => post.metrics?.lastError as string)),
  ];

  return {
    days,
    from,
    published: real.length,
    simulated: rows.length - real.length,
    measured: measured.length,
    pending: real.filter((post) => !post.metrics?.collectedAt && !post.metrics?.unsupported).length,
    totals,
    engagementAverage: average(withEngagement.map((post) => post.engagement as number)),
    byNetwork,
    topPosts,
    recent: measured.slice(0, 50),
    recommendations: computeRecommendations(base),
    recommendationBase: base.length,
    unsupportedMessages,
  };
}

async function measuredForRecommendations(db: Db, workspaceId: ObjectId, now: Date) {
  const rows = (await collections(db)
    .posts.find(
      {
        workspaceId,
        status: "published",
        "publishing.simulated": { $ne: true },
        "metrics.collectedAt": { $ne: null },
        publishedAt: { $gte: new Date(now.getTime() - 180 * 24 * 60 * 60_000) },
      },
      { projection: PROJECTION },
    )
    .limit(2000)
    .toArray()) as PostRow[];
  return rows.flatMap((post) => {
    const engagement = post.metrics ? engagementOf(post.metrics.values) : null;
    if (engagement === null || !post.publishedAt) return [];
    return [{ network: post.network, publishedAt: post.publishedAt, timeZone: post.timeZone, hasMedia: (post.mediaIds ?? []).length > 0, engagement }];
  });
}

/**
 * Publications réelles de la marque qui ont le mieux marché, transmises à l'IA comme exemples de style
 * (boucle d'amélioration). Seules celles qui ont obtenu au moins une interaction sont retenues.
 */
export async function bestPerformingPosts(
  db: Db,
  workspaceId: ObjectId,
  brandId: ObjectId,
  options: { limit?: number; now?: Date } = {},
): Promise<{ network: SocialNetworkId; text: string; engagement: number }[]> {
  const now = options.now ?? new Date();
  const rows = (await collections(db)
    .posts.find(
      {
        workspaceId,
        brandId,
        status: "published",
        "publishing.simulated": { $ne: true },
        "metrics.collectedAt": { $ne: null },
        publishedAt: { $gte: new Date(now.getTime() - 180 * 24 * 60 * 60_000) },
      },
      { projection: { network: 1, text: 1, metrics: 1 } },
    )
    .limit(500)
    .toArray()) as Pick<PostDoc, "network" | "text" | "metrics">[];
  return rows
    .flatMap((post) => {
      const engagement = post.metrics ? engagementOf(post.metrics.values) : null;
      return engagement && engagement > 0 ? [{ network: post.network, text: post.text.slice(0, 600), engagement }] : [];
    })
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, options.limit ?? 3);
}
