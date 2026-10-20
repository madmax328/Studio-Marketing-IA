import { randomBytes } from "node:crypto";
import type { Db } from "mongodb";
import { collections, type OAuthProviderId } from "@/server/db/collections";
import { recordAudit } from "@/server/services/audit";

/**
 * L'utilisateur a retiré l'application depuis le réseau : les comptes concernés sont marqués
 * « autorisation retirée » et leurs jetons effacés (dans tous les espaces où ils étaient connectés).
 */
export async function handlePlatformUninstall(db: Db, provider: OAuthProviderId, externalAccountId: string): Promise<number> {
  const accounts = await collections(db).socialAccounts.find({ provider, externalAccountId }, { projection: { _id: 1, workspaceId: 1 } }).toArray();
  if (accounts.length === 0) return 0;
  await collections(db).socialAccounts.updateMany(
    { provider, externalAccountId },
    { $set: { status: "revoked", accessToken: null, refreshToken: null, lastError: "Autorisation retirée depuis le réseau.", updatedAt: new Date() } },
  );
  for (const account of accounts) {
    await recordAudit(db, { workspaceId: account.workspaceId, actorUserId: null, action: "social.platform_uninstalled", targetId: account._id.toHexString() });
  }
  return accounts.length;
}

/** Demande de suppression des données envoyée par le réseau : les comptes concernés sont supprimés. */
export async function handlePlatformDeletion(db: Db, provider: OAuthProviderId, externalAccountId: string): Promise<{ deleted: number; confirmationCode: string }> {
  const accounts = await collections(db).socialAccounts.find({ provider, externalAccountId }, { projection: { _id: 1, workspaceId: 1 } }).toArray();
  await collections(db).socialAccounts.deleteMany({ provider, externalAccountId });
  const confirmationCode = randomBytes(9).toString("base64url");
  for (const account of accounts) {
    await recordAudit(db, {
      workspaceId: account.workspaceId,
      actorUserId: null,
      action: "social.platform_data_deleted",
      targetId: account._id.toHexString(),
      metadata: { confirmationCode },
    });
  }
  return { deleted: accounts.length, confirmationCode };
}
