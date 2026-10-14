import { z } from "zod";
import { SOCIAL_NETWORK_IDS } from "../social/networks";

/** Cycle de vie d'une publication. */
export const POST_STATUSES = ["draft", "scheduled", "processing", "published", "failed", "cancelled"] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Brouillon",
  scheduled: "Programmée",
  processing: "En cours de publication",
  published: "Publiée",
  failed: "En échec",
  cancelled: "Annulée",
};

const ALLOWED_TRANSITIONS: Record<PostStatus, readonly PostStatus[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["draft", "processing", "cancelled"],
  processing: ["published", "failed", "scheduled"],
  published: [],
  failed: ["scheduled", "draft", "cancelled"],
  cancelled: ["draft"],
};

/** Les transitions sont vérifiées côté serveur pour éviter les états incohérents. */
export function canTransitionPost(from: PostStatus, to: PostStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Statuts dans lesquels le contenu d'une publication peut encore être modifié ou supprimé. */
export const EDITABLE_POST_STATUSES: readonly PostStatus[] = ["draft", "failed", "cancelled"];

/** Enregistrement d'une publication en brouillon (validé côté serveur). */
export const postDraftSchema = z.object({
  brandId: z.string().min(1),
  network: z.enum(SOCIAL_NETWORK_IDS),
  text: z.string().trim().min(1, "Le texte est vide.").max(63206),
  rationale: z.string().trim().max(500).default(""),
  generationJobId: z.string().optional(),
});

export type PostDraftInput = z.infer<typeof postDraftSchema>;
