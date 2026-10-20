import { SOCIAL_NETWORKS } from "@smia/shared";
import { isRecord, publishStep, sleep as defaultSleep, stringField, type FetchLike } from "@/server/social/http";
import { X_API_URL } from "@/server/social/oauth-x";
import { isVideo, PublishError, type PublishMedia, type SocialPublisher } from "../types";

const MAX_IMAGES = 4;
/** Taille des morceaux d'envoi des médias. */
const SEGMENT_BYTES = 4 * 1024 * 1024;
const PROCESSING_POLLS = 6;

export interface XPublisherOptions {
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Connecteur X (API v2) : texte seul, jusqu'à 4 images ou une vidéo. Les médias sont envoyés par morceaux,
 * puis joints à la publication.
 */
export function createXPublisher(options: XPublisherOptions = {}): SocialPublisher {
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const label = SOCIAL_NETWORKS.x.label;
  const errors = { authStatuses: [401] };
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function uploadMedia(token: string, item: PublishMedia): Promise<{ id: string; processing: boolean }> {
    const bytes = await item.read();
    const video = isVideo(item);
    const init = (
      await publishStep(label, fetchImpl, `${X_API_URL}/media/upload/initialize`, {
        method: "POST",
        headers: { ...auth(token), "Content-Type": "application/json" },
        body: JSON.stringify({ media_type: item.mimeType, total_bytes: bytes.length, media_category: video ? "tweet_video" : "tweet_image" }),
      }, { finalStep: false, ...errors })
    ).body;
    const id = stringField(isRecord(init) ? init.data : null, "id");
    if (!id) throw new PublishError(`${label} n'a pas accepté l'envoi du média.`, "retryable");

    for (let index = 0; index * SEGMENT_BYTES < bytes.length; index += 1) {
      const body = new FormData();
      body.set("segment_index", String(index));
      body.set("media", new Blob([new Uint8Array(bytes.subarray(index * SEGMENT_BYTES, (index + 1) * SEGMENT_BYTES))], { type: item.mimeType }), "media");
      await publishStep(label, fetchImpl, `${X_API_URL}/media/upload/${id}/append`, { method: "POST", headers: auth(token), body }, { finalStep: false, ...errors });
    }
    const finalized = (await publishStep(label, fetchImpl, `${X_API_URL}/media/upload/${id}/finalize`, { method: "POST", headers: auth(token) }, { finalStep: false, ...errors })).body;
    const info = isRecord(finalized) && isRecord(finalized.data) ? finalized.data.processing_info : null;
    return { id, processing: Boolean(info) && stringField(info, "state") !== "succeeded" };
  }

  /** Attend la fin du traitement d'une vidéo par X ; sinon, reprise au passage suivant sans renvoyer le fichier. */
  async function waitForMedia(token: string, id: string): Promise<void> {
    for (let i = 0; i < PROCESSING_POLLS; i += 1) {
      const body = (
        await publishStep(label, fetchImpl, `${X_API_URL}/media/upload?${new URLSearchParams({ command: "STATUS", media_id: id })}`, { headers: auth(token) }, { finalStep: false, ...errors })
      ).body;
      const info = isRecord(body) && isRecord(body.data) ? body.data.processing_info : null;
      const state = stringField(info, "state");
      if (!info || state === "succeeded") return;
      if (state === "failed") throw new PublishError(`${label} n'a pas pu traiter la vidéo.`, "permanent");
      const wait = isRecord(info) && typeof info.check_after_secs === "number" ? info.check_after_secs : 3;
      await sleep(Math.min(wait, 5) * 1000);
    }
    throw new PublishError(`${label} traite encore la vidéo : nouvel essai dans quelques minutes.`, "retryable", { xMedia: id });
  }

  return {
    provider: "x",
    async publish({ post, account, accessToken, media, resume }) {
      if (!accessToken) throw new PublishError("Jeton d'accès manquant.", "auth");
      const video = media.find(isVideo);
      if (video && media.length > 1) throw new PublishError(`${label} accepte une seule vidéo, sans image.`, "permanent");
      if (media.length > MAX_IMAGES) throw new PublishError(`${label} accepte au plus ${MAX_IMAGES} images.`, "permanent");

      const mediaIds: string[] = [];
      if (video) {
        const id = resume?.xMedia ?? (await uploadMedia(accessToken, video)).id;
        await waitForMedia(accessToken, id);
        mediaIds.push(id);
      } else {
        for (const item of media) mediaIds.push((await uploadMedia(accessToken, item)).id);
      }

      const created = (
        await publishStep(label, fetchImpl, `${X_API_URL}/tweets`, {
          method: "POST",
          headers: { ...auth(accessToken), "Content-Type": "application/json" },
          body: JSON.stringify({ text: post.text, ...(mediaIds.length > 0 ? { media: { media_ids: mediaIds } } : {}) }),
        }, { finalStep: true, ...errors })
      ).body;
      const id = stringField(isRecord(created) ? created.data : null, "id");
      if (!id) throw new PublishError(`${label} a accepté la publication sans renvoyer son identifiant : vérifiez sur le compte.`, "uncertain");
      const username = account.displayName.startsWith("@") ? account.displayName.slice(1) : "i/web";
      return { externalId: id, externalUrl: `https://x.com/${username}/status/${id}`, simulated: false };
    },
  };
}
