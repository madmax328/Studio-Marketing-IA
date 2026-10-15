import "server-only";
import { getDb } from "@/server/db/client";
import { sendEmail } from "@/server/email";
import { getServerEnv } from "@/server/env";
import { signedMediaUrl } from "@/server/media/signed-urls";
import { getMediaStorage } from "@/server/media/storage";
import { createNotifier } from "@/server/services/notifications";
import { loadPostMedia, runPublishingCycle, type CycleSummary } from "./dispatcher";
import { simulationPublisher } from "./publishers/simulation";
import type { SocialPublisher } from "./types";

/** Connecteurs disponibles. Les connecteurs réels s'ajoutent ici une fois écrits. */
export function getPublishers(): Partial<Record<SocialPublisher["provider"], SocialPublisher>> {
  return { simulation: simulationPublisher };
}

/** Un passage de la file d'envoi avec les dépendances de production. */
export async function runProductionPublishingCycle(deadline: number): Promise<CycleSummary> {
  const env = getServerEnv();
  const db = getDb();
  const storage = getMediaStorage();
  return runPublishingCycle(
    {
      db,
      publishers: getPublishers(),
      notifier: createNotifier(db, sendEmail, env.APP_URL),
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
