import type { Db } from "mongodb";
import type { PlanDoc } from "../collections";
import { COLLECTIONS } from "../collections";
import type { Migration } from "./index";

/**
 * Offres de départ (provisoires). Insérées seulement si elles n'existent pas :
 * une offre modifiée en base n'est jamais écrasée par cette migration.
 */
const DEFAULT_PLANS: Omit<PlanDoc, "updatedAt">[] = [
  {
    _id: "free",
    name: "Gratuit",
    description: "Pour découvrir le studio.",
    features: ["1 marque", "Studio de contenu et visuels", "Calendrier", "Crédits IA limités"],
    limits: { maxBrands: 1, monthlyCredits: 20, maxSocialAccounts: 2 },
    order: 0,
    active: true,
  },
  {
    _id: "solo",
    name: "Solo",
    description: "Pour un commerce ou un indépendant.",
    features: ["1 marque", "Campagnes et calendrier", "Publication automatique", "Crédits IA mensuels"],
    limits: { maxBrands: 1, monthlyCredits: 150, maxSocialAccounts: 5 },
    order: 1,
    active: true,
  },
  {
    _id: "business",
    name: "Business",
    description: "Pour les entreprises qui publient beaucoup.",
    features: ["Jusqu'à 3 marques", "Plus de comptes sociaux", "Campagnes avancées", "Statistiques"],
    limits: { maxBrands: 3, monthlyCredits: 500, maxSocialAccounts: 15 },
    order: 2,
    active: true,
  },
  {
    _id: "agency",
    name: "Agence",
    description: "Pour gérer plusieurs clients.",
    features: ["Plusieurs marques", "Nombreux comptes sociaux", "Crédits IA étendus"],
    limits: { maxBrands: 20, monthlyCredits: 2000, maxSocialAccounts: 50 },
    order: 3,
    active: true,
  },
];

export const migration006: Migration = {
  id: "006-billing",
  async up(db: Db) {
    const now = new Date();
    for (const plan of DEFAULT_PLANS) {
      await db.collection<PlanDoc>(COLLECTIONS.plans).updateOne(
        { _id: plan._id },
        { $setOnInsert: { ...plan, updatedAt: now } },
        { upsert: true },
      );
    }
    await db.collection(COLLECTIONS.subscriptions).createIndex({ stripeCustomerId: 1 });
    await db.collection(COLLECTIONS.subscriptions).createIndex({ stripeSubscriptionId: 1 });
    await db.collection(COLLECTIONS.creditTransactions).createIndex({ workspaceId: 1, idempotencyKey: 1 }, { unique: true });
    await db.collection(COLLECTIONS.creditTransactions).createIndex({ workspaceId: 1, createdAt: -1 });
    // Les anciennes limites codées par espace sont remplacées par celles de l'offre.
    await db.collection(COLLECTIONS.workspaces).updateMany({ limits: { $exists: true } }, { $unset: { limits: "" } });
  },
};
