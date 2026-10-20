import { ObjectId, type Db } from "mongodb";
import { MIN_TESTIMONIALS_ON_SITE, testimonialInputSchema } from "@smia/shared";
import { collections, type TestimonialDoc } from "@/server/db/collections";
import { recordAudit } from "@/server/services/audit";
import { UserFacingError } from "@/server/services/errors";
import type { WorkspaceAccess } from "@/server/services/workspaces";

const DAY = 24 * 60 * 60_000;
/** On ne sollicite un avis qu'après un vrai usage : 3 publications parues ou 14 jours d'ancienneté. */
export const ASK_AFTER_PUBLISHED = 3;
export const ASK_AFTER_DAYS = 14;

export async function getMyTestimonial(db: Db, userId: string): Promise<TestimonialDoc | null> {
  return collections(db).testimonials.findOne({ userId });
}

/**
 * Enregistre (ou modifie) l'avis de l'utilisateur. Toute modification repasse en attente de validation :
 * un texte modifié n'est jamais publié sans être relu.
 */
export async function saveTestimonial(db: Db, access: WorkspaceAccess, userId: string, input: unknown, now = new Date()): Promise<TestimonialDoc> {
  const parsed = testimonialInputSchema.safeParse(input);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Avis invalide.", "invalid_input");
  const data = parsed.data;
  const saved = await collections(db).testimonials.findOneAndUpdate(
    { userId },
    {
      $set: { ...data, workspaceId: access.workspace._id, status: "pending", reviewedAt: null, updatedAt: now },
      $setOnInsert: { _id: new ObjectId(), userId, createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "testimonial.saved" });
  return saved as TestimonialDoc;
}

/** Retire l'avis (il disparaît aussitôt du site). */
export async function deleteMyTestimonial(db: Db, userId: string): Promise<void> {
  await collections(db).testimonials.deleteOne({ userId });
}

/** Faut-il inviter l'utilisateur à donner son avis ? Jamais s'il l'a déjà fait. */
export async function shouldAskForTestimonial(db: Db, access: WorkspaceAccess, userId: string, userCreatedAt: Date, now = new Date()): Promise<boolean> {
  if (await collections(db).testimonials.findOne({ userId }, { projection: { _id: 1 } })) return false;
  if (now.getTime() - userCreatedAt.getTime() >= ASK_AFTER_DAYS * DAY) return true;
  const published = await collections(db).posts.countDocuments(
    { workspaceId: access.workspace._id, status: "published", "publishing.simulated": { $ne: true } },
    { limit: ASK_AFTER_PUBLISHED },
  );
  return published >= ASK_AFTER_PUBLISHED;
}

// ---------- Validation (administrateurs) ----------

/** L'adresse fait-elle partie des administrateurs (ADMIN_EMAILS) ? */
export function isAdminEmail(email: string, adminEmails: string): boolean {
  const admins = adminEmails
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}

export async function listTestimonialsForReview(db: Db): Promise<TestimonialDoc[]> {
  return collections(db).testimonials.find({}).sort({ status: 1, updatedAt: -1 }).limit(200).toArray();
}

export async function reviewTestimonial(db: Db, adminUserId: string, testimonialId: string, decision: "approved" | "rejected", now = new Date()): Promise<void> {
  if (!ObjectId.isValid(testimonialId)) throw new UserFacingError("Avis introuvable.", "not_found");
  const result = await collections(db).testimonials.updateOne(
    { _id: new ObjectId(testimonialId) },
    { $set: { status: decision, reviewedAt: now, updatedAt: now } },
  );
  if (result.matchedCount === 0) throw new UserFacingError("Avis introuvable.", "not_found");
  await recordAudit(db, { workspaceId: null, actorUserId: adminUserId, action: `testimonial.${decision}`, targetId: testimonialId });
}

// ---------- Site public ----------

export interface PublicTestimonial {
  id: string;
  rating: number;
  text: string;
  authorName: string;
  authorRole: string;
  city: string;
}

/** Avis validés dont l'auteur a accepté la publication ; rien tant qu'il n'y en a pas assez. */
export async function listPublicTestimonials(db: Db, limit = 6): Promise<PublicTestimonial[]> {
  const docs = await collections(db)
    .testimonials.find({ status: "approved", publishConsent: true })
    .sort({ rating: -1, reviewedAt: -1 })
    .limit(Math.max(limit, MIN_TESTIMONIALS_ON_SITE))
    .toArray();
  if (docs.length < MIN_TESTIMONIALS_ON_SITE) return [];
  return docs.slice(0, limit).map((doc) => ({
    id: doc._id.toHexString(),
    rating: doc.rating,
    text: doc.text,
    authorName: doc.authorName,
    authorRole: doc.authorRole,
    city: doc.city,
  }));
}
