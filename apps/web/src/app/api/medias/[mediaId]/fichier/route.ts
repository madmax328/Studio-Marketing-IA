import { getDb } from "@/server/db/client";
import { getMediaStorage } from "@/server/media/storage";
import { UserFacingError } from "@/server/services/errors";
import { getMedia } from "@/server/services/media";
import { getWorkspaceForApi } from "@/server/session";

/** Sert un fichier de la médiathèque, uniquement aux membres de l'espace propriétaire. */
export async function GET(_request: Request, context: RouteContext<"/api/medias/[mediaId]/fichier">): Promise<Response> {
  const access = await getWorkspaceForApi();
  if (!access) return new Response("Non connecté.", { status: 401 });
  const { mediaId } = await context.params;

  try {
    const media = await getMedia(getDb(), access, mediaId);
    const file = await getMediaStorage().read(media.storageKey);
    if (!file) return new Response("Fichier introuvable.", { status: 404 });
    return new Response(file.stream, {
      headers: {
        "Content-Type": media.mimeType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof UserFacingError && error.code === "not_found") return new Response("Introuvable.", { status: 404 });
    throw error;
  }
}
