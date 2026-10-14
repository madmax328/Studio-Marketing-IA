"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db/client";
import { getMediaStorage } from "@/server/media/storage";
import { UserFacingError } from "@/server/services/errors";
import { createTemplateMedia, deleteMedia, registerUpload, setBrandLogo, uploadKeyFor } from "@/server/services/media";
import { setPostMedia } from "@/server/services/posts";
import { requireWorkspace } from "@/server/session";
import type { ActionResult } from "@/server/actions/studio";

export async function prepareUploadAction(fileName: string): Promise<ActionResult<{ storageKey: string }>> {
  const access = await requireWorkspace();
  if (!getMediaStorage().isConfigured()) {
    return { ok: false, error: "Le stockage des médias n'est pas encore activé sur cette installation." };
  }
  return { ok: true, data: { storageKey: uploadKeyFor(access, String(fileName)) } };
}

export async function registerUploadAction(input: {
  storageKey: string;
  name: string;
  brandId?: string;
}): Promise<ActionResult<{ mediaId: string }>> {
  const access = await requireWorkspace();
  try {
    const media = await registerUpload(getDb(), access, access.userId, getMediaStorage(), input);
    revalidatePath("/medias");
    return { ok: true, data: { mediaId: media._id.toHexString() } };
  } catch (error) {
    return failure(error);
  }
}

export async function createTemplateMediaAction(input: unknown): Promise<ActionResult<{ mediaId: string }>> {
  const access = await requireWorkspace();
  try {
    const media = await createTemplateMedia(getDb(), access, access.userId, getMediaStorage(), input);
    revalidatePath("/medias");
    return { ok: true, data: { mediaId: media._id.toHexString() } };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteMediaAction(mediaId: string): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    await deleteMedia(getDb(), access, access.userId, getMediaStorage(), mediaId);
    revalidatePath("/medias");
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function setBrandLogoAction(brandId: string, mediaId: string | null): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    await setBrandLogo(getDb(), access, brandId, mediaId);
    revalidatePath(`/ma-marque/${brandId}`);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function setPostMediaAction(postId: string, mediaIds: string[]): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    await setPostMedia(getDb(), access, postId, mediaIds);
    revalidatePath(`/publications/${postId}`);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof UserFacingError) return { ok: false, error: error.message };
  console.error("Erreur médiathèque", error);
  return { ok: false, error: "L'opération a échoué. Réessayez dans un instant." };
}
