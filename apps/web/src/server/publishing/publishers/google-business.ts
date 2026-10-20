import { SOCIAL_NETWORKS } from "@smia/shared";
import { publishStep, stringField, type FetchLike } from "@/server/social/http";
import { isVideo, PublishError, type SocialPublisher } from "../types";

const API_URL = "https://mybusiness.googleapis.com/v4";

export interface GoogleBusinessPublisherOptions {
  fetch?: FetchLike;
}

/**
 * Connecteur Google Business Profile : « Nouveauté » sur la fiche de l'établissement, avec une photo facultative
 * (récupérée par Google via un lien signé). Google refuse les numéros de téléphone dans le texte.
 */
export function createGoogleBusinessPublisher(options: GoogleBusinessPublisherOptions = {}): SocialPublisher {
  const fetchImpl = options.fetch ?? fetch;
  const label = SOCIAL_NETWORKS.google_business.label;

  return {
    provider: "google_business",
    async publish({ post, account, accessToken, media }) {
      if (!accessToken) throw new PublishError("Jeton d'accès manquant.", "auth");
      if (media.some(isVideo)) throw new PublishError(`${label} n'accepte pas les vidéos dans les publications.`, "permanent");
      if (media.length > 1) throw new PublishError(`${label} accepte une seule photo par publication.`, "permanent");
      const photo = media[0];

      const created = (
        await publishStep(label, fetchImpl, `${API_URL}/${account.externalAccountId}/localPosts`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            languageCode: "fr",
            summary: post.text.slice(0, 1500),
            topicType: "STANDARD",
            ...(photo
              ? { media: [{ mediaFormat: "PHOTO", sourceUrl: photo.mimeType === "image/jpeg" || photo.mimeType === "image/png" ? photo.publicUrl : `${photo.publicUrl}&format=jpeg` }] }
              : {}),
          }),
        }, { finalStep: true, authStatuses: [401, 403] })
      ).body;
      const name = stringField(created, "name");
      if (!name) throw new PublishError(`${label} a accepté la publication sans renvoyer son identifiant : vérifiez sur la fiche.`, "uncertain");
      return { externalId: name, externalUrl: stringField(created, "searchUrl"), simulated: false };
    },
  };
}
