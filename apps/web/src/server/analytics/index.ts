import "server-only";
import { getServerEnv } from "@/server/env";
import { createMetaMetrics } from "./fetchers/meta";
import { createThreadsMetrics } from "./fetchers/threads";
import type { MetricsFetcher } from "./types";

/**
 * Sources de statistiques par fournisseur. LinkedIn n'en a pas encore : son accès aux statistiques
 * des publications de membres est réservé à des partenaires ; les publications concernées sont signalées comme telles.
 */
export function getMetricsFetchers(): Partial<Record<string, MetricsFetcher>> {
  const env = getServerEnv();
  return {
    meta: createMetaMetrics({ graphVersion: env.META_GRAPH_VERSION }),
    threads: createThreadsMetrics(),
  };
}
