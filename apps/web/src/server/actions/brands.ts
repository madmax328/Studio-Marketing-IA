"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { brandFormDataToInput } from "@/lib/brand-form-data";
import { getDb } from "@/server/db/client";
import { createBrand, updateBrand } from "@/server/services/brands";
import { UserFacingError } from "@/server/services/errors";
import { requireWorkspace } from "@/server/session";

export interface BrandFormState {
  error: string | null;
  saved: boolean;
}

export async function createBrandAction(_previous: BrandFormState, form: FormData): Promise<BrandFormState> {
  const access = await requireWorkspace();
  let brandId: string;
  try {
    const brand = await createBrand(getDb(), access, access.userId, brandFormDataToInput(form));
    brandId = brand._id.toHexString();
  } catch (error) {
    return { error: toMessage(error), saved: false };
  }
  revalidatePath("/ma-marque");
  redirect(`/ma-marque/${brandId}?cree=1`);
}

export async function updateBrandAction(
  brandId: string,
  _previous: BrandFormState,
  form: FormData,
): Promise<BrandFormState> {
  const access = await requireWorkspace();
  try {
    await updateBrand(getDb(), access, access.userId, brandId, brandFormDataToInput(form));
  } catch (error) {
    return { error: toMessage(error), saved: false };
  }
  revalidatePath("/ma-marque");
  revalidatePath(`/ma-marque/${brandId}`);
  return { error: null, saved: true };
}

function toMessage(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  console.error("Erreur lors de l'enregistrement de la marque", error);
  return "L'enregistrement a échoué. Réessayez dans un instant.";
}
