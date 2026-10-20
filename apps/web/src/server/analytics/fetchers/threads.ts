import { cleanMetrics } from "@smia/shared";
import { THREADS_GRAPH_URL } from "@/server/publishing/publishers/threads";
import type { FetchLike } from "@/server/social/http";
import type { MetricsFetcher } from "../types";
import { insightsTolerant } from "./graph";

/** Statistiques Threads : vues, j'aime, réponses, republications, citations et partages. */
export function createThreadsMetrics(options: { fetch?: FetchLike } = {}): MetricsFetcher {
  const fetchImpl = options.fetch ?? fetch;
  return {
    provider: "threads",
    async fetch({ accessToken, externalId }) {
      const insights = await insightsTolerant(fetchImpl, `${THREADS_GRAPH_URL}/${externalId}/insights`, accessToken, [
        "views",
        "likes",
        "replies",
        "reposts",
        "quotes",
        "shares",
      ]);
      const shared = [insights.reposts, insights.quotes, insights.shares].filter((value): value is number => typeof value === "number");
      return cleanMetrics({
        views: insights.views,
        likes: insights.likes,
        comments: insights.replies,
        shares: shared.length > 0 ? shared.reduce((sum, value) => sum + value, 0) : undefined,
      });
    },
  };
}
