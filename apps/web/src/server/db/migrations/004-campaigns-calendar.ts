import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections";
import type { Migration } from "./index";

/** Campagnes et calendrier. */
export const migration004: Migration = {
  id: "004-campaigns-calendar",
  async up(db: Db) {
    await db.collection(COLLECTIONS.campaigns).createIndex({ workspaceId: 1, createdAt: -1 });
    // Calendrier : publications d'un espace sur une période.
    await db.collection(COLLECTIONS.posts).createIndex({ workspaceId: 1, scheduledAt: 1 });
    // Publications d'une campagne, par créneau (une par réseau).
    await db.collection(COLLECTIONS.posts).createIndex({ workspaceId: 1, campaignId: 1, slotId: 1 });
  },
};
