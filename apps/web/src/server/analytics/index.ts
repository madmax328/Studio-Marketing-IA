import "server-only";
import { getServerEnv } from "@/server/env";
import { createMetaMetrics } from "./fetchers/meta";
import { createPinterestMetrics, createTikTokMetrics, createXMetrics, createYouTubeMetrics } from "./fetchers/networks-v2";
import { createThreadsMetrics } from "./fetchers/threads";
import type { MetricsFetcher } from "./types";

/**
 * Sources de statistiques par fournisseur. LinkedIn et Google Business Profile n'en ont pas : l'accès aux statistiques
 * des publications de membres LinkedIn est réservé à des partenaires, et Google ne fournit pas de chiffres par
 * publication ; les publications concernées sont signalées comme telles.
 */
export function getMetricsFetchers(): Partial<Record<string, MetricsFetcher>> {
  const env = getServerEnv();
  return {
    meta: createMetaMetrics({ graphVersion: env.META_GRAPH_VERSION }),
    threads: createThreadsMetrics(),
    youtube: createYouTubeMetrics(),
    tiktok: createTikTokMetrics(),
    pinterest: createPinterestMetrics(),
    x: createXMetrics(),
  };
}
