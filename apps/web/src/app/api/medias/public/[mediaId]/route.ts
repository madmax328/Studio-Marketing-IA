import { ObjectId } from "mongodb";
import { ensureDatabaseReady, getDb } from "@/server/db/client";
import { collections } from "@/server/db/collections";
import { getServerEnv } from "@/server/env";
import { verifySignedMedia } from "@/server/media/signed-urls";
import { getMediaStorage } from "@/server/media/storage";

/**
 * Accès temporaire à un média par lien signé, sans session : utilisé par les réseaux sociaux
 * qui téléchargent eux-mêmes l'image à publier. Le lien expire au bout de deux heures.
 */
export async function GET(request: Request, context: RouteContext<"/api/medias/public/[mediaId]">): Promise<Response> {
  const { mediaId } = await context.params;
  const url = new URL(request.url);
  if (!ObjectId.isValid(mediaId) || !verifySignedMedia(getServerEnv().AUTH_SECRET, mediaId, url.searchParams.get("exp"), url.searchParams.get("sig"))) {
    return new Response("Lien invalide ou expiré.", { status: 403 });
  }
  await ensureDatabaseReady();
  const media = await collections(getDb()).mediaAssets.findOne({ _id: new ObjectId(mediaId) });
  const file = media ? await getMediaStorage().read(media.storageKey) : null;
  if (!media || !file) return new Response("Introuvable.", { status: 404 });
  return new Response(file.stream, {
    headers: { "Content-Type": media.mimeType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
