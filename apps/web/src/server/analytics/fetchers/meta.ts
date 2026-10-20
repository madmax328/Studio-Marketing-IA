import { cleanMetrics, type PostMetrics } from "@smia/shared";
import { isRecord, numberField, type FetchLike } from "@/server/social/http";
import { MetricsError, type MetricsFetcher } from "../types";
import { graphGet, insightsTolerant } from "./graph";

/**
 * Statistiques Meta (Graph API).
 * - Facebook : réactions, commentaires, partages ; personnes touchées et clics quand Meta les fournit.
 * - Instagram : j'aime, commentaires ; vues, personnes touchées, partages et enregistrements via les insights.
 * Les indicateurs retirés par Meta sont simplement absents (jamais estimés).
 */
export function createMetaMetrics(options: { graphVersion: string; fetch?: FetchLike }): MetricsFetcher {
  const fetchImpl = options.fetch ?? fetch;
  const base = `https://graph.facebook.com/${options.graphVersion}`;

  async function facebook(postId: string, token: string): Promise<PostMetrics> {
    const fields = encodeURIComponent("shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)");
    const body = (await graphGet(fetchImpl, `${base}/${postId}?fields=${fields}`, token)).body;
    const summary = (key: string) => {
      const field = isRecord(body) ? body[key] : null;
      return isRecord(field) ? numberField(field.summary, "total_count") : null;
    };
    const shares = isRecord(body) ? numberField(body.shares, "count") : null;
    const insights = await insightsTolerant(fetchImpl, `${base}/${postId}/insights`, token, ["post_impressions_unique", "post_clicks"]).catch(
      (error: unknown) => {
        // Les statistiques avancées demandent une permission à part : sans elle, on garde les chiffres publics.
        if (error instanceof MetricsError && error.kind === "unsupported") return {} as Record<string, number>;
        throw error;
      },
    );
    return cleanMetrics({
      likes: summary("reactions") ?? undefined,
      comments: summary("comments") ?? undefined,
      // Meta omet le champ « shares » quand il n'y a aucun partage.
      shares: shares ?? 0,
      reach: insights.post_impressions_unique,
      clicks: insights.post_clicks,
    });
  }

  async function instagram(mediaId: string, token: string): Promise<PostMetrics> {
    const body = (await graphGet(fetchImpl, `${base}/${mediaId}?fields=like_count,comments_count`, token)).body;
    const insights = await insightsTolerant(fetchImpl, `${base}/${mediaId}/insights`, token, ["views", "reach", "shares", "saved"]).catch(
      (error: unknown) => {
        if (error instanceof MetricsError && error.kind === "unsupported") return {} as Record<string, number>;
        throw error;
      },
    );
    return cleanMetrics({
      likes: numberField(body, "like_count") ?? undefined,
      comments: numberField(body, "comments_count") ?? undefined,
      views: insights.views,
      reach: insights.reach,
      shares: insights.shares,
      saves: insights.saved,
    });
  }

  return {
    provider: "meta",
    async fetch({ account, accessToken, externalId }) {
      if (account.network === "facebook") return facebook(externalId, accessToken);
      if (account.network === "instagram") return instagram(externalId, accessToken);
      throw new MetricsError("Réseau non pris en charge par ce connecteur.", "unsupported");
    },
  };
}
