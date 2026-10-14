"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { UserFacingError } from "@/server/services/errors";
import { deletePost, updatePostText } from "@/server/services/posts";
import { requireWorkspace } from "@/server/session";

export interface PostFormState {
  error: string | null;
  saved: boolean;
}

export async function updatePostAction(postId: string, _previous: PostFormState, form: FormData): Promise<PostFormState> {
  const access = await requireWorkspace();
  try {
    await updatePostText(getDb(), access, postId, form.get("text"));
  } catch (error) {
    return { error: toMessage(error), saved: false };
  }
  revalidatePath("/publications");
  revalidatePath(`/publications/${postId}`);
  return { error: null, saved: true };
}

export async function deletePostAction(postId: string): Promise<{ error: string } | undefined> {
  const access = await requireWorkspace();
  try {
    await deletePost(getDb(), access, access.userId, postId);
  } catch (error) {
    return { error: toMessage(error) };
  }
  revalidatePath("/publications");
  revalidatePath("/tableau-de-bord");
  redirect("/publications?supprimee=1");
}

function toMessage(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  console.error("Erreur sur une publication", error);
  return "L'opération a échoué. Réessayez dans un instant.";
}
