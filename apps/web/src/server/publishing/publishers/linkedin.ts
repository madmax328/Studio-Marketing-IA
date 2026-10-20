import { SOCIAL_NETWORKS } from "@smia/shared";
import { isRecord, publishStep, sleep as defaultSleep, stringField, type FetchLike } from "@/server/social/http";
import { isVideo, PublishError, type SocialPublisher } from "../types";

const API_URL = "https://api.linkedin.com/rest";
const MAX_IMAGES = 20;
const VIDEO_POLLS = 6;
const VIDEO_POLL_MS = 3_000;

export interface LinkedInPublisherOptions {
  /** Version de l'API (AAAAMM), envoyée dans l'en-tête `LinkedIn-Version`. */
  apiVersion: string;
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Connecteur LinkedIn (Posts API) : publication sur le profil personnel du membre connecté,
 * texte seul, une ou plusieurs images, ou une vidéo.
 */
export function createLinkedInPublisher(options: LinkedInPublisherOptions): SocialPublisher {
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const label = SOCIAL_NETWORKS.linkedin.label;
  // 403 : permission manquante (w_member_social) → le compte doit être reconnecté.
  const errors = { authStatuses: [401, 403] };

  const headers = (token: string) => ({
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": options.apiVersion,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  });

  async function uploadImage(author: string, token: string, bytes: Buffer): Promise<string> {
    const init = await publishStep(label, fetchImpl, `${API_URL}/images?action=initializeUpload`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
    }, { finalStep: false, ...errors });
    const value = isRecord(init.body) ? init.body.value : null;
    const uploadUrl = stringField(value, "uploadUrl");
    const image = stringField(value, "image");
    if (!uploadUrl || !image) throw new PublishError(`${label} n'a pas fourni d'adresse d'envoi pour l'image.`, "retryable");
    await publishStep(label, fetchImpl, uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: new Uint8Array(bytes),
    }, { finalStep: false, ...errors });
    return image;
  }

  /** Envoi d'une vidéo en plusieurs parties (Videos API) ; renvoie son URN. */
  async function uploadVideo(author: string, token: string, bytes: Buffer): Promise<string> {
    const init = await publishStep(label, fetchImpl, `${API_URL}/videos?action=initializeUpload`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ initializeUploadRequest: { owner: author, fileSizeBytes: bytes.length, uploadCaptions: false, uploadThumbnail: false } }),
    }, { finalStep: false, ...errors });
    const value = isRecord(init.body) ? init.body.value : null;
    const video = stringField(value, "video");
    const uploadToken = isRecord(value) && typeof value.uploadToken === "string" ? value.uploadToken : "";
    const instructions = isRecord(value) && Array.isArray(value.uploadInstructions) ? value.uploadInstructions : [];
    if (!video || instructions.length === 0) throw new PublishError(`${label} n'a pas fourni d'adresse d'envoi pour la vidéo.`, "retryable");

    const parts: string[] = [];
    for (const instruction of instructions) {
      const url = stringField(instruction, "uploadUrl");
      const first = isRecord(instruction) && typeof instruction.firstByte === "number" ? instruction.firstByte : -1;
      const last = isRecord(instruction) && typeof instruction.lastByte === "number" ? instruction.lastByte : -1;
      if (!url || first < 0 || last < first) throw new PublishError(`${label} a fourni des instructions d'envoi invalides.`, "retryable");
      const response = await publishStep(label, fetchImpl, url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
        body: new Uint8Array(bytes.subarray(first, last + 1)),
      }, { finalStep: false, ...errors });
      const etag = response.headers.get("etag");
      if (!etag) throw new PublishError(`${label} n'a pas confirmé la réception de la vidéo.`, "retryable");
      parts.push(etag);
    }

    await publishStep(label, fetchImpl, `${API_URL}/videos?action=finalizeUpload`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ finalizeUploadRequest: { video, uploadToken, uploadedPartIds: parts } }),
    }, { finalStep: false, ...errors });
    return video;
  }

  /** Attend que LinkedIn ait traité la vidéo ; sinon, l'erreur transporte de quoi reprendre sans la renvoyer. */
  async function waitForVideo(video: string, token: string): Promise<void> {
    for (let i = 0; i < VIDEO_POLLS; i += 1) {
      const response = await publishStep(label, fetchImpl, `${API_URL}/videos/${encodeURIComponent(video)}`, { headers: headers(token) }, { finalStep: false, ...errors });
      const status = stringField(response.body, "status");
      if (status === "AVAILABLE") return;
      if (status === "PROCESSING_FAILED") throw new PublishError(`${label} n'a pas pu traiter la vidéo.`, "permanent");
      await sleep(VIDEO_POLL_MS);
    }
    throw new PublishError(`${label} prépare encore la vidéo : nouvel essai dans quelques minutes.`, "retryable", { linkedinVideo: video });
  }

  return {
    provider: "linkedin",
    async publish({ post, account, accessToken, media, resume }) {
      if (!accessToken) throw new PublishError("Jeton d'accès manquant.", "auth");
      if (media.length > MAX_IMAGES) throw new PublishError(`${label} accepte au plus ${MAX_IMAGES} images.`, "permanent");
      const author = account.externalAccountId;

      let content: Record<string, unknown> | undefined;
      const video = media[0] && isVideo(media[0]) ? media[0] : null;
      if (video) {
        const urn = resume?.linkedinVideo ?? (await uploadVideo(author, accessToken, await video.read()));
        await waitForVideo(urn, accessToken);
        content = { media: { id: urn } };
      } else if (media.length > 0) {
        const images: string[] = [];
        for (const item of media) images.push(await uploadImage(author, accessToken, await item.read()));
        content = images.length === 1 ? { media: { id: images[0] } } : { multiImage: { images: images.map((id) => ({ id })) } };
      }

      const response = await publishStep(label, fetchImpl, `${API_URL}/posts`, {
        method: "POST",
        headers: headers(accessToken),
        body: JSON.stringify({
          author,
          commentary: toLinkedInCommentary(post.text),
          visibility: "PUBLIC",
          distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
          ...(content ? { content } : {}),
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        }),
      }, { finalStep: true, ...errors });

      const postUrn = response.headers.get("x-restli-id") ?? stringField(response.body, "id");
      if (!postUrn) throw new PublishError(`${label} a accepté la publication sans renvoyer son identifiant : vérifiez sur le profil.`, "uncertain");
      return { externalId: postUrn, externalUrl: `https://www.linkedin.com/feed/update/${postUrn}/`, simulated: false };
    },
  };
}

const RESERVED = /[\\|{}@[\]()<>#*_~]/g;
const HASHTAG = /#([\p{L}\p{N}_]+)/gu;

/**
 * Texte au format « little text » de LinkedIn : les caractères réservés sont échappés
 * (sinon la publication est refusée ou tronquée) et les mots-dièse restent cliquables.
 */
export function toLinkedInCommentary(text: string): string {
  const escape = (value: string) => value.replace(RESERVED, (char) => `\\${char}`);
  let result = "";
  let last = 0;
  for (const match of text.matchAll(HASHTAG)) {
    const start = match.index;
    const previous = start > 0 ? text[start - 1] ?? "" : "";
    // « #1 » ou « abc#def » ne sont pas des mots-dièse.
    if (/[\p{L}\p{N}_]/u.test(previous) || /^\d+$/.test(match[1] ?? "")) continue;
    result += escape(text.slice(last, start)) + `{hashtag|\\#|${escape(match[1] ?? "")}}`;
    last = start + match[0].length;
  }
  return result + escape(text.slice(last));
}
