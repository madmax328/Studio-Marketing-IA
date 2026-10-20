import { timingSafeEqual } from "node:crypto";
import { getMetricsFetchers } from "@/server/analytics";
import { collectDueMetrics } from "@/server/analytics/collector";
import { ensureDatabaseReady, getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { getMediaStorage } from "@/server/media/storage";
import { runProductionPublishingCycle } from "@/server/publishing";
import { purgeOldVoiceovers } from "@/server/services/voiceover";

export const maxDuration = 60;

function authorized(request: Request, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Déclenche un passage de la file d'envoi. À appeler chaque minute par un planificateur
 * (Vercel Cron, cron-job.org…) avec l'en-tête « Authorization: Bearer <CRON_SECRET> ».
 */
async function handler(request: Request): Promise<Response> {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET n'est pas configuré." }, { status: 503 });
  if (!authorized(request, secret)) return Response.json({ error: "Non autorisé." }, { status: 401 });

  await ensureDatabaseReady();
  // 25 s : sous la limite de durée des planificateurs gratuits (cron-job.org coupe à 30 s) ; le reste part au passage suivant.
  const deadline = Date.now() + 25_000;
  const summary = await runProductionPublishingCycle(deadline);
  // Avec le temps restant : relevé des statistiques. Un échec ici ne doit pas masquer le résultat de l'envoi.
  let metrics = null;
  try {
    metrics = await collectDueMetrics(
      { db: getDb(), fetchers: getMetricsFetchers(), encryptionKey: getServerEnv().SOCIAL_TOKEN_ENCRYPTION_KEY },
      { deadline },
    );
  } catch (error) {
    console.error("Relevé des statistiques impossible", error instanceof Error ? error.message : error);
  }
  // Fichiers de voix off temporaires (montage terminé depuis plus d'un jour).
  let voiceoversPurged = 0;
  try {
    if (getMediaStorage().isConfigured()) voiceoversPurged = await purgeOldVoiceovers(getDb(), getMediaStorage());
  } catch (error) {
    console.error("Nettoyage des voix off impossible", error instanceof Error ? error.message : error);
  }
  return Response.json({ ok: true, ...summary, metrics, voiceoversPurged });
}

export { handler as GET, handler as POST };
