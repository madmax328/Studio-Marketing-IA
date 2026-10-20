import { SOCIAL_NETWORKS } from "@smia/shared";
import { form, publishStep, sleep as defaultSleep, stringField, type FetchLike } from "@/server/social/http";
import { isVideo, PublishError, type PublishContext, type PublishMedia, type PublishResult, type SocialPublisher } from "../types";

/** Codes d'erreur Graph API : jeton invalide ou permission manquante → compte à reconnecter. */
export const META_AUTH_CODES = [102, 190, 10, 200] as const;
/** Limites de débit et erreurs temporaires. */
export const META_RETRYABLE_CODES = [1, 2, 4, 17, 32, 341, 613, 80001, 9007] as const;

/** Instagram : formats acceptés (largeur / hauteur) et nombre d'images d'un carrousel. */
const INSTAGRAM_MIN_RATIO = 4 / 5;
const INSTAGRAM_MAX_RATIO = 1.91;
const INSTAGRAM_MAX_CAROUSEL = 10;
/** Attente du traitement des images par Instagram (au-delà, nouvel essai au passage suivant). */
const CONTAINER_POLLS = 8;
const CONTAINER_POLL_MS = 2_000;

export interface MetaPublisherOptions {
  graphVersion: string;
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Connecteur Meta (Graph API) : Pages Facebook et comptes Instagram professionnels liés à une Page.
 * Le jeton utilisé est celui de la Page (il n'expire pas tant que l'autorisation est maintenue).
 */
export function createMetaPublisher(options: MetaPublisherOptions): SocialPublisher {
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const base = `https://graph.facebook.com/${options.graphVersion}`;

  return {
    provider: "meta",
    async publish(context) {
      if (!context.accessToken) throw new PublishError("Jeton d'accès manquant.", "auth");
      if (context.account.network === "facebook") return publishToFacebook(context, context.accessToken);
      if (context.account.network === "instagram") return publishToInstagram(context, context.accessToken);
      throw new PublishError("Ce compte Meta ne correspond pas à ce réseau.", "permanent");
    },
  };

  function post(label: string, path: string, token: string, values: Record<string, string | boolean | undefined>, finalStep: boolean) {
    return publishStep(label, fetchImpl, `${base}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form(values),
    }, { finalStep, authCodes: META_AUTH_CODES, retryableCodes: META_RETRYABLE_CODES });
  }

  function get(label: string, path: string, token: string) {
    return publishStep(label, fetchImpl, `${base}/${path}`, { headers: { Authorization: `Bearer ${token}` } }, {
      finalStep: false,
      authCodes: META_AUTH_CODES,
      retryableCodes: META_RETRYABLE_CODES,
    });
  }

  async function publishToFacebook({ post: content, account, media }: PublishContext, token: string): Promise<PublishResult> {
    const label = SOCIAL_NETWORKS.facebook.label;
    const pageId = account.externalAccountId;
    let postId: string | null;

    if (media.length === 0) {
      const response = await post(label, `${pageId}/feed`, token, { message: content.text }, true);
      postId = stringField(response.body, "id");
    } else if (media[0] && isVideo(media[0])) {
      // Vidéo : Facebook la télécharge depuis le lien signé, puis la traite de son côté.
      const response = await post(label, `${pageId}/videos`, token, { file_url: media[0].publicUrl, description: content.text }, true);
      const videoId = stringField(response.body, "id");
      if (!videoId) throw new PublishError(`${label} a accepté la vidéo sans renvoyer son identifiant : vérifiez sur la Page.`, "uncertain");
      return { externalId: videoId, externalUrl: `https://www.facebook.com/${pageId}/videos/${videoId}`, simulated: false };
    } else if (media.length === 1) {
      const response = await post(label, `${pageId}/photos`, token, { url: media[0]?.publicUrl, caption: content.text }, true);
      postId = stringField(response.body, "post_id") ?? stringField(response.body, "id");
    } else {
      // Plusieurs images : envoi non publié de chaque photo, puis une publication qui les regroupe.
      const attached: Record<string, string> = {};
      for (const [index, item] of media.entries()) {
        const response = await post(label, `${pageId}/photos`, token, { url: item.publicUrl, published: false }, false);
        const photoId = stringField(response.body, "id");
        if (!photoId) throw new PublishError(`${label} n'a pas renvoyé l'identifiant d'une image.`, "retryable");
        attached[`attached_media[${index}]`] = JSON.stringify({ media_fbid: photoId });
      }
      const response = await post(label, `${pageId}/feed`, token, { message: content.text, ...attached }, true);
      postId = stringField(response.body, "id");
    }

    if (!postId) throw new PublishError(`${label} a accepté la publication sans renvoyer son identifiant : vérifiez sur la Page.`, "uncertain");
    return { externalId: postId, externalUrl: `https://www.facebook.com/${postId}`, simulated: false };
  }

  async function publishToInstagram({ post: content, account, media, resume }: PublishContext, token: string): Promise<PublishResult> {
    const label = SOCIAL_NETWORKS.instagram.label;
    const igUserId = account.externalAccountId;
    const video = media.length === 1 && media[0] && isVideo(media[0]) ? media[0] : null;
    const problem = video ? null : instagramMediaProblem(media);
    if (problem) throw new PublishError(problem, "permanent");

    let creationId: string;
    if (video) {
      // Reel : le conteneur peut mettre plusieurs minutes à être prêt ; on le reprend au passage suivant.
      const existing = resume?.instagramContainer;
      const id = existing ?? (await createContainerId(label, igUserId, token, { media_type: "REELS", video_url: video.publicUrl, caption: content.text, share_to_feed: true }));
      creationId = await waitForContainer(label, id, token, "la vidéo", { instagramContainer: id });
    } else if (media.length === 1) {
      creationId = await createContainer(label, igUserId, token, { image_url: jpegUrl(media[0] as PublishMedia), caption: content.text });
    } else {
      const children: string[] = [];
      for (const item of media) {
        children.push(await createContainer(label, igUserId, token, { image_url: jpegUrl(item), is_carousel_item: true }));
      }
      creationId = await createContainer(label, igUserId, token, { media_type: "CAROUSEL", children: children.join(","), caption: content.text });
    }

    const published = await post(label, `${igUserId}/media_publish`, token, { creation_id: creationId }, true);
    const mediaId = stringField(published.body, "id");
    if (!mediaId) throw new PublishError(`${label} a accepté la publication sans renvoyer son identifiant : vérifiez sur le compte.`, "uncertain");

    let permalink: string | null = null;
    try {
      permalink = stringField((await get(label, `${mediaId}?fields=permalink`, token)).body, "permalink");
    } catch {
      // Le lien est un confort : la publication est déjà parue.
    }
    return { externalId: mediaId, externalUrl: permalink, simulated: false };
  }

  async function createContainerId(label: string, igUserId: string, token: string, values: Record<string, string | boolean>): Promise<string> {
    const response = await post(label, `${igUserId}/media`, token, values, false);
    const id = stringField(response.body, "id");
    if (!id) throw new PublishError(`${label} n'a pas renvoyé d'identifiant de média.`, "retryable");
    return id;
  }

  /**
   * Attend qu'Instagram ait fini de préparer un conteneur. S'il n'est pas prêt à temps, l'erreur temporaire
   * transporte de quoi le reprendre (`resume`) au lieu d'en créer un nouveau.
   */
  async function waitForContainer(label: string, id: string, token: string, what: string, resume?: Record<string, string>): Promise<string> {
    for (let i = 0; i < CONTAINER_POLLS; i += 1) {
      const status = stringField((await get(label, `${id}?fields=status_code`, token)).body, "status_code");
      if (status === "FINISHED") return id;
      if (status === "ERROR" || status === "EXPIRED") {
        throw new PublishError(`${label} n'a pas pu traiter ${what} (format ou dimensions non acceptés).`, "permanent");
      }
      await sleep(CONTAINER_POLL_MS);
    }
    throw new PublishError(`${label} prépare encore ${what} : nouvel essai dans quelques minutes.`, "retryable", resume);
  }

  /** Crée un conteneur Instagram et attend qu'Instagram ait fini de télécharger l'image. */
  async function createContainer(label: string, igUserId: string, token: string, values: Record<string, string | boolean>): Promise<string> {
    return waitForContainer(label, await createContainerId(label, igUserId, token, values), token, "l'image");
  }
}

/** Instagram n'accepte que le JPEG : le lien signé demande une conversion à la volée. */
function jpegUrl(media: PublishMedia): string {
  return media.mimeType === "image/jpeg" ? media.publicUrl : `${media.publicUrl}&format=jpeg`;
}

/** Contraintes connues d'Instagram sur les images (vérifiées avant tout envoi). */
export function instagramMediaProblem(media: readonly Pick<PublishMedia, "width" | "height">[]): string | null {
  if (media.length === 0) return "Instagram exige une image.";
  if (media.length > INSTAGRAM_MAX_CAROUSEL) return `Instagram accepte au plus ${INSTAGRAM_MAX_CAROUSEL} images par publication.`;
  for (const item of media) {
    const ratio = item.width / item.height;
    if (ratio < INSTAGRAM_MIN_RATIO - 0.01 || ratio > INSTAGRAM_MAX_RATIO + 0.01) {
      return `Instagram refuse les images de ${item.width} × ${item.height} : le format doit aller de 4:5 (portrait) à 1,91:1 (paysage). Utilisez un visuel carré, portrait 4:5 ou paysage.`;
    }
  }
  return null;
}
