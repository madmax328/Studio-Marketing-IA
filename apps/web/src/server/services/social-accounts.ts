import { ObjectId, type Db } from "mongodb";
import { isSocialNetworkId, SOCIAL_NETWORKS } from "@smia/shared";
import { collections, type SocialAccountDoc } from "@/server/db/collections";
import { recordAudit } from "@/server/services/audit";
import { UserFacingError } from "@/server/services/errors";
import { assertPermission } from "@/server/services/permissions";
import type { WorkspaceAccess } from "@/server/services/workspaces";

/** Comptes connectés, sans jamais exposer les jetons. */
export async function listSocialAccounts(db: Db, access: WorkspaceAccess) {
  assertPermission(access, "workspace:read");
  return collections(db)
    .socialAccounts.find(
      { workspaceId: access.workspace._id },
      { projection: { accessToken: 0, refreshToken: 0 } },
    )
    .sort({ createdAt: 1 })
    .limit(100)
    .toArray() as Promise<Omit<SocialAccountDoc, "accessToken" | "refreshToken">[]>;
}

/** Connecte un compte de test : les publications « partent » sans rien envoyer, et c'est affiché partout. */
export async function connectSimulationAccount(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  network: unknown,
  enabled: boolean,
): Promise<void> {
  assertPermission(access, "social:connect");
  if (!enabled) throw new UserFacingError("Le mode simulation est désactivé.", "forbidden");
  if (typeof network !== "string" || !isSocialNetworkId(network)) throw new UserFacingError("Réseau inconnu.", "invalid_input");
  const now = new Date();
  await collections(db).socialAccounts.updateOne(
    { workspaceId: access.workspace._id, network, externalAccountId: "simulation" },
    {
      $set: { status: "connected", lastError: null, lastCheckedAt: now, updatedAt: now },
      $setOnInsert: {
        _id: new ObjectId(),
        provider: "simulation",
        displayName: `Compte de test ${SOCIAL_NETWORKS[network].label} (simulation)`,
        scopes: [],
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        connectedByUserId: userId,
        createdAt: now,
      },
    },
    { upsert: true },
  );
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "social.simulation_connected", metadata: { network } });
}

/**
 * Déconnecte un compte : les jetons sont effacés de notre base.
 * (La révocation côté réseau sera ajoutée avec chaque connecteur réel qui la propose.)
 */
export async function disconnectSocialAccount(db: Db, access: WorkspaceAccess, userId: string, accountId: string): Promise<void> {
  assertPermission(access, "social:connect");
  if (!ObjectId.isValid(accountId)) throw new UserFacingError("Compte introuvable.", "not_found");
  const result = await collections(db).socialAccounts.deleteOne({ _id: new ObjectId(accountId), workspaceId: access.workspace._id });
  if (result.deletedCount === 0) throw new UserFacingError("Compte introuvable.", "not_found");
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "social.disconnected", targetId: accountId });
}
