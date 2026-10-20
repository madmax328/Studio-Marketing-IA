import type { PostDoc, SocialAccountDoc } from "@/server/db/collections";

export interface PublishMedia {
  mediaId: string;
  mimeType: string;
  width: number;
  height: number;
  /** Lien temporaire signé, lisible par les serveurs du réseau (nécessaire pour Instagram par exemple). */
  publicUrl: string;
  read(): Promise<Buffer>;
}

export interface PublishContext {
  post: PostDoc;
  account: SocialAccountDoc;
  /** Jeton déchiffré ; null pour la simulation. Ne jamais le journaliser. */
  accessToken: string | null;
  media: PublishMedia[];
  /**
   * État laissé par une tentative précédente (ex. conteneur de vidéo encore en traitement chez le réseau),
   * pour reprendre l'envoi au lieu de le recommencer.
   */
  resume: Record<string, string> | null;
}

export const isVideo = (media: Pick<PublishMedia, "mimeType">) => media.mimeType.startsWith("video/");

export interface PublishResult {
  externalId: string;
  externalUrl: string | null;
  simulated: boolean;
}

/**
 * Nature d'un échec, qui décide de la suite :
 * - retryable : erreur temporaire (réseau indisponible, limite de débit) → nouvelle tentative plus tard ;
 * - permanent : contenu refusé, format non accepté → échec définitif ;
 * - auth : jeton expiré ou révoqué → compte à reconnecter, échec définitif ;
 * - uncertain : on ne sait pas si la publication est partie → pas de nouvel essai automatique (évite les doublons).
 */
export type PublishErrorKind = "retryable" | "permanent" | "auth" | "uncertain";

export class PublishError extends Error {
  constructor(
    message: string,
    readonly kind: PublishErrorKind,
    /** Pour une erreur temporaire : de quoi reprendre l'envoi à la tentative suivante. */
    readonly resume?: Record<string, string>,
  ) {
    super(message);
    this.name = "PublishError";
  }
}

/** Connecteur de publication pour un fournisseur (Meta, LinkedIn, simulation…). */
export interface SocialPublisher {
  provider: SocialAccountDoc["provider"];
  publish(context: PublishContext): Promise<PublishResult>;
}
