import { z } from "zod";
import { BRAND_TONES } from "../brand/schema";
import { SOCIAL_NETWORK_IDS } from "../social/networks";

/** Types de publication proposés dans le studio. */
export const POST_KINDS = [
  "presentation_produit",
  "promotion",
  "evenement",
  "conseil",
  "coulisses",
  "question_communaute",
  "presentation_entreprise",
  "libre",
] as const;

export type PostKind = (typeof POST_KINDS)[number];

export const POST_KIND_LABELS: Record<PostKind, string> = {
  presentation_produit: "Présenter un produit ou service",
  promotion: "Annoncer une promotion",
  evenement: "Annoncer un événement",
  conseil: "Partager un conseil",
  coulisses: "Montrer les coulisses",
  question_communaute: "Poser une question à la communauté",
  presentation_entreprise: "Présenter l'entreprise",
  libre: "Sujet libre",
};

/** Demande de génération envoyée par le navigateur (validée côté serveur). */
export const generationRequestSchema = z.object({
  brandId: z.string().min(1, "Choisissez une marque"),
  networks: z.array(z.enum(SOCIAL_NETWORK_IDS)).min(1, "Choisissez au moins un réseau").max(8),
  kind: z.enum(POST_KINDS).default("libre"),
  /** Ce que l'utilisateur veut dire : sujet, produit, événement, détails à mettre en avant. */
  brief: z.string().trim().min(5, "Décrivez en quelques mots ce que vous voulez publier").max(2000),
  /** Ton imposé pour cette génération ; sinon celui de la marque. */
  tone: z.enum(BRAND_TONES).optional(),
  variantsPerNetwork: z.coerce.number().int().min(1).max(3).default(1),
  /** Identifiant unique de la demande : évite une double génération (double clic, nouvelle tentative). */
  requestId: z.uuid(),
});

export type GenerationRequest = z.infer<typeof generationRequestSchema>;

/**
 * Format attendu en sortie du modèle (sortie structurée).
 * Pas de contraintes de longueur ici : elles sont vérifiées après coup par réseau.
 */
export const generatedPostSchema = z.object({
  network: z.enum(SOCIAL_NETWORK_IDS),
  text: z.string(),
  hashtags: z.array(z.string()),
  /** Rôle de la publication, expliqué simplement à l'utilisateur. */
  rationale: z.string(),
});

export const generationOutputSchema = z.object({
  posts: z.array(generatedPostSchema),
  /** Informations manquantes que le modèle a dû éviter d'inventer. */
  missingInformation: z.array(z.string()),
});

export type GeneratedPost = z.infer<typeof generatedPostSchema>;
export type GenerationOutput = z.infer<typeof generationOutputSchema>;

/** Texte final publié : corps + hashtags (dédoublonnés, préfixés par #). */
export function composePostText(post: Pick<GeneratedPost, "text" | "hashtags">): string {
  const tags = [...new Set(post.hashtags.map((tag) => tag.trim().replace(/^#*/, "")).filter(Boolean))].map(
    (tag) => `#${tag.replace(/\s+/g, "")}`,
  );
  const body = post.text.trim();
  return tags.length > 0 ? `${body}\n\n${tags.join(" ")}` : body;
}
