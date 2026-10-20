import "server-only";
import type { OAuthProviderId } from "@/server/db/collections";
import { getServerEnv } from "@/server/env";
import { createLinkedInOAuth, createMetaOAuth, createThreadsOAuth, type OAuthProvider } from "./oauth";
import { createGoogleBusinessOAuth, createYouTubeOAuth } from "./oauth-google";
import { createPinterestOAuth } from "./oauth-pinterest";
import { createTikTokOAuth } from "./oauth-tiktok";
import { createXOAuth } from "./oauth-x";

/**
 * Fournisseur de connexion, ou null s'il n'est pas configuré sur cette installation
 * (identifiants d'application absents, ou clé de chiffrement des jetons manquante).
 */
export function getOAuthProvider(id: OAuthProviderId): OAuthProvider | null {
  const env = getServerEnv();
  if (!env.SOCIAL_TOKEN_ENCRYPTION_KEY) return null;
  switch (id) {
    case "meta":
      return env.META_APP_ID && env.META_APP_SECRET
        ? createMetaOAuth({ appId: env.META_APP_ID, appSecret: env.META_APP_SECRET, graphVersion: env.META_GRAPH_VERSION })
        : null;
    case "threads":
      return env.THREADS_APP_ID && env.THREADS_APP_SECRET
        ? createThreadsOAuth({ appId: env.THREADS_APP_ID, appSecret: env.THREADS_APP_SECRET })
        : null;
    case "linkedin":
      return env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET
        ? createLinkedInOAuth({ clientId: env.LINKEDIN_CLIENT_ID, clientSecret: env.LINKEDIN_CLIENT_SECRET })
        : null;
    case "tiktok":
      return env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET
        ? createTikTokOAuth({ clientKey: env.TIKTOK_CLIENT_KEY, clientSecret: env.TIKTOK_CLIENT_SECRET })
        : null;
    case "youtube":
      return env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? createYouTubeOAuth({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET })
        : null;
    case "google_business":
      return env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? createGoogleBusinessOAuth({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET })
        : null;
    case "pinterest":
      return env.PINTEREST_APP_ID && env.PINTEREST_APP_SECRET
        ? createPinterestOAuth({ appId: env.PINTEREST_APP_ID, appSecret: env.PINTEREST_APP_SECRET })
        : null;
    case "x":
      return env.X_CLIENT_ID && env.X_CLIENT_SECRET ? createXOAuth({ clientId: env.X_CLIENT_ID, clientSecret: env.X_CLIENT_SECRET }) : null;
  }
}

/** Adresse de retour à déclarer dans l'application de chaque réseau. */
export function oauthRedirectUri(appUrl: string, id: OAuthProviderId): string {
  return `${appUrl.replace(/\/$/, "")}/api/reseaux/retour/${id}`;
}
