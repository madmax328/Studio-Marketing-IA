import type { Db } from "mongodb";
import { collections } from "../collections";
import type { Migration } from "./index";

/**
 * Textes de l'offre Business affichés sur le site public : les statistiques ne sont pas encore livrées
 * et aucune « campagne avancée » n'existe. Ne touche l'offre que si ses textes n'ont pas été modifiés à la main.
 */
export const migration007: Migration = {
  id: "007-plan-features",
  async up(db: Db) {
    await collections(db).plans.updateOne(
      { _id: "business", features: ["Jusqu'à 3 marques", "Plus de comptes sociaux", "Campagnes avancées", "Statistiques"] },
      { $set: { features: ["Jusqu'à 3 marques", "Plus de comptes sociaux", "Plus de crédits IA", "Statistiques (bientôt)"], updatedAt: new Date() } },
    );
  },
};
