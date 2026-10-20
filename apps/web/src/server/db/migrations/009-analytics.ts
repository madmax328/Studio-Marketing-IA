import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections";
import type { Migration } from "./index";

/** Statistiques : relevés des chiffres des publications et file des relevés à faire. */
export const migration009: Migration = {
  id: "009-analytics",
  async up(db: Db) {
    await db.collection(COLLECTIONS.analyticsSnapshots).createIndex({ workspaceId: 1, postId: 1, collectedAt: -1 });
    await db.collection(COLLECTIONS.analyticsSnapshots).createIndex({ postId: 1, collectedAt: -1 });
    // Publications dont les chiffres sont à relever.
    await db.collection(COLLECTIONS.posts).createIndex({ status: 1, "metrics.nextCollectAt": 1 });
    await db.collection(COLLECTIONS.posts).createIndex({ workspaceId: 1, status: 1, publishedAt: -1 });
  },
};
