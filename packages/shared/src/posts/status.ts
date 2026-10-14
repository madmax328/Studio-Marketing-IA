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
