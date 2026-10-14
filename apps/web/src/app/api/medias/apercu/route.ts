import { getDb } from "@/server/db/client";
import { getMediaStorage } from "@/server/media/storage";
import { UserFacingError } from "@/server/services/errors";
import { renderTemplate } from "@/server/services/media";
import { getWorkspaceForApi } from "@/server/session";

/** Aperçu d'un visuel avant enregistrement (rien n'est stocké). */
export async function GET(request: Request): Promise<Response> {
  const access = await getWorkspaceForApi();
  if (!access) return new Response("Non connecté.", { status: 401 });
  const params = Object.fromEntries(new URL(request.url).searchParams);

  try {
    const { jpeg } = await renderTemplate(getDb(), access, getMediaStorage(), {
      ...params,
      showLogo: params.showLogo === "true",
      backgroundMediaId: params.backgroundMediaId || undefined,
      color: params.color || undefined,
    });
    return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UserFacingError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
