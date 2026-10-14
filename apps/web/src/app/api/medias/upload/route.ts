import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES, roleHasPermission } from "@smia/shared";
import { getServerEnv } from "@/server/env";
import { workspaceStoragePrefix } from "@/server/media/storage";
import { getWorkspaceForApi } from "@/server/session";

/**
 * Délivre au navigateur un jeton d'envoi limité à un seul fichier :
 * emplacement dans l'espace de l'utilisateur, types d'image acceptés, 15 Mo maximum.
 * Le fichier n'apparaît dans la médiathèque qu'après vérification par registerUpload.
 */
export async function POST(request: Request): Promise<Response> {
  const env = getServerEnv();
  if (!env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: "Le stockage des médias n'est pas activé." }, { status: 503 });
  }
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      token: env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname) => {
        const access = await getWorkspaceForApi();
        if (!access || !roleHasPermission(access.role, "content:write")) throw new Error("Non autorisé.");
        const prefix = `${workspaceStoragePrefix(access.workspace._id.toHexString())}uploads/`;
        if (!pathname.startsWith(prefix) || pathname.includes("..")) throw new Error("Emplacement non autorisé.");
        return {
          allowedContentTypes: [...ACCEPTED_IMAGE_TYPES],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Envoi refusé." }, { status: 400 });
  }
}
