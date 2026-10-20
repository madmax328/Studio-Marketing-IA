import { createHash, randomBytes } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { INVITABLE_ROLES, INVITATION_TTL_DAYS, invitationSchema, ROLE_LABELS, type InvitableRole, type WorkspaceRole } from "@smia/shared";
import { collections } from "@/server/db/collections";
import { recordAudit } from "@/server/services/audit";
import { getEffectivePlan } from "@/server/services/billing";
import { UserFacingError } from "@/server/services/errors";
import { assertPermission } from "@/server/services/permissions";
import type { WorkspaceAccess } from "@/server/services/workspaces";

type EmailSender = (message: { to: string; subject: string; text: string }) => Promise<void>;

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: Date;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: InvitableRole;
  expiresAt: Date;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Comptes Better Auth (nom, e-mail) des utilisateurs donnés. */
async function usersById(db: Db, userIds: string[]): Promise<Map<string, { name: string; email: string }>> {
  const ids = userIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  const users = await db.collection<{ _id: ObjectId; name?: string; email?: string }>("user").find({ _id: { $in: ids } }, { projection: { name: 1, email: 1 } }).toArray();
  return new Map(users.map((user) => [user._id.toHexString(), { name: user.name ?? "", email: user.email ?? "" }]));
}

/** Membres de l'espace, et invitations en attente pour qui peut gérer l'équipe. */
export async function getTeam(db: Db, access: WorkspaceAccess, now = new Date()): Promise<{ members: TeamMember[]; invitations: PendingInvitation[] }> {
  assertPermission(access, "workspace:read");
  const c = collections(db);
  const memberships = await c.workspaceMembers.find({ workspaceId: access.workspace._id }).sort({ createdAt: 1 }).limit(200).toArray();
  const users = await usersById(db, memberships.map((member) => member.userId));
  const members = memberships.map((member) => ({
    userId: member.userId,
    name: users.get(member.userId)?.name || "Sans nom",
    email: users.get(member.userId)?.email ?? "",
    role: member.role,
    joinedAt: member.createdAt,
  }));
  const canManage = access.role === "owner" || access.role === "admin";
  const invitations = canManage
    ? (await c.workspaceInvitations.find({ workspaceId: access.workspace._id, expiresAt: { $gt: now } }).sort({ createdAt: 1 }).toArray()).map((invitation) => ({
        id: invitation._id.toHexString(),
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      }))
    : [];
  return { members, invitations };
}

/**
 * Invite une personne par e-mail. Le lien (à usage unique, 7 jours) n'est jamais stocké en clair.
 * La limite de l'offre compte les membres et les invitations en attente.
 */
export async function inviteMember(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  input: unknown,
  deps: { sendEmail: EmailSender; appUrl: string; inviterName: string },
  now = new Date(),
): Promise<void> {
  assertPermission(access, "members:manage");
  const parsed = invitationSchema.safeParse(input);
  if (!parsed.success) throw new UserFacingError(parsed.error.issues[0]?.message ?? "Invitation invalide.", "invalid_input");
  const { email, role } = parsed.data;
  // Seul le propriétaire peut nommer un administrateur.
  if (role === "admin" && access.role !== "owner") throw new UserFacingError("Seul le propriétaire peut inviter un administrateur.", "forbidden");
  const c = collections(db);

  const existingUser = await db.collection<{ _id: ObjectId }>("user").findOne({ email }, { projection: { _id: 1 } });
  if (existingUser && (await c.workspaceMembers.findOne({ workspaceId: access.workspace._id, userId: existingUser._id.toHexString() }))) {
    throw new UserFacingError("Cette personne fait déjà partie de l'espace.", "conflict");
  }
  const { limits } = await getEffectivePlan(db, access.workspace);
  const members = await c.workspaceMembers.countDocuments({ workspaceId: access.workspace._id });
  const pending = await c.workspaceInvitations.countDocuments({ workspaceId: access.workspace._id, email: { $ne: email }, expiresAt: { $gt: now } });
  if (members + pending + 1 > limits.maxMembers) {
    throw new UserFacingError(
      `Votre offre permet ${limits.maxMembers} personne${limits.maxMembers > 1 ? "s" : ""} dans l'espace (invitations en attente comprises). Passez à une offre supérieure pour agrandir l'équipe.`,
      "limit_reached",
    );
  }

  const token = randomBytes(32).toString("base64url");
  await c.workspaceInvitations.updateOne(
    { workspaceId: access.workspace._id, email },
    {
      $set: { role, tokenHash: hashToken(token), invitedByUserId: userId, expiresAt: new Date(now.getTime() + INVITATION_TTL_DAYS * 86_400_000), createdAt: now },
      $setOnInsert: { _id: new ObjectId() },
    },
    { upsert: true },
  );
  await deps.sendEmail({
    to: email,
    subject: `${deps.inviterName} vous invite dans « ${access.workspace.name} »`,
    text:
      `Bonjour,\n\n${deps.inviterName} vous invite à rejoindre l'espace « ${access.workspace.name} » sur Studio Marketing IA, ` +
      `en tant que ${ROLE_LABELS[role].label.toLowerCase()} (${ROLE_LABELS[role].description.toLowerCase()}).\n\n` +
      `Pour accepter, ouvrez ce lien (valable ${INVITATION_TTL_DAYS} jours) :\n${deps.appUrl}/invitation/${token}\n\n` +
      `Si vous n'attendiez pas cette invitation, ignorez simplement ce message.`,
  });
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "team.invited", metadata: { role } });
}

