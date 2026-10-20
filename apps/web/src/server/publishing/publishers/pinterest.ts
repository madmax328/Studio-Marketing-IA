import { SOCIAL_NETWORKS } from "@smia/shared";
import { isRecord, publishStep, sleep as defaultSleep, stringField, type FetchLike } from "@/server/social/http";
import { PINTEREST_API_URL } from "@/server/social/oauth-pinterest";
import { isVideo, PublishError, type PublishMedia, type SocialPublisher } from "../types";

const MAX_IMAGES = 5;
const MEDIA_POLLS = 6;
const MEDIA_POLL_MS = 3_000;

export interface PinterestPublisherOptions {
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Connecteur Pinterest (API v5) : épingle avec une image, plusieurs images (2 à 5) ou une vidéo,
 * dans le tableau choisi à la connexion.
 */
export function createPinterestPublisher(options: PinterestPublisherOptions = {}): SocialPublisher {
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const label = SOCIAL_NETWORKS.pinterest.label;
  const errors = { authStatuses: [401] };
  const json = (token: string, body: unknown): RequestInit => ({
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  /** Envoi de la vidéo chez Pinterest (enregistrement, puis dépôt direct vers leur stockage). */
  async function uploadVideo(token: string, video: PublishMedia): Promise<string> {
    const registered = (await publishStep(label, fetchImpl, `${PINTEREST_API_URL}/media`, json(token, { media_type: "video" }), { finalStep: false, ...errors })).body;
    const mediaId = stringField(registered, "media_id");
    const uploadUrl = stringField(registered, "upload_url");
    const parameters = isRecord(registered) && isRecord(registered.upload_parameters) ? registered.upload_parameters : {};
    if (!mediaId || !uploadUrl) throw new PublishError(`${label} n'a pas fourni d'adresse d'envoi pour la vidéo.`, "retryable");
    const body = new FormData();
    for (const [key, value] of Object.entries(parameters)) if (typeof value === "string") body.set(key, value);
    body.set("file", new Blob([new Uint8Array(await video.read())], { type: "video/mp4" }), "video.mp4");
    await publishStep(label, fetchImpl, uploadUrl, { method: "POST", body }, { finalStep: false, ...errors });
    return mediaId;
  }

  async function waitForVideo(token: string, mediaId: string): Promise<void> {
    for (let i = 0; i < MEDIA_POLLS; i += 1) {
      const body = (await publishStep(label, fetchImpl, `${PINTEREST_API_URL}/media/${encodeURIComponent(mediaId)}`, { headers: { Authorization: `Bearer ${token}` } }, { finalStep: false, ...errors })).body;
      const status = stringField(body, "status");
      if (status === "succeeded") return;
      if (status === "failed") throw new PublishError(`${label} n'a pas pu traiter la vidéo.`, "permanent");
      await sleep(MEDIA_POLL_MS);
    }
    throw new PublishError(`${label} traite encore la vidéo : nouvel essai dans quelques minutes.`, "retryable", { pinterestMedia: mediaId });
  }

  return {
    provider: "pinterest",
    async publish({ post, account, accessToken, media, resume }) {
      if (!accessToken) throw new PublishError("Jeton d'accès manquant.", "auth");
      if (media.length === 0) throw new PublishError(`${label} exige une image ou une vidéo.`, "permanent");
      if (media.length > MAX_IMAGES) throw new PublishError(`${label} accepte au plus ${MAX_IMAGES} images par épingle.`, "permanent");

      let mediaSource: Record<string, unknown>;
      const video = media[0] && isVideo(media[0]) ? media[0] : null;
      if (video) {
        const mediaId = resume?.pinterestMedia ?? (await uploadVideo(accessToken, video));
        await waitForVideo(accessToken, mediaId);
        mediaSource = { source_type: "video_id", media_id: mediaId, cover_image_key_frame_time: 1 };
      } else if (media.length === 1) {
        mediaSource = { source_type: "image_url", url: imageUrl(media[0] as PublishMedia) };
      } else {
        mediaSource = { source_type: "multiple_image_urls", items: media.map((item) => ({ url: imageUrl(item) })) };
      }

      const title = (post.text.split("\n").find((line) => line.trim()) ?? "").replace(/#[\p{L}\p{N}_]+/gu, "").trim().slice(0, 100);
      const pin = (
        await publishStep(label, fetchImpl, `${PINTEREST_API_URL}/pins`, json(accessToken, {
          board_id: account.externalAccountId,
          ...(title ? { title } : {}),
          description: post.text.slice(0, 800),
          media_source: mediaSource,
        }), { finalStep: true, ...errors })
      ).body;
      const id = stringField(pin, "id");
      if (!id) throw new PublishError(`${label} a accepté l'épingle sans renvoyer son identifiant : vérifiez sur le tableau.`, "uncertain");
      return { externalId: id, externalUrl: `https://www.pinterest.com/pin/${id}/`, simulated: false };
    },
  };
}

/** Pinterest accepte JPEG et PNG : les autres formats sont convertis en JPEG par le lien signé. */
function imageUrl(media: PublishMedia): string {
  return media.mimeType === "image/jpeg" || media.mimeType === "image/png" ? media.publicUrl : `${media.publicUrl}&format=jpeg`;
}
