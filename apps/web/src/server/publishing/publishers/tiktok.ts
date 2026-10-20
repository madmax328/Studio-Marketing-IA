import { SOCIAL_NETWORKS } from "@smia/shared";
import { apiErrorMessage, callApi, isRecord, NetworkFailure, networkFailure, sleep as defaultSleep, stringField, type ApiResponse, type FetchLike } from "@/server/social/http";
import { isVideo, PublishError, type PublishErrorKind, type PublishMedia, type SocialPublisher } from "../types";

const API_URL = "https://open.tiktokapis.com/v2/post/publish";
const MAX_PHOTOS = 35;
const MB = 1024 * 1024;
/** Un fichier jusqu'à 64 Mo part en un seul morceau ; au-delà, morceaux de 10 Mo (le dernier absorbe le reste). */
const SINGLE_CHUNK_MAX = 64 * MB;
const CHUNK_SIZE = 10 * MB;
const STATUS_POLLS = 6;
const STATUS_POLL_MS = 3_000;

const AUTH_CODES = ["access_token_invalid", "scope_not_authorized", "scope_permission_missed"];
const RETRYABLE_CODES = ["rate_limit_exceeded", "spam_risk_too_many_pending_share", "spam_risk_too_many_posts", "internal_error"];

export interface TikTokPublisherOptions {
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

/** Découpage d'une vidéo pour l'envoi par morceaux exigé par TikTok. */
export function tiktokChunks(size: number): { chunkSize: number; ranges: { first: number; last: number }[] } {
  if (size <= SINGLE_CHUNK_MAX) return { chunkSize: size, ranges: [{ first: 0, last: size - 1 }] };
  const count = Math.floor(size / CHUNK_SIZE);
  const ranges = Array.from({ length: count }, (_, index) => ({
    first: index * CHUNK_SIZE,
    last: index === count - 1 ? size - 1 : (index + 1) * CHUNK_SIZE - 1,
  }));
  return { chunkSize: CHUNK_SIZE, ranges };
}

/**
 * Connecteur TikTok (Content Posting API, publication directe) : vidéo envoyée par morceaux,
 * ou série de photos récupérées par TikTok via un lien signé (domaine à vérifier chez TikTok).
 * Tant que l'application n'a pas passé l'audit de TikTok, les publications restent privées.
 */
export function createTikTokPublisher(options: TikTokPublisherOptions = {}): SocialPublisher {
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const label = SOCIAL_NETWORKS.tiktok.label;

  /** Les réponses TikTok contiennent toujours `error` ; le code « ok » signifie succès. */
  async function step(url: string, init: RequestInit, finalStep: boolean): Promise<ApiResponse> {
    let response: ApiResponse;
    try {
      response = await callApi(fetchImpl, url, init);
    } catch (error) {
      if (error instanceof NetworkFailure) throw networkFailure(label, finalStep);
      throw error;
    }
    const error = isRecord(response.body) && isRecord(response.body.error) ? response.body.error : null;
    const code = stringField(error, "code");
    if (response.status < 400 && (!error || code === "ok")) return response;

    const detail = apiErrorMessage(response.body);
    const suffix = detail ? ` (${detail})` : "";
    let kind: PublishErrorKind;
    if (response.status === 401 || (code && AUTH_CODES.includes(code))) kind = "auth";
    else if (response.status === 429 || (code && RETRYABLE_CODES.includes(code))) kind = "retryable";
    else if (response.status >= 500) kind = finalStep ? "uncertain" : "retryable";
    else kind = "permanent";
    if (code === "unaudited_client_can_only_post_to_private_accounts") {
      throw new PublishError(`${label} n'accepte que les comptes privés tant que l'application n'a pas été validée par TikTok.`, "permanent");
    }
    const messages: Record<PublishErrorKind, string> = {
      auth: `${label} a refusé l'autorisation du compte${suffix}.`,
      retryable: `${label} limite les envois pour le moment${suffix}.`,
      uncertain: `${label} a rencontré une erreur au moment de publier : vérifiez sur le compte si la publication est parue${suffix}.`,
      permanent: `${label} a refusé la publication${suffix}.`,
    };
    throw new PublishError(messages[kind], kind);
  }

  const json = (token: string, body: unknown): RequestInit => ({
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body),
  });

  /** Niveau de visibilité : public si le compte le permet, sinon le premier proposé (privé avant l'audit). */
  async function privacyLevel(token: string): Promise<string> {
    const body = (await step(`${API_URL}/creator_info/query/`, json(token, {}), false)).body;
    const data = isRecord(body) ? body.data : null;
    const options = isRecord(data) && Array.isArray(data.privacy_level_options) ? data.privacy_level_options.filter((item): item is string => typeof item === "string") : [];
    if (options.includes("PUBLIC_TO_EVERYONE")) return "PUBLIC_TO_EVERYONE";
    const first = options[0];
    if (!first) throw new PublishError(`${label} n'autorise pas ce compte à publier pour le moment.`, "permanent");
    return first;
  }

