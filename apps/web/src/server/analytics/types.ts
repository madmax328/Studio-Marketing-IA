import type { PostMetrics } from "@smia/shared";
import type { PostDoc, SocialAccountDoc } from "@/server/db/collections";

export interface MetricsContext {
  post: PostDoc;
  account: SocialAccountDoc;
  /** Jeton déchiffré. Ne jamais le journaliser. */
  accessToken: string;
  /** Identifiant de la publication chez le réseau. */
  externalId: string;
}

/**
 * Échec d'un relevé :
 * - retryable : erreur passagère, on réessaiera au prochain relevé prévu ;
 * - unsupported : le réseau ne fournit pas ces chiffres (permission absente, type de compte) ;
 * - gone : la publication n'existe plus sur le réseau.
 */
export class MetricsError extends Error {
  constructor(
    message: string,
    readonly kind: "retryable" | "unsupported" | "gone",
  ) {
    super(message);
    this.name = "MetricsError";
  }
}

/** Récupère les chiffres d'une publication pour un fournisseur. */
export interface MetricsFetcher {
  provider: SocialAccountDoc["provider"];
  fetch(context: MetricsContext): Promise<PostMetrics>;
}
