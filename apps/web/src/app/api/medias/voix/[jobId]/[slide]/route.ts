import { getDb } from "@/server/db/client";
import { getMediaStorage } from "@/server/media/storage";
import { UserFacingError } from "@/server/services/errors";
import { getVoiceoverClip } from "@/server/services/voiceover";
import { getWorkspaceForApi } from "@/server/session";

/** Sert la voix off d'une diapositive au montage, uniquement aux membres de l'espace qui l'a créée. */
export async function GET(_request: Request, context: RouteContext<"/api/medias/voix/[jobId]/[slide]">): Promise<Response> {
  const access = await getWorkspaceForApi();
  if (!access) return new Response("Non connecté.", { status: 401 });
  const { jobId, slide } = await context.params;
  try {
    const clip = await getVoiceoverClip(getDb(), access, jobId, Number(slide));
    const file = await getMediaStorage().read(clip.storageKey);
    if (!file) return new Response("Fichier introuvable.", { status: 404 });
    return new Response(file.stream, {
      headers: {
        "Content-Type": "audio/mpeg",
        ...(file.size ? { "Content-Length": String(file.size) } : {}),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof UserFacingError && error.code === "not_found") return new Response("Introuvable.", { status: 404 });
    throw error;
  }
}
