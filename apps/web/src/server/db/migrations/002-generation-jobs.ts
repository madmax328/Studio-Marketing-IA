import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections";
import type { Migration } from "./index";

/** Générations IA (quota, anti-doublon) et liste des publications. */
export const migration002: Migration = {
  id: "002-generation-jobs",
  async up(db: Db) {
    await db
      .collection(COLLECTIONS.generationJobs)
      .createIndex({ workspaceId: 1, requestId: 1 }, { unique: true });
    await db.collection(COLLECTIONS.generationJobs).createIndex({ workspaceId: 1, createdAt: -1 });
    await db.collection(COLLECTIONS.posts).createIndex({ workspaceId: 1, updatedAt: -1 });
  },
};