  async function initVideo(token: string, text: string, privacy: string, size: number, aiGenerated: boolean): Promise<{ publishId: string; uploadUrl: string; ranges: { first: number; last: number }[] }> {
    const { chunkSize, ranges } = tiktokChunks(size);
    const body = (
      await step(
        `${API_URL}/video/init/`,
        json(token, {
          post_info: {
            title: text.slice(0, 2200),
            privacy_level: privacy,
            disable_comment: false,
            disable_duet: false,
            disable_stitch: false,
            video_cover_timestamp_ms: 1000,
            // Contenu créé par IA : étiqueté comme tel sur TikTok.
            is_aigc: aiGenerated,
          },
          source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunkSize, total_chunk_count: ranges.length },
        }),
        false,
      )
    ).body;
    const data = isRecord(body) ? body.data : null;
    const publishId = stringField(data, "publish_id");
    const uploadUrl = stringField(data, "upload_url");
    if (!publishId || !uploadUrl) throw new PublishError(`${label} n'a pas fourni d'adresse d'envoi.`, "retryable");
    return { publishId, uploadUrl, ranges };
  }

  async function initPhotos(token: string, text: string, privacy: string, media: PublishMedia[]): Promise<string> {
    const body = (
      await step(
        `${API_URL}/content/init/`,
        json(token, {
          post_info: { title: (text.split("\n")[0] ?? "").slice(0, 90), description: text.slice(0, 4000), privacy_level: privacy, disable_comment: false, auto_add_music: true },
          source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: media.map(photoUrl) },
          post_mode: "DIRECT_POST",
          media_type: "PHOTO",
        }),
        true,
      )
    ).body;
    const publishId = stringField(isRecord(body) ? body.data : null, "publish_id");
    if (!publishId) throw new PublishError(`${label} a accepté la publication sans renvoyer son identifiant : vérifiez sur le compte.`, "uncertain");
    return publishId;
  }

  /** Suit le traitement de la publication par TikTok ; reprise au passage suivant si c'est long. */
  async function waitForPublication(token: string, publishId: string): Promise<string | null> {
    for (let i = 0; i < STATUS_POLLS; i += 1) {
      const body = (await step(`${API_URL}/status/fetch/`, json(token, { publish_id: publishId }), false)).body;
      const data = isRecord(body) ? body.data : null;
      const status = stringField(data, "status");
      if (status === "PUBLISH_COMPLETE") {
        // (Orthographe de l'API.) Vide pour une publication privée.
        const ids = isRecord(data) && Array.isArray(data.publicaly_available_post_id) ? data.publicaly_available_post_id : [];
        const first = ids[0];
        return typeof first === "string" || typeof first === "number" ? String(first) : null;
      }
      if (status === "FAILED") {
        const reason = stringField(data, "fail_reason");
        throw new PublishError(`${label} n'a pas pu publier${reason ? ` (${reason})` : ""}.`, "permanent");
      }
      await sleep(STATUS_POLL_MS);
    }
    throw new PublishError(`${label} traite encore la publication : vérification dans quelques minutes.`, "retryable", { tiktokPublishId: publishId });
  }

  return {
    provider: "tiktok",
    async publish({ post, account, accessToken, media, resume }) {
      if (!accessToken) throw new PublishError("Jeton d'accès manquant.", "auth");
      if (media.length === 0) throw new PublishError(`${label} exige une vidéo ou des photos.`, "permanent");
      if (media.length > MAX_PHOTOS) throw new PublishError(`${label} accepte au plus ${MAX_PHOTOS} photos.`, "permanent");

      let publishId = resume?.tiktokPublishId ?? null;
      if (!publishId) {
        const privacy = await privacyLevel(accessToken);
        const video = media[0] && isVideo(media[0]) ? media[0] : null;
        if (video) {
          const bytes = await video.read();
          const init = await initVideo(accessToken, post.text, privacy, bytes.length, video.aiGenerated === true);
          for (const [index, range] of init.ranges.entries()) {
            await step(init.uploadUrl, {
              method: "PUT",
              headers: {
                "Content-Type": "video/mp4",
                "Content-Range": `bytes ${range.first}-${range.last}/${bytes.length}`,
              },
              body: new Uint8Array(bytes.subarray(range.first, range.last + 1)),
            }, index === init.ranges.length - 1);
          }
          publishId = init.publishId;
        } else {
          publishId = await initPhotos(accessToken, post.text, privacy, media);
        }
      }

      const postId = await waitForPublication(accessToken, publishId);
      const username = account.displayName.startsWith("@") ? account.displayName.slice(1) : null;
      return {
        externalId: postId ?? publishId,
        externalUrl: postId && username ? `https://www.tiktok.com/@${username}/video/${postId}` : null,
        simulated: false,
      };
    },
  };
}

/** TikTok accepte JPEG et WebP : les autres formats sont convertis en JPEG par le lien signé. */
function photoUrl(media: PublishMedia): string {
  return media.mimeType === "image/jpeg" || media.mimeType === "image/webp" ? media.publicUrl : `${media.publicUrl}&format=jpeg`;
}
