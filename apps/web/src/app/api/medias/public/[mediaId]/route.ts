import { ObjectId } from "mongodb";
import { ensureDatabaseReady, getDb } from "@/server/db/client";
import { collections } from "@/server/db/collections";
import { getServerEnv } from "@/server/env";
import { verifySignedMedia } from "@/server/media/signed-urls";
import { toJpeg } from "@/server/media/images";
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
  if (!media) return new Response("Introuvable.", { status: 404 });
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

  // Certains réseaux (Instagram) n'acceptent que le JPEG : conversion à la demande.
  if (url.searchParams.get("format") === "jpeg" && media.kind !== "video" && media.mimeType !== "image/jpeg") {
    const bytes = await getMediaStorage().readBuffer(media.storageKey);
    if (!bytes) return new Response("Introuvable.", { status: 404 });
    return new Response(new Uint8Array(await toJpeg(bytes)), { headers: { ...headers, "Content-Type": "image/jpeg" } });
  }

  const file = await getMediaStorage().read(media.storageKey);
  if (!file) return new Response("Introuvable.", { status: 404 });
  // La taille annoncée aide les réseaux qui téléchargent les vidéos.
  return new Response(file.stream, {
    headers: { ...headers, "Content-Type": media.mimeType, ...(file.size ? { "Content-Length": String(file.size) } : {}) },
  });
}
