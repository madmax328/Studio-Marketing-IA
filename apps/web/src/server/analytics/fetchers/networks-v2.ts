import { cleanMetrics } from "@smia/shared";
import { callApi, isRecord, NetworkFailure, type ApiResponse, type FetchLike } from "@/server/social/http";
import { PINTEREST_API_URL } from "@/server/social/oauth-pinterest";
import { X_API_URL } from "@/server/social/oauth-x";
import { MetricsError, type MetricsFetcher } from "../types";

/** Appel d'une API de statistiques : autorisation absente → indisponible, introuvable → supprimée, sinon réessai. */
async function apiCall(fetchImpl: FetchLike, url: string, token: string, init: RequestInit = {}): Promise<ApiResponse> {
  let response: ApiResponse;
  try {
    response = await callApi(fetchImpl, url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  } catch (error) {
    if (error instanceof NetworkFailure) throw new MetricsError("Le réseau n'a pas répondu.", "retryable");
    throw error;
  }
  if (response.status === 401 || response.status === 403) throw new MetricsError("Les statistiques ne sont pas autorisées pour ce compte.", "unsupported");
  if (response.status === 404) throw new MetricsError("La publication n'existe plus sur le réseau.", "gone");
  if (response.status >= 400) throw new MetricsError("Le réseau n'a pas fourni les statistiques.", "retryable");
  return response;
}

/** Nombre lu tel quel ou depuis une chaîne (YouTube renvoie des chaînes). */
function count(record: unknown, key: string): number | undefined {
  if (!isRecord(record)) return undefined;
  const value = record[key];
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : undefined;
}

const sum = (...values: (number | undefined)[]) => {
  const present = values.filter((value): value is number => value !== undefined);
  return present.length > 0 ? present.reduce((total, value) => total + value, 0) : undefined;
};

/** YouTube : vues, j'aime et commentaires (statistiques publiques de la vidéo). */
export function createYouTubeMetrics(options: { fetch?: FetchLike } = {}): MetricsFetcher {
  const fetchImpl = options.fetch ?? fetch;
  return {
    provider: "youtube",
    async fetch({ accessToken, externalId }) {
      const params = new URLSearchParams({ part: "statistics", id: externalId });
      const body = (await apiCall(fetchImpl, `https://www.googleapis.com/youtube/v3/videos?${params}`, accessToken)).body;
      const item = isRecord(body) && Array.isArray(body.items) ? body.items[0] : undefined;
      if (!item) throw new MetricsError("La vidéo n'existe plus sur YouTube.", "gone");
      const stats = isRecord(item) ? item.statistics : null;
      return cleanMetrics({ views: count(stats, "viewCount"), likes: count(stats, "likeCount"), comments: count(stats, "commentCount") });
    },
  };
}

/** TikTok : vues, j'aime, commentaires, partages (vidéos publiques uniquement). */
export function createTikTokMetrics(options: { fetch?: FetchLike } = {}): MetricsFetcher {
  const fetchImpl = options.fetch ?? fetch;
  return {
    provider: "tiktok",
    async fetch({ accessToken, externalId }) {
      // Sans identifiant public (publication privée avant l'audit), TikTok ne fournit pas de chiffres.
      if (!/^\d+$/.test(externalId)) throw new MetricsError("Statistiques disponibles pour les vidéos publiques uniquement.", "unsupported");
      const body = (
        await apiCall(fetchImpl, "https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count", accessToken, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filters: { video_ids: [externalId] } }),
        })
      ).body;
      const data = isRecord(body) ? body.data : null;
      const video = isRecord(data) && Array.isArray(data.videos) ? data.videos[0] : undefined;
      if (!video) throw new MetricsError("La vidéo n'existe plus sur TikTok.", "gone");
      return cleanMetrics({
        views: count(video, "view_count"),
        likes: count(video, "like_count"),
        comments: count(video, "comment_count"),
        shares: count(video, "share_count"),
      });
    },
  };
}

/** Pinterest : impressions, enregistrements, clics, réactions et commentaires de l'épingle. */
export function createPinterestMetrics(options: { fetch?: FetchLike } = {}): MetricsFetcher {
  const fetchImpl = options.fetch ?? fetch;
  return {
    provider: "pinterest",
    async fetch({ accessToken, externalId }) {
      const body = (await apiCall(fetchImpl, `${PINTEREST_API_URL}/pins/${encodeURIComponent(externalId)}?pin_metrics=true`, accessToken)).body;
      const metrics = isRecord(body) && isRecord(body.pin_metrics) ? body.pin_metrics : null;
      const lifetime = isRecord(metrics) ? metrics.lifetime_metrics : null;
      if (!isRecord(lifetime)) throw new MetricsError("Pinterest ne fournit pas encore de chiffres pour cette épingle.", "retryable");
      return cleanMetrics({
        views: count(lifetime, "impression"),
        saves: count(lifetime, "save"),
        clicks: sum(count(lifetime, "pin_click"), count(lifetime, "outbound_click")),
        likes: count(lifetime, "reaction"),
        comments: count(lifetime, "comment"),
      });
    },
  };
}

/** X : vues, j'aime, réponses, republications et citations, signets (indicateurs publics). */
export function createXMetrics(options: { fetch?: FetchLike } = {}): MetricsFetcher {
  const fetchImpl = options.fetch ?? fetch;
  return {
    provider: "x",
    async fetch({ accessToken, externalId }) {
      const body = (await apiCall(fetchImpl, `${X_API_URL}/tweets/${encodeURIComponent(externalId)}?tweet.fields=public_metrics`, accessToken)).body;
      const data = isRecord(body) ? body.data : null;
      if (!isRecord(data)) throw new MetricsError("La publication n'existe plus sur X.", "gone");
      const metrics = data.public_metrics;
      return cleanMetrics({
        views: count(metrics, "impression_count"),
        likes: count(metrics, "like_count"),
        comments: count(metrics, "reply_count"),
        shares: sum(count(metrics, "retweet_count"), count(metrics, "quote_count")),
        saves: count(metrics, "bookmark_count"),
      });
    },
  };
}
