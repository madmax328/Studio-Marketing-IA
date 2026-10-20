import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections";
import type { Migration } from "./index";

/** Voix off : recherche des fichiers temporaires à effacer par le planificateur. */
export const migration011: Migration = {
  id: "011-voiceover",
  async up(db: Db) {
    await db.collection(COLLECTIONS.generationJobs).createIndex({ kind: 1, status: 1, createdAt: 1 });
  },
};
