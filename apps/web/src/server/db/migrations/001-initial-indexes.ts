import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections";
import type { Migration } from "./index";

/**
 * Index initiaux.
 * Les collections Better Auth (user, session, account, verification, rateLimit)
 * sont indexées ici car l'adaptateur MongoDB ne crée pas d'index.
 */
export const migration001: Migration = {
  id: "001-initial-indexes",
  async up(db: Db) {
    // Authentification
    await db.collection("user").createIndex({ email: 1 }, { unique: true });
    await db.collection("session").createIndex({ token: 1 }, { unique: true });
    await db.collection("session").createIndex({ userId: 1 });
    await db.collection("session").createIndex({ expiresAt: 1 });
    await db.collection("account").createIndex({ userId: 1 });
    await db.collection("verification").createIndex({ identifier: 1 });
    await db.collection("rateLimit").createIndex({ key: 1 }, { unique: true });

    // Espaces de travail : un seul espace personnel par utilisateur.
    await db
      .collection(COLLECTIONS.workspaces)
      .createIndex({ ownerUserId: 1 }, { unique: true, partialFilterExpression: { personal: true } });
    await db.collection(COLLECTIONS.workspaceMembers).createIndex({ workspaceId: 1, userId: 1 }, { unique: true });
    await db.collection(COLLECTIONS.workspaceMembers).createIndex({ userId: 1 });

    // Marques d'un espace de travail
    await db.collection(COLLECTIONS.brands).createIndex({ workspaceId: 1, createdAt: -1 });

    // Publications : tableau de bord, calendrier et file de publication
    await db.collection(COLLECTIONS.posts).createIndex({ workspaceId: 1, status: 1, scheduledAt: 1 });
    await db.collection(COLLECTIONS.posts).createIndex({ status: 1, scheduledAt: 1 });

    // Comptes sociaux connectés
    await db.collection(COLLECTIONS.socialAccounts).createIndex({ workspaceId: 1, network: 1 });

    // Journal d'audit
    await db.collection(COLLECTIONS.auditLogs).createIndex({ workspaceId: 1, createdAt: -1 });
    await db.collection(COLLECTIONS.auditLogs).createIndex({ actorUserId: 1, createdAt: -1 });
  },
};
