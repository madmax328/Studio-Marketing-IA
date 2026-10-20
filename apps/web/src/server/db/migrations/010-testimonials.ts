import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections";
import type { Migration } from "./index";

/** Témoignages : un avis par utilisateur, liste des avis publiés. */
export const migration010: Migration = {
  id: "010-testimonials",
  async up(db: Db) {
    await db.collection(COLLECTIONS.testimonials).createIndex({ userId: 1 }, { unique: true });
    await db.collection(COLLECTIONS.testimonials).createIndex({ status: 1, publishConsent: 1, reviewedAt: -1 });
  },
};
