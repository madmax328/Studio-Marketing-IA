import "server-only";
import { getDb } from "@/server/db/client";
import { sendEmail } from "@/server/email";
import { getServerEnv } from "@/server/env";
import { signedMediaUrl } from "@/server/media/signed-urls";
import { getMediaStorage } from "@/server/media/storage";
import { createNotifier } from "@/server/services/notifications";
import { loadPostMedia, runPublishingCycle, type CycleSummary } from "./dispatcher";
import { getOAuthProvider } from "@/server/social";
import { refreshThreadsToken, REFRESHABLE_PROVIDERS, type OAuthProvider } from "@/server/social/oauth";
import type { OAuthProviderId } from "@/server/db/collections";
import { createGoogleBusinessPublisher } from "./publishers/google-business";
import { createPinterestPublisher } from "./publishers/pinterest";
import { createTikTokPublisher } from "./publishers/tiktok";
import { createXPublisher } from "./publishers/x";
import { createYouTubePublisher } from "./publishers/youtube";
import { createLinkedInPublisher } from "./publishers/linkedin";
import { createMetaPublisher } from "./publishers/meta";
import { simulationPublisher } from "./publishers/simulation";
import { createThreadsPublisher } from "./publishers/threads";
import { maintainSocialTokens } from "./tokens";
import type { SocialPublisher } from "./types";

/** Connecteurs de publication. Un compte n'existe que si son réseau a été configuré et autorisé. */
export function getPublishers(): Partial<Record<SocialPublisher["provider"], SocialPublisher>> {
  const env = getServerEnv();
  return {
    simulation: simulationPublisher,
    meta: createMetaPublisher({ graphVersion: env.META_GRAPH_VERSION }),
    threads: createThreadsPublisher(),
    linkedin: createLinkedInPublisher({ apiVersion: env.LINKEDIN_API_VERSION }),
    tiktok: createTikTokPublisher(),
    youtube: createYouTubePublisher(),
    pinterest: createPinterestPublisher(),
    x: createXPublisher(),
    google_business: createGoogleBusinessPublisher(),
  };
}

/** Fournisseurs à jetons courts, renouvelés par le planificateur (seulement ceux configurés). */
function tokenRefreshers(): Partial<Record<OAuthProviderId, (refreshToken: string, now: Date) => ReturnType<NonNullable<OAuthProvider["refresh"]>>>> {
  const refreshers: Partial<Record<OAuthProviderId, (refreshToken: string, now: Date) => ReturnType<NonNullable<OAuthProvider["refresh"]>>>> = {};
  for (const id of REFRESHABLE_PROVIDERS) {
    const provider = getOAuthProvider(id);
    if (provider?.refresh) refreshers[id] = provider.refresh.bind(provider);
  }
  return refreshers;
}

/** Un passage de la file d'envoi avec les dépendances de production. */
export async function runProductionPublishingCycle(deadline: number): Promise<CycleSummary> {
  const env = getServerEnv();
  const db = getDb();
  const storage = getMediaStorage();
  const notifier = createNotifier(db, sendEmail, env.APP_URL);
  try {
    await maintainSocialTokens({
      db,
      encryptionKey: env.SOCIAL_TOKEN_ENCRYPTION_KEY,
      notifier,
      refreshThreads: (token, now) => refreshThreadsToken(fetch, token, now),
      refreshers: tokenRefreshers(),
    });
  } catch (error) {
    // L'entretien des autorisations ne doit jamais bloquer l'envoi des publications.
    console.error("Entretien des autorisations impossible", error instanceof Error ? error.message : error);
  }
  return runPublishingCycle(
    {
      db,
      publishers: getPublishers(),
      notifier,
      encryptionKey: env.SOCIAL_TOKEN_ENCRYPTION_KEY,
      mediaFor: (post) =>
        loadPostMedia(db, post, {
          signedUrl: (mediaId) => signedMediaUrl(env.APP_URL, env.AUTH_SECRET, mediaId),
          read: (key) => storage.readBuffer(key),
        }),
    },
    { deadline },
  );
}
