import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections";
import type { Migration } from "./index";

/** Repères anonymes : lecture des publications parues sur la période, tous espaces confondus. */
export const migration013: Migration = {
  id: "013-benchmarks",
  async up(db: Db) {
    await db.collection(COLLECTIONS.posts).createIndex({ status: 1, publishedAt: -1 });
  },
};
