import { z } from "zod";

/** Avis laissé par un utilisateur. Publié sur le site seulement avec son accord et après validation. */
export const testimonialInputSchema = z.object({
  rating: z.coerce.number().int().min(1, "Choisissez une note.").max(5),
  text: z.string().trim().min(20, "Quelques phrases suffisent (20 caractères au moins).").max(600, "600 caractères au plus."),
  authorName: z.string().trim().min(2, "Indiquez le nom à afficher.").max(60),
  authorRole: z.string().trim().min(2, "Indiquez votre activité (ex. « coach sportive »).").max(80),
  city: z.string().trim().max(60).default(""),
  publishConsent: z.boolean(),
});
export type TestimonialInput = z.infer<typeof testimonialInputSchema>;

export const TESTIMONIAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type TestimonialStatus = (typeof TESTIMONIAL_STATUSES)[number];

/** En dessous, la section n'apparaît pas sur le site (pas de vitrine à moitié vide). */
export const MIN_TESTIMONIALS_ON_SITE = 3;
