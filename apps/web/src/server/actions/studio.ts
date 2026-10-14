"use server";

import { revalidatePath } from "next/cache";
import { getTextProvider } from "@/server/ai";
import { getDb } from "@/server/db/client";
import { UserFacingError } from "@/server/services/errors";
import { acceptAiConsent, generateTextPosts, type GenerationView } from "@/server/services/generation";
import { createDraft } from "@/server/services/posts";
import { requireWorkspace } from "@/server/session";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: UserFacingError["code"] };

export async function acceptAiConsentAction(): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    await acceptAiConsent(getDb(), access, access.userId, getTextProvider());
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/studio");
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
