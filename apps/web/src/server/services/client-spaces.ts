import { ObjectId, type Db } from "mongodb";
import { clientSpaceSchema, type WorkspaceRole } from "@smia/shared";
import { collections, type WorkspaceDoc } from "@/server/db/collections";
import type { MediaStorage } from "@/server/media/storage";
import { deleteWorkspacesData } from "@/server/services/account";
import { recordAudit } from "@/server/services/audit";
import { getEffectivePlan } from "@/server/services/billing";
import { UserFacingError } from "@/server/services/errors";
import { assertPermission } from "@/server/services/permissions";
import { getWorkspaceAccess, listUserWorkspaces, type WorkspaceAccess } from "@/server/services/workspaces";

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
  personal: boolean;
  /** Espace client rattaché à une agence. */
  client: boolean;
}

/** Espaces de l'utilisateur, pour le sélecteur (espace personnel d'abord, puis par nom). */
export async function listWorkspaceSummaries(db: Db, userId: string): Promise<WorkspaceSummary[]> {
  const accesses = await listUserWorkspaces(db, userId);
  return accesses
    .map(({ workspace, role }) => ({
      id: workspace._id.toHexString(),
      name: workspace.name,
      role,
      personal: workspace.personal,
      client: Boolean(workspace.billingWorkspaceId),
    }))
    .sort((a, b) => Number(b.personal) - Number(a.personal) || a.name.localeCompare(b.name, "fr"));
}

/** Espaces clients rattachés à l'espace (agence). */
export async function listClientSpaces(db: Db, access: WorkspaceAccess): Promise<{ id: string; name: string; createdAt: Date }[]> {
  assertPermission(access, "workspace:read");
  const spaces = await collections(db).workspaces.find({ billingWorkspaceId: access.workspace._id }).sort({ name: 1 }).limit(200).toArray();
  return spaces.map((space) => ({ id: space._id.toHexString(), name: space.name, createdAt: space.createdAt }));
}

/**
 * Crée un espace client rattaché à l'abonnement de l'espace courant (offre Agence). Son créateur en est
 * propriétaire ; la validation des publications y est activée par défaut (le client valide avant l'envoi).
 */
export async function createClientSpace(db: Db, access: WorkspaceAccess, userId: string, input: unknown, now = new Date()): Promise<WorkspaceDoc> {
  assertPermission(access, "workspace:manage");
  if (access.workspace.billingWorkspaceId) throw new UserFacingError("Un espace client ne peut pas avoir ses propres espaces clients.", "forbidden");
  const parsed = clientSpaceSchema.safeParse(input);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Nom invalide.", "invalid_input");
  const { limits } = await getEffectivePlan(db, access.workspace);
  const existing = await collections(db).workspaces.countDocuments({ billingWorkspaceId: access.workspace._id });
  if (existing >= limits.maxClientSpaces) {
    throw new UserFacingError(
      limits.maxClientSpaces === 0
        ? "Les espaces clients sont réservés à l'offre Agence."
        : `Votre offre permet ${limits.maxClientSpaces} espaces clients.`,
      "limit_reached",
    );
  }
  const workspace: WorkspaceDoc = {
    _id: new ObjectId(),
    name: parsed.data.name,
    ownerUserId: userId,
    personal: false,
    billingWorkspaceId: access.workspace._id,
    approvalRequired: true,
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
  await collections(db).workspaces.insertOne(workspace);
  await collections(db).workspaceMembers.insertOne({ _id: new ObjectId(), workspaceId: workspace._id, userId, role: "owner", createdAt: now, updatedAt: now });
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "workspace.client_created", targetId: workspace._id.toHexString() });
  return workspace;
}

/** Renomme l'espace courant. */
export async function renameWorkspace(db: Db, access: WorkspaceAccess, userId: string, input: unknown): Promise<void> {
  assertPermission(access, "workspace:manage");
  const parsed = clientSpaceSchema.safeParse(input);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Nom invalide.", "invalid_input");
  await collections(db).workspaces.updateOne({ _id: access.workspace._id }, { $set: { name: parsed.data.name, updatedAt: new Date() } });
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "workspace.renamed" });
}

/** Supprime définitivement un espace client et tout son contenu (réservé à son propriétaire). */
export async function deleteClientSpace(db: Db, userId: string, workspaceId: string, storage: MediaStorage): Promise<void> {
  const access = await getWorkspaceAccess(db, userId, workspaceId);
  if (!access) throw new UserFacingError("Espace introuvable.", "not_found");
  if (!access.workspace.billingWorkspaceId) throw new UserFacingError("Seuls les espaces clients peuvent être supprimés ici.", "forbidden");
  if (access.role !== "owner") throw new UserFacingError("Seul le propriétaire de l'espace client peut le supprimer.", "forbidden");
  await deleteWorkspacesData(db, storage, [access.workspace._id]);
  await recordAudit(db, { workspaceId: access.workspace.billingWorkspaceId, actorUserId: userId, action: "workspace.client_deleted", targetId: workspaceId });
}
