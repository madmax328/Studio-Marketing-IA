import type { Db } from "mongodb";
import { COLLECTIONS, collections } from "../collections";
import type { Migration } from "./index";

/**
 * Équipes et agences : invitations, espaces clients, validation des publications.
 * Ajoute les limites d'équipe aux offres (sans toucher une valeur déjà saisie à la main).
 */
export const migration012: Migration = {
  id: "012-teams",
  async up(db: Db) {
    const invitations = db.collection(COLLECTIONS.workspaceInvitations);
    await invitations.createIndex({ tokenHash: 1 }, { unique: true });
    await invitations.createIndex({ workspaceId: 1, email: 1 }, { unique: true });
    await invitations.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection(COLLECTIONS.workspaces).createIndex({ billingWorkspaceId: 1 }, { sparse: true });
    await db.collection(COLLECTIONS.posts).createIndex({ workspaceId: 1, status: 1, scheduledAt: 1 });

    const plans = collections(db).plans;
    const now = new Date();
    const team: Record<string, { maxMembers: number; maxClientSpaces: number }> = {
      free: { maxMembers: 1, maxClientSpaces: 0 },
      solo: { maxMembers: 2, maxClientSpaces: 0 },
      business: { maxMembers: 5, maxClientSpaces: 0 },
      agency: { maxMembers: 15, maxClientSpaces: 20 },
    };
    for (const [id, limits] of Object.entries(team)) {
      await plans.updateOne({ _id: id as "free", "limits.maxMembers": { $exists: false } }, { $set: { "limits.maxMembers": limits.maxMembers, updatedAt: now } });
      await plans.updateOne({ _id: id as "free", "limits.maxClientSpaces": { $exists: false } }, { $set: { "limits.maxClientSpaces": limits.maxClientSpaces, updatedAt: now } });
    }
    await plans.updateOne(
      { _id: "business", features: ["Jusqu'à 3 marques", "Plus de comptes sociaux", "Plus de crédits IA", "Statistiques (bientôt)"] },
      { $set: { features: ["Jusqu'à 3 marques", "Plus de comptes sociaux", "Plus de crédits IA", "Équipe jusqu'à 5 personnes", "Statistiques"], updatedAt: now } },
    );
    // Textes des offres : seulement s'ils n'ont pas été modifiés depuis la migration 006.
    await plans.updateOne(
      { _id: "agency", features: ["Plusieurs marques", "Nombreux comptes sociaux", "Crédits IA étendus"] },
      { $set: { features: ["Un espace par client, avec ses propres accès", "Validation des publications par vos clients", "Équipe jusqu'à 15 personnes", "Crédits IA étendus"], updatedAt: now } },
    );
  },
};
