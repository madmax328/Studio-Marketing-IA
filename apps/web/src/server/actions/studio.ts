"use server";

import { revalidatePath } from "next/cache";
import { getImageProvider, getSpeechProvider, getTextProvider, getVideoProvider } from "@/server/ai";
import { getDb } from "@/server/db/client";
import { UserFacingError } from "@/server/services/errors";
import { acceptAiConsent, generateTextPosts, type GenerationView } from "@/server/services/generation";
import { createDraft } from "@/server/services/posts";
import { completeLocalGeneration, prepareLocalGeneration, type LocalGenerationRequest } from "@/server/services/local-generation";
import { requireWorkspace } from "@/server/session";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: UserFacingError["code"] };

export async function acceptAiConsentAction(kind: "text" | "image" | "voice" | "video" = "text"): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    const provider =
      kind === "image" ? getImageProvider() : kind === "voice" ? getSpeechProvider() : kind === "video" ? getVideoProvider() : getTextProvider();
    await acceptAiConsent(getDb(), access, access.userId, provider);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/studio");
  revalidatePath("/medias");
  revalidatePath("/medias/video");
  return { ok: true, data: null };
}

export async function generatePostsAction(input: unknown): Promise<ActionResult<GenerationView>> {
  const access = await requireWorkspace();
  try {
    const view = await generateTextPosts(getDb(), access, access.userId, input, getTextProvider());
    revalidatePath("/studio");
    return { ok: true, data: view };
  } catch (error) {
    return failure(error);
  }
}

/** IA locale (application de bureau) : consignes à transmettre au modèle de l'ordinateur. */
export async function prepareLocalGenerationAction(input: unknown): Promise<ActionResult<LocalGenerationRequest>> {
  const access = await requireWorkspace();
  try {
    return { ok: true, data: await prepareLocalGeneration(getDb(), access, access.userId, input) };
  } catch (error) {
    return failure(error);
  }
}

/** IA locale : réponse du modèle de l'ordinateur, validée comme une réponse du cloud. */
export async function completeLocalGenerationAction(params: { jobId: string; output: string; model: string }): Promise<ActionResult<GenerationView>> {
  const access = await requireWorkspace();
  try {
    return { ok: true, data: await completeLocalGeneration(getDb(), access, access.userId, params) };
  } catch (error) {
    return failure(error);
  }
}

export async function saveDraftAction(input: unknown): Promise<ActionResult<{ postId: string }>> {
  const access = await requireWorkspace();
  try {
    const post = await createDraft(getDb(), access, access.userId, input);
    revalidatePath("/publications");
    revalidatePath("/tableau-de-bord");
    return { ok: true, data: { postId: post._id.toHexString() } };
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown): { ok: false; error: string; code?: UserFacingError["code"] } {
  if (error instanceof UserFacingError) return { ok: false, error: error.message, code: error.code };
  console.error("Erreur du studio", error);
  return { ok: false, error: "Une erreur est survenue. Réessayez dans un instant." };
}
