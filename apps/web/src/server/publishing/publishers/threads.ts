import { SOCIAL_NETWORKS } from "@smia/shared";
import { form, publishStep, sleep as defaultSleep, stringField, type FetchLike } from "@/server/social/http";
import { PublishError, type PublishMedia, type SocialPublisher } from "../types";
import { META_AUTH_CODES, META_RETRYABLE_CODES } from "./meta";

export const THREADS_GRAPH_URL = "https://graph.threads.net/v1.0";
const THREADS_MAX_CAROUSEL = 20;
const CONTAINER_POLLS = 8;
const CONTAINER_POLL_MS = 2_000;

export interface ThreadsPublisherOptions {
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

/** Connecteur Threads (Threads API de Meta) : texte, image ou carrousel. */
export function createThreadsPublisher(options: ThreadsPublisherOptions = {}): SocialPublisher {
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const label = SOCIAL_NETWORKS.threads.label;
  const errors = { authCodes: META_AUTH_CODES, retryableCodes: META_RETRYABLE_CODES };

  const post = (path: string, token: string, values: Record<string, string | boolean | undefined>, finalStep: boolean) =>
    publishStep(label, fetchImpl, `${THREADS_GRAPH_URL}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form(values),
    }, { finalStep, ...errors });

  const get = (path: string, token: string) =>
    publishStep(label, fetchImpl, `${THREADS_GRAPH_URL}/${path}`, { headers: { Authorization: `Bearer ${token}` } }, { finalStep: false, ...errors });

  async function createContainer(userId: string, token: string, values: Record<string, string | boolean | undefined>): Promise<string> {
    const id = stringField((await post(`${userId}/threads`, token, values, false)).body, "id");
    if (!id) throw new PublishError(`${label} n'a pas renvoyé d'identifiant de contenu.`, "retryable");
    for (let i = 0; i < CONTAINER_POLLS; i += 1) {
      const body = (await get(`${id}?fields=status,error_message`, token)).body;
      const status = stringField(body, "status");
      if (status === "FINISHED") return id;
      if (status === "ERROR" || status === "EXPIRED") {
        const detail = stringField(body, "error_message");
        throw new PublishError(`${label} n'a pas pu préparer la publication${detail ? ` (${detail})` : ""}.`, "permanent");
      }
      await sleep(CONTAINER_POLL_MS);
    }
    throw new PublishError(`${label} prépare encore la publication.`, "retryable");
  }

  return {
    provider: "threads",
    async publish({ post: content, account, accessToken, media }) {
      if (!accessToken) throw new PublishError("Jeton d'accès manquant.", "auth");
      if (media.length > THREADS_MAX_CAROUSEL) throw new PublishError(`${label} accepte au plus ${THREADS_MAX_CAROUSEL} images.`, "permanent");
      const userId = account.externalAccountId;

      let creationId: string;
      if (media.length === 0) {
        creationId = await createContainer(userId, accessToken, { media_type: "TEXT", text: content.text });
      } else if (media.length === 1) {
        creationId = await createContainer(userId, accessToken, { media_type: "IMAGE", image_url: imageUrl(media[0] as PublishMedia), text: content.text });
      } else {
        const children: string[] = [];
        for (const item of media) {
          children.push(await createContainer(userId, accessToken, { media_type: "IMAGE", image_url: imageUrl(item), is_carousel_item: true }));
        }
        creationId = await createContainer(userId, accessToken, { media_type: "CAROUSEL", children: children.join(","), text: content.text });
      }

      const published = await post(`${userId}/threads_publish`, accessToken, { creation_id: creationId }, true);
      const threadId = stringField(published.body, "id");
      if (!threadId) throw new PublishError(`${label} a accepté la publication sans renvoyer son identifiant : vérifiez sur le compte.`, "uncertain");

      let permalink: string | null = null;
      try {
        permalink = stringField((await get(`${threadId}?fields=permalink`, accessToken)).body, "permalink");
      } catch {
        // Le lien est un confort : la publication est déjà parue.
      }
      return { externalId: threadId, externalUrl: permalink, simulated: false };
    },
  };
}

/** Threads accepte JPEG et PNG : les autres formats sont convertis en JPEG par le lien signé. */
function imageUrl(media: PublishMedia): string {
  return media.mimeType === "image/jpeg" || media.mimeType === "image/png" ? media.publicUrl : `${media.publicUrl}&format=jpeg`;
}
