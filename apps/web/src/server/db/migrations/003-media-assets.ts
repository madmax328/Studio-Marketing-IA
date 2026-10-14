import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections";
import type { Migration } from "./index";

/** Médiathèque. */
export const migration003: Migration = {
  id: "003-media-assets",
  async up(db: Db) {
    await db.collection(COLLECTIONS.mediaAssets).createIndex({ workspaceId: 1, createdAt: -1 });
    await db.collection(COLLECTIONS.mediaAssets).createIndex({ storageKey: 1 }, { unique: true });
  },
};