export async function revokeInvitation(db: Db, access: WorkspaceAccess, userId: string, invitationId: string): Promise<void> {
  assertPermission(access, "members:manage");
  if (!ObjectId.isValid(invitationId)) throw new UserFacingError("Invitation introuvable.", "not_found");
  const result = await collections(db).workspaceInvitations.deleteOne({ _id: new ObjectId(invitationId), workspaceId: access.workspace._id });
  if (result.deletedCount === 0) throw new UserFacingError("Invitation introuvable.", "not_found");
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "team.invitation_revoked" });
}

/** Ce qu'affiche la page d'invitation (le jeton fait office de secret). */
export async function describeInvitation(db: Db, token: string, now = new Date()) {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  const invitation = await collections(db).workspaceInvitations.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: now } });
  if (!invitation) return null;
  const workspace = await collections(db).workspaces.findOne({ _id: invitation.workspaceId }, { projection: { name: 1 } });
  if (!workspace) return null;
  const inviter = (await usersById(db, [invitation.invitedByUserId])).get(invitation.invitedByUserId);
  return { workspaceName: workspace.name, email: invitation.email, role: invitation.role, inviterName: inviter?.name || null };
}

/**
 * Accepte une invitation : l'adresse du compte connecté doit être celle invitée (et vérifiée).
 * Retourne l'espace rejoint.
 */
export async function acceptInvitation(
  db: Db,
  user: { id: string; email: string; emailVerified: boolean },
  token: string,
  now = new Date(),
): Promise<ObjectId> {
  const c = collections(db);
  const invitation = typeof token === "string" ? await c.workspaceInvitations.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: now } }) : null;
  if (!invitation) throw new UserFacingError("Cette invitation a expiré ou a déjà été utilisée.", "not_found");
  if (!user.emailVerified) throw new UserFacingError("Confirmez d'abord votre adresse e-mail.", "forbidden");
  if (user.email.trim().toLowerCase() !== invitation.email) {
    throw new UserFacingError(`Cette invitation est destinée à ${invitation.email}. Connectez-vous avec cette adresse.`, "forbidden");
  }
  // Usage unique, même en cas de double clic.
  const consumed = await c.workspaceInvitations.findOneAndDelete({ _id: invitation._id });
  if (!consumed) throw new UserFacingError("Cette invitation a déjà été utilisée.", "conflict");

  const existing = await c.workspaceMembers.findOne({ workspaceId: invitation.workspaceId, userId: user.id });
  if (!existing) {
    await c.workspaceMembers.insertOne({ _id: new ObjectId(), workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role, createdAt: now, updatedAt: now });
    await recordAudit(db, { workspaceId: invitation.workspaceId, actorUserId: user.id, action: "team.joined", metadata: { role: invitation.role } });
  }
  return invitation.workspaceId;
}

async function findOtherMember(db: Db, access: WorkspaceAccess, userId: string, memberUserId: string) {
  if (memberUserId === userId) throw new UserFacingError("Vous ne pouvez pas modifier votre propre rôle.", "forbidden");
  const member = await collections(db).workspaceMembers.findOne({ workspaceId: access.workspace._id, userId: memberUserId });
  if (!member) throw new UserFacingError("Membre introuvable.", "not_found");
  if (member.role === "owner") throw new UserFacingError("Le propriétaire de l'espace ne peut pas être modifié.", "forbidden");
  // Un administrateur ne gère pas les autres administrateurs : c'est le rôle du propriétaire.
  if (member.role === "admin" && access.role !== "owner") throw new UserFacingError("Seul le propriétaire peut modifier un administrateur.", "forbidden");
  return member;
}

export async function changeMemberRole(db: Db, access: WorkspaceAccess, userId: string, memberUserId: string, rawRole: unknown): Promise<void> {
  assertPermission(access, "members:manage");
  const role = INVITABLE_ROLES.find((item) => item === rawRole);
  if (!role) throw new UserFacingError("Rôle invalide.", "invalid_input");
  if (role === "admin" && access.role !== "owner") throw new UserFacingError("Seul le propriétaire peut nommer un administrateur.", "forbidden");
  const member = await findOtherMember(db, access, userId, memberUserId);
  await collections(db).workspaceMembers.updateOne({ _id: member._id }, { $set: { role, updatedAt: new Date() } });
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "team.role_changed", metadata: { role } });
}

export async function removeMember(db: Db, access: WorkspaceAccess, userId: string, memberUserId: string): Promise<void> {
  assertPermission(access, "members:manage");
  const member = await findOtherMember(db, access, userId, memberUserId);
  await collections(db).workspaceMembers.deleteOne({ _id: member._id });
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "team.removed" });
}

/** Quitter un espace dont on n'est pas propriétaire. */
export async function leaveWorkspace(db: Db, access: WorkspaceAccess, userId: string): Promise<void> {
  if (access.role === "owner") throw new UserFacingError("Le propriétaire ne peut pas quitter son espace.", "forbidden");
  await collections(db).workspaceMembers.deleteOne({ workspaceId: access.workspace._id, userId });
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "team.left" });
}

/** Active ou non la validation des publications avant leur programmation. */
export async function setApprovalRequired(db: Db, access: WorkspaceAccess, userId: string, value: boolean): Promise<void> {
  assertPermission(access, "workspace:manage");
  await collections(db).workspaces.updateOne({ _id: access.workspace._id }, { $set: { approvalRequired: value === true, updatedAt: new Date() } });
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "workspace.approval_setting", metadata: { value: value === true } });
}

/** Adresses des personnes qui peuvent valider les publications de l'espace (notification des demandes). */
export async function approverEmails(db: Db, workspaceId: ObjectId): Promise<string[]> {
  const members = await collections(db).workspaceMembers.find({ workspaceId, role: { $in: ["owner", "admin", "client"] } }).toArray();
  const users = await usersById(db, members.map((member) => member.userId));
  return [...users.values()].map((user) => user.email).filter(Boolean);
}
