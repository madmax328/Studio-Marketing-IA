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
}

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
