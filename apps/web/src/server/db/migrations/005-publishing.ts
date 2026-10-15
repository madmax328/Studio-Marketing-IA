import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections";
import type { Migration } from "./index";

/** Publication automatique : comptes sociaux, états OAuth, notifications, file d'envoi. */
export const migration005: Migration = {
  id: "005-publishing",
  async up(db: Db) {
    await db
      .collection(COLLECTIONS.socialAccounts)
      .createIndex({ workspaceId: 1, network: 1, externalAccountId: 1 }, { unique: true });
    // États OAuth supprimés automatiquement à expiration.
    await db.collection(COLLECTIONS.oauthStates).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection(COLLECTIONS.notifications).createIndex({ workspaceId: 1, createdAt: -1 });
    await db.collection(COLLECTIONS.notifications).createIndex({ workspaceId: 1, readAt: 1 });
    // Publications en cours de traitement (récupération des verrous abandonnés).
    await db.collection(COLLECTIONS.posts).createIndex({ status: 1, "publishing.lockedAt": 1 });
  },
};
