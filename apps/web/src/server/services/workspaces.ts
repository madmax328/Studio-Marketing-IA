import { ObjectId, type Db } from "mongodb";
import type { WorkspaceRole } from "@smia/shared";
import { collections, type WorkspaceDoc } from "@/server/db/collections";
import { recordAudit } from "@/server/services/audit";

/** Limites appliquées à un nouvel espace tant que la facturation n'est pas en place. */
export const DEFAULT_WORKSPACE_LIMITS: WorkspaceDoc["limits"] = { maxBrands: 1 };

export interface WorkspaceAccess {
  workspace: WorkspaceDoc;
  role: WorkspaceRole;
}

/**
 * Garantit l'existence de l'espace personnel d'un utilisateur et le retourne.
 * Idempotent : l'index unique partiel empêche les doublons en cas d'appels concurrents.
 */
export async function ensurePersonalWorkspace(db: Db, user: { id: string; name: string }): Promise<WorkspaceDoc> {
  const { workspaces } = collections(db);
  const existing = await workspaces.findOne({ ownerUserId: user.id, personal: true });
  if (existing) {
    // Répare une adhésion manquante (ex. interruption entre les deux écritures).
    await ensureOwnerMembership(db, existing._id, user.id);
    return existing;
  }

  const now = new Date();
  const workspace: WorkspaceDoc = {
    _id: new ObjectId(),
    name: user.name ? `Espace de ${user.name}` : "Mon espace",
    ownerUserId: user.id,
    personal: true,
    limits: { ...DEFAULT_WORKSPACE_LIMITS },
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await workspaces.insertOne(workspace);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const created = await workspaces.findOne({ ownerUserId: user.id, personal: true });
      if (created) {
        await ensureOwnerMembership(db, created._id, user.id);
        return created;
      }
    }
    throw error;
  }

  await ensureOwnerMembership(db, workspace._id, user.id);
  await recordAudit(db, { workspaceId: workspace._id, actorUserId: user.id, action: "workspace.created" });
  return workspace;
}

/**
 * Retourne l'espace et le rôle de l'utilisateur, ou null s'il n'en est pas membre.
 * C'est l'unique point de contrôle : un workspaceId venant du navigateur
 * doit toujours passer par cette fonction.
 */
export async function getWorkspaceAccess(db: Db, userId: string, workspaceId: string): Promise<WorkspaceAccess | null> {
  if (!ObjectId.isValid(workspaceId)) return null;
  const id = new ObjectId(workspaceId);
  const { workspaces, workspaceMembers } = collections(db);
  const membership = await workspaceMembers.findOne({ workspaceId: id, userId });
  if (!membership) return null;
  const workspace = await workspaces.findOne({ _id: id });
  if (!workspace) return null;
  return { workspace, role: membership.role };
}

export async function listUserWorkspaces(db: Db, userId: string): Promise<WorkspaceAccess[]> {
  const { workspaces, workspaceMembers } = collections(db);
  const memberships = await workspaceMembers.find({ userId }).limit(100).toArray();
  const docs = await workspaces.find({ _id: { $in: memberships.map((m) => m.workspaceId) } }).toArray();
  return docs.flatMap((workspace) => {
    const membership = memberships.find((m) => m.workspaceId.equals(workspace._id));
    return membership ? [{ workspace, role: membership.role }] : [];
  });
}

async function ensureOwnerMembership(db: Db, workspaceId: ObjectId, userId: string): Promise<void> {
  const now = new Date();
  try {
    await collections(db).workspaceMembers.updateOne(
      { workspaceId, userId },
      { $setOnInsert: { _id: new ObjectId(), role: "owner", createdAt: now, updatedAt: now } },
      { upsert: true },
    );
  } catch (error) {
    // Deux upserts simultanés : l'un des deux échoue sur l'index unique, l'adhésion existe bien.
    if (!isDuplicateKeyError(error)) throw error;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;
}
