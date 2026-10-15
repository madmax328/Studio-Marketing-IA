import { timingSafeEqual } from "node:crypto";
import { ensureDatabaseReady } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { runProductionPublishingCycle } from "@/server/publishing";

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
  const summary = await runProductionPublishingCycle(Date.now() + 25_000);
  return Response.json({ ok: true, ...summary });
}

export { handler as GET, handler as POST };
