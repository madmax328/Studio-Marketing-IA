"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { UserFacingError } from "@/server/services/errors";
import { deleteMyTestimonial, isAdminEmail, reviewTestimonial, saveTestimonial } from "@/server/services/testimonials";
import { requireUser, requireWorkspace } from "@/server/session";
import type { ActionResult } from "@/server/actions/studio";

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof UserFacingError) return { ok: false, error: error.message };
  console.error("Erreur avis", error);
  return { ok: false, error: "L'opération a échoué. Réessayez dans un instant." };
}

export async function saveTestimonialAction(input: unknown): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    await saveTestimonial(getDb(), access, access.userId, input);
    revalidatePath("/avis");
    revalidatePath("/tableau-de-bord");
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteTestimonialAction(): Promise<ActionResult<null>> {
  const user = await requireUser();
  try {
    await deleteMyTestimonial(getDb(), user.id);
    revalidatePath("/avis");
    revalidatePath("/");
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

/** Validation d'un avis : réservée aux adresses listées dans ADMIN_EMAILS. */
export async function reviewTestimonialAction(testimonialId: string, decision: "approved" | "rejected"): Promise<ActionResult<null>> {
  const user = await requireUser();
  if (!isAdminEmail(user.email, getServerEnv().ADMIN_EMAILS)) return { ok: false, error: "Accès réservé." };
  if (decision !== "approved" && decision !== "rejected") return { ok: false, error: "Décision invalide." };
  try {
    await reviewTestimonial(getDb(), user.id, testimonialId, decision);
    revalidatePath("/admin/avis");
    revalidatePath("/");
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}
