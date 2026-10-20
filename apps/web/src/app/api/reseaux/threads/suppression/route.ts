import { ensureDatabaseReady, getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { handlePlatformDeletion } from "@/server/services/platform-callbacks";
import { parseSignedRequest } from "@/server/social/signed-request";

/**
 * Rappel « suppression des données » de Threads. Réponse attendue par Meta :
 * une adresse où suivre la demande et un code de confirmation.
 */
export async function POST(request: Request): Promise<Response> {
  const env = getServerEnv();
  if (!env.THREADS_APP_SECRET) return Response.json({ error: "Threads n'est pas configuré." }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const signed = form?.get("signed_request");
  const parsed = typeof signed === "string" ? parseSignedRequest(signed, env.THREADS_APP_SECRET) : null;
  if (!parsed) return Response.json({ error: "Requête non signée ou invalide." }, { status: 400 });
  await ensureDatabaseReady();
  const { confirmationCode } = await handlePlatformDeletion(getDb(), "threads", parsed.userId);
  return Response.json({
    url: `${env.APP_URL.replace(/\/$/, "")}/suppression-des-donnees?demande=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}
