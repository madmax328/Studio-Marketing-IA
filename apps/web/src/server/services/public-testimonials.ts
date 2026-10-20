import "server-only";
import { ensureDatabaseReady, getDb } from "@/server/db/client";
import { listPublicTestimonials, type PublicTestimonial } from "@/server/services/testimonials";

/** Avis publiés pour le site public ; vide si la base est injoignable (ex. pendant la compilation). */
export async function getSiteTestimonials(): Promise<PublicTestimonial[]> {
  try {
    await ensureDatabaseReady();
    return await listPublicTestimonials(getDb());
  } catch {
    return [];
  }
}
