import { SOCIAL_NETWORKS } from "@smia/shared";
import { isRecord, publishStep, stringField, type FetchLike } from "@/server/social/http";
import { isVideo, PublishError, type SocialPublisher } from "../types";

const API_URL = "https://api.linkedin.com/rest";
const MAX_IMAGES = 20;

export interface LinkedInPublisherOptions {
  /** Version de l'API (AAAAMM), envoyée dans l'en-tête `LinkedIn-Version`. */
  apiVersion: string;
  fetch?: FetchLike;
}

/**
 * Connecteur LinkedIn (Posts API) : publication sur le profil personnel du membre connecté,
 * texte seul, une image ou plusieurs images.
 */
export function createLinkedInPublisher(options: LinkedInPublisherOptions): SocialPublisher {
  const fetchImpl = options.fetch ?? fetch;
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

  return {
    provider: "linkedin",
    async publish({ post, account, accessToken, media }) {
      if (!accessToken) throw new PublishError("Jeton d'accès manquant.", "auth");
      if (media.some(isVideo)) throw new PublishError(`La publication de vidéos sur ${label} arrive bientôt.`, "permanent");
      if (media.length > MAX_IMAGES) throw new PublishError(`${label} accepte au plus ${MAX_IMAGES} images.`, "permanent");
      const author = account.externalAccountId;

      const images: string[] = [];
      for (const item of media) images.push(await uploadImage(author, accessToken, await item.read()));

      const content =
        images.length === 0
          ? undefined
          : images.length === 1
            ? { media: { id: images[0] } }
            : { multiImage: { images: images.map((id) => ({ id })) } };

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
