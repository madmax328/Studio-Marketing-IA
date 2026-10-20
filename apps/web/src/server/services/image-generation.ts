import { randomUUID } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { IMAGE_FORMATS, imageGenerationRequestSchema } from "@smia/shared";
import { buildImagePrompt, orientationFor } from "@/server/ai/image-prompt";
import { TextGenerationError, type ImageGenerationProvider } from "@/server/ai/types";
import { collections, type MediaAssetDoc } from "@/server/db/collections";
import { fitToFormat, inspectImage } from "@/server/media/images";
import { workspaceStoragePrefix, type MediaStorage } from "@/server/media/storage";
import { recordAudit } from "@/server/services/audit";
import { getBrand } from "@/server/services/brands";
import { UserFacingError } from "@/server/services/errors";
import { runAiJob } from "@/server/services/generation";
import { assertPermission } from "@/server/services/permissions";
import type { WorkspaceAccess } from "@/server/services/workspaces";

/**
 * Crée une image par IA et l'ajoute à la médiathèque. Mêmes garde-fous que le texte : accord, crédits débités
 * puis remboursés en cas d'échec, une seule exécution par demande. L'image est recadrée au format choisi.
 */
export async function generateAiImage(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  input: unknown,
  provider: ImageGenerationProvider,
  storage: MediaStorage,
): Promise<{ mediaId: string }> {
  assertPermission(access, "content:write");
  if (!storage.isConfigured()) throw new UserFacingError("Le stockage des images n'est pas encore activé.", "unavailable");
  const parsed = imageGenerationRequestSchema.safeParse(input);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Demande invalide.", "invalid_input");
  const request = parsed.data;
  const brand = await getBrand(db, access, request.brandId);
  const format = IMAGE_FORMATS[request.format];

  const { output } = await runAiJob<{ mediaId: string }>(
    db,
    access,
    userId,
    provider,
    {
      requestId: request.requestId,
      kind: "image",
      operation: "image_generation",
      brandId: brand._id,
      request: { description: request.description, format: request.format, style: request.style },
    },
    async () => {
      const result = await provider.generateImage({ prompt: buildImagePrompt(brand, request), orientation: orientationFor(request.format) });
      if (!(await inspectImage(result.output))) throw new TextGenerationError("L'image reçue est illisible. Réessayez.", true);
      const jpeg = await fitToFormat(result.output, format.width, format.height);

      const storageKey = `${workspaceStoragePrefix(access.workspace._id.toHexString())}ia/${randomUUID()}.jpg`;
      await storage.put(storageKey, jpeg, "image/jpeg");
      const now = new Date();
      const media: MediaAssetDoc = {
        _id: new ObjectId(),
        workspaceId: access.workspace._id,
        brandId: brand._id,
        createdByUserId: userId,
        kind: "image",
        source: "ai",
        name: request.description.slice(0, 120),
        mimeType: "image/jpeg",
        size: jpeg.length,
        width: format.width,
        height: format.height,
        storageKey,
        status: "ready",
        createdAt: now,
        updatedAt: now,
      };
      await collections(db).mediaAssets.insertOne(media);
      await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "media.ai_generated", targetId: media._id.toHexString() });
      return { output: { mediaId: media._id.toHexString() }, model: result.model, usage: result.usage };
    },
  );
  return output;
}
