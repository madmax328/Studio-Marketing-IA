import type { Db } from "mongodb";
import { collections } from "../collections";
import type { Migration } from "./index";

/**
 * Le studio s'adresse à tout le monde, pas seulement aux commerces : descriptions des offres élargies.
 * Une description déjà modifiée à la main n'est pas touchée.
 */
export const migration008: Migration = {
  id: "008-plan-audience",
  async up(db: Db) {
    const plans = collections(db).plans;
    const now = new Date();
    await plans.updateOne(
      { _id: "solo", description: "Pour un commerce ou un indépendant." },
      { $set: { description: "Pour une personne ou une petite structure qui publie régulièrement.", updatedAt: now } },
    );
    await plans.updateOne(
      { _id: "business", description: "Pour les entreprises qui publient beaucoup." },
      { $set: { description: "Pour les entreprises et associations qui gèrent plusieurs marques ou publient beaucoup.", updatedAt: now } },
    );
  },
};
