import { timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/server/env";
import { readinessReport } from "@/server/readiness";

/**
 * État de l'installation avant l'ouverture (« tout est-il prêt ? »). Protégé par CRON_SECRET,
 * comme le planificateur : `Authorization: Bearer <CRON_SECRET>`. Ne révèle jamais de secret.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET n'est pas configuré." }, { status: 503 });
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return Response.json({ error: "Non autorisé." }, { status: 401 });
  return Response.json(await readinessReport(), { headers: { "Cache-Control": "no-store" } });
}
