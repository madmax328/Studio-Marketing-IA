import type { Db } from "mongodb";
import { getDb } from "@/server/db/client";
import { collections } from "@/server/db/collections";
import { getMediaStorage, type MediaStorage } from "@/server/media/storage";
import { recordAudit } from "@/server/services/audit";

/**
 * Supprime les données métier d'un utilisateur avant la suppression de son compte.
 * - Les espaces dont il est propriétaire sont supprimés avec leur contenu.
 * - Ses adhésions aux espaces d'autres personnes sont retirées.
 * - Les entrées d'audit qui le désignent sont anonymisées.
 * - Les fichiers de la médiathèque sont effacés du stockage.
 */
export async function deleteUserData(
  userId: string,
  db: Db = getDb(),
  storage: MediaStorage = getMediaStorage(),
): Promise<void> {
  const c = collections(db);
  const owned = await c.workspaces.find({ ownerUserId: userId }, { projection: { _id: 1 } }).toArray();
  const ownedIds = owned.map((w) => w._id);

  if (ownedIds.length > 0) {
    // Fichiers d'abord : si le stockage échoue, le compte n'est pas supprimé et l'opération peut être relancée.
    const media = await c.mediaAssets.find({ workspaceId: { $in: ownedIds } }, { projection: { storageKey: 1 } }).toArray();
    if (media.length > 0 && storage.isConfigured()) {
      for (let i = 0; i < media.length; i += 100) {
        await storage.remove(media.slice(i, i + 100).map((m) => m.storageKey));
      }
    }
    await c.mediaAssets.deleteMany({ workspaceId: { $in: ownedIds } });
    await c.brands.deleteMany({ workspaceId: { $in: ownedIds } });
    await c.posts.deleteMany({ workspaceId: { $in: ownedIds } });
    await c.generationJobs.deleteMany({ workspaceId: { $in: ownedIds } });
    await c.socialAccounts.deleteMany({ workspaceId: { $in: ownedIds } });
    await c.workspaceMembers.deleteMany({ workspaceId: { $in: ownedIds } });
    await c.auditLogs.deleteMany({ workspaceId: { $in: ownedIds } });
    await c.workspaces.deleteMany({ _id: { $in: ownedIds } });
  }

  await c.workspaceMembers.deleteMany({ userId });
  await c.auditLogs.updateMany({ actorUserId: userId }, { $set: { actorUserId: null } });
  await recordAudit(db, { workspaceId: null, actorUserId: null, action: "account.deleted" });
}

/** Rassemble les données personnelles et métier de l'utilisateur (droit à la portabilité). */
export async function exportUserData(user: { id: string; name: string; email: string; createdAt: Date }, db: Db = getDb()) {
  const c = collections(db);
  const memberships = await c.workspaceMembers.find({ userId: user.id }).toArray();
  const workspaceIds = memberships.map((m) => m.workspaceId);
  const ownedWorkspaces = await c.workspaces.find({ _id: { $in: workspaceIds }, ownerUserId: user.id }).toArray();
  const ownedIds = ownedWorkspaces.map((w) => w._id);

  return {
    exportedAt: new Date().toISOString(),
    user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
    memberships: memberships.map((m) => ({ workspaceId: m.workspaceId.toHexString(), role: m.role })),
    workspaces: ownedWorkspaces,
    brands: await c.brands.find({ workspaceId: { $in: ownedIds } }).toArray(),
    posts: await c.posts.find({ workspaceId: { $in: ownedIds } }).toArray(),
    media: await c.mediaAssets
      .find({ workspaceId: { $in: ownedIds } }, { projection: { name: 1, mimeType: 1, width: 1, height: 1, createdAt: 1 } })
      .toArray(),
    generations: await c.generationJobs
      .find({ workspaceId: { $in: ownedIds } }, { projection: { request: 1, result: 1, status: 1, createdAt: 1 } })
      .toArray(),
    socialAccounts: await c.socialAccounts
      .find({ workspaceId: { $in: ownedIds } }, { projection: { network: 1, displayName: 1, status: 1, createdAt: 1 } })
      .toArray(),
  };
}
