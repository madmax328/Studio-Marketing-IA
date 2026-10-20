import { ensureDatabaseReady, getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { handlePlatformUninstall } from "@/server/services/platform-callbacks";
import { parseSignedRequest } from "@/server/social/signed-request";

/** Rappel « désinstallation » de Threads : l'utilisateur a retiré l'application depuis Threads. */
export async function POST(request: Request): Promise<Response> {
  const secret = getServerEnv().THREADS_APP_SECRET;
  if (!secret) return Response.json({ error: "Threads n'est pas configuré." }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const signed = form?.get("signed_request");
  const parsed = typeof signed === "string" ? parseSignedRequest(signed, secret) : null;
  if (!parsed) return Response.json({ error: "Requête non signée ou invalide." }, { status: 400 });
  await ensureDatabaseReady();
  await handlePlatformUninstall(getDb(), "threads", parsed.userId);
  return Response.json({ ok: true });
}
