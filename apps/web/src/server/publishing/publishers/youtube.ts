import { SOCIAL_NETWORKS } from "@smia/shared";
import { apiErrorMessage, callApi, isRecord, NetworkFailure, networkFailure, stringField, type ApiResponse, type FetchLike } from "@/server/social/http";
import { isVideo, PublishError, type PublishErrorKind, type SocialPublisher } from "../types";

const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
/** Quota journalier épuisé : nouvel essai plus tard plutôt qu'un échec définitif. */
const RETRYABLE_REASONS = ["quotaExceeded", "rateLimitExceeded", "userRateLimitExceeded", "backendError"];

export interface YouTubePublisherOptions {
  fetch?: FetchLike;
}

/** Titre d'une vidéo YouTube : la première ligne du texte, sans chevrons (refusés), 100 caractères au plus. */
export function youtubeTitle(text: string): string {
  const firstLine = text.split("\n").find((line) => line.trim()) ?? "";
  const clean = firstLine.replace(/[<>]/g, "").replace(/#[\p{L}\p{N}_]+/gu, "").replace(/\s+/g, " ").trim();
  if (!clean) return "Vidéo";
  return clean.length <= 100 ? clean : `${clean.slice(0, 99).trimEnd()}…`;
}

/**
 * Connecteur YouTube (Data API v3, envoi « resumable ») : une vidéo par publication ; une vidéo verticale
 * de moins de 3 minutes est classée en Short par YouTube. Tant que le projet Google n'a pas passé l'audit,
 * les vidéos envoyées restent privées.
 */
export function createYouTubePublisher(options: YouTubePublisherOptions = {}): SocialPublisher {
  const fetchImpl = options.fetch ?? fetch;
  const label = SOCIAL_NETWORKS.youtube.label;

  async function step(url: string, init: RequestInit, finalStep: boolean): Promise<ApiResponse> {
    let response: ApiResponse;
    try {
      response = await callApi(fetchImpl, url, { ...init, signal: AbortSignal.timeout(50_000) });
    } catch (error) {
      if (error instanceof NetworkFailure) throw networkFailure(label, finalStep);
      throw error;
    }
    if (response.status < 400) return response;
    const error = isRecord(response.body) && isRecord(response.body.error) ? response.body.error : null;
    const reasons = (error && Array.isArray(error.errors) ? error.errors : []).map((item) => stringField(item, "reason"));
    const detail = apiErrorMessage(response.body);
    const suffix = detail ? ` (${detail})` : "";
    let kind: PublishErrorKind;
    if (response.status === 401) kind = "auth";
    else if (response.status === 429 || reasons.some((reason) => reason && RETRYABLE_REASONS.includes(reason))) kind = "retryable";
    else if (reasons.includes("insufficientPermissions") || reasons.includes("forbidden")) kind = "auth";
    else if (response.status >= 500) kind = finalStep ? "uncertain" : "retryable";
    else kind = "permanent";
    const messages: Record<PublishErrorKind, string> = {
      auth: `${label} a refusé l'autorisation du compte${suffix}.`,
      retryable: `${label} limite les envois pour le moment (quota journalier)${suffix}.`,
      uncertain: `${label} a rencontré une erreur à la fin de l'envoi : vérifiez sur la chaîne si la vidéo est parue${suffix}.`,
      permanent: `${label} a refusé la vidéo${suffix}.`,
    };
    throw new PublishError(messages[kind], kind);
  }

  return {
    provider: "youtube",
    async publish({ post, accessToken, media }) {
      if (!accessToken) throw new PublishError("Jeton d'accès manquant.", "auth");
      const video = media[0];
      if (!video || !isVideo(video) || media.length > 1) throw new PublishError(`${label} publie uniquement une vidéo.`, "permanent");
      const bytes = await video.read();

      const session = await step(UPLOAD_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(bytes.length),
          "X-Upload-Content-Type": "video/mp4",
        },
        body: JSON.stringify({
          snippet: { title: youtubeTitle(post.text), description: post.text.slice(0, 5000), categoryId: "22" },
          status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
        }),
      }, false);
      const location = session.headers.get("location");
      if (!location) throw new PublishError(`${label} n'a pas fourni d'adresse d'envoi.`, "retryable");

      const uploaded = await step(location, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "video/mp4" },
        body: new Uint8Array(bytes),
      }, true);
      const id = stringField(uploaded.body, "id");
      if (!id) throw new PublishError(`${label} a reçu la vidéo sans renvoyer son identifiant : vérifiez sur la chaîne.`, "uncertain");
      return { externalId: id, externalUrl: `https://www.youtube.com/watch?v=${id}`, simulated: false };
    },
  };
}
