import { ObjectId, type Db } from "mongodb";
import { SOCIAL_NETWORKS } from "@smia/shared";
import { collections, type NotificationDoc, type PostDoc, type SocialAccountDoc } from "@/server/db/collections";
import type { Notifier } from "@/server/publishing/dispatcher";
import type { ExpiryNotifier } from "@/server/publishing/tokens";
import { assertPermission } from "@/server/services/permissions";
import { approverEmails } from "@/server/services/team";
import type { WorkspaceAccess } from "@/server/services/workspaces";

type EmailSender = (message: { to: string; subject: string; text: string }) => Promise<void>;

async function ownerEmail(db: Db, workspaceId: ObjectId): Promise<string | null> {
  const workspace = await collections(db).workspaces.findOne({ _id: workspaceId }, { projection: { ownerUserId: 1 } });
  if (!workspace || !ObjectId.isValid(workspace.ownerUserId)) return null;
  const user = await db.collection<{ email?: string }>("user").findOne({ _id: new ObjectId(workspace.ownerUserId) });
  return user?.email ?? null;
}

async function createNotification(db: Db, notification: Omit<NotificationDoc, "_id" | "readAt" | "createdAt">) {
  await collections(db).notifications.insertOne({ ...notification, _id: new ObjectId(), readAt: null, createdAt: new Date() });
}

/** Notifications des échecs : dans l'application, et par e-mail au propriétaire de l'espace (au mieux). */
export function createNotifier(db: Db, sendEmail: EmailSender, appUrl: string): Notifier & ExpiryNotifier {
  async function email(workspaceId: ObjectId, subject: string, text: string) {
    try {
      const to = await ownerEmail(db, workspaceId);
      if (to) await sendEmail({ to, subject, text });
    } catch (error) {
      // L'échec de l'e-mail ne doit pas bloquer la file ; la notification reste visible dans l'application.
      console.error("Envoi de l'e-mail de notification impossible", error instanceof Error ? error.message : error);
    }
  }

  return {
    async publishFailed(post: PostDoc, reason: string) {
      const network = SOCIAL_NETWORKS[post.network].label;
      const link = `/publications/${post._id.toHexString()}`;
      await createNotification(db, {
        workspaceId: post.workspaceId,
        kind: "publish_failed",
        title: `Publication ${network} non envoyée`,
        body: reason,
        link,
      });
      await email(
        post.workspaceId,
        `Publication ${network} non envoyée`,
        `Bonjour,\n\nUne publication ${network} n'a pas pu être envoyée.\n\nRaison : ${reason}\n\nVoir la publication : ${appUrl}${link}`,
      );
    },
    async accountExpired(account: SocialAccountDoc) {
      const network = SOCIAL_NETWORKS[account.network].label;
      await createNotification(db, {
        workspaceId: account.workspaceId,
        kind: "account_expired",
        title: `Compte ${network} à reconnecter`,
        body: `L'autorisation du compte ${account.displayName} a expiré ou a été retirée. Reconnectez-le pour que vos publications partent.`,
        link: "/reseaux",
      });
      await email(
        account.workspaceId,
        `Compte ${network} à reconnecter`,
        `Bonjour,\n\nL'autorisation du compte ${network} « ${account.displayName} » a expiré. Reconnectez-le : ${appUrl}/reseaux`,
      );
    },
    async accountExpiring(account: SocialAccountDoc) {
      const network = SOCIAL_NETWORKS[account.network].label;
      const date = account.tokenExpiresAt
        ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(account.tokenExpiresAt)
        : "bientôt";
      await createNotification(db, {
        workspaceId: account.workspaceId,
        kind: "account_expiring",
        title: `Compte ${network} à reconnecter avant le ${date}`,
        body: `${network} limite la durée de l'autorisation du compte ${account.displayName}. Reconnectez-le avant le ${date} pour que vos publications continuent de partir.`,
        link: "/reseaux",
      });
      await email(
        account.workspaceId,
        `Compte ${network} à reconnecter avant le ${date}`,
        `Bonjour,\n\n${network} limite la durée de l'autorisation du compte « ${account.displayName} ». Reconnectez-le avant le ${date} : ${appUrl}/reseaux`,
      );
    },
  };
}

export async function listNotifications(db: Db, access: WorkspaceAccess, limit = 50): Promise<NotificationDoc[]> {
  assertPermission(access, "content:read");
  return collections(db)
    .notifications.find({ workspaceId: access.workspace._id })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .toArray();
}

export async function countUnreadNotifications(db: Db, access: WorkspaceAccess): Promise<number> {
  return collections(db).notifications.countDocuments({ workspaceId: access.workspace._id, readAt: null });
}

export async function markAllNotificationsRead(db: Db, access: WorkspaceAccess): Promise<void> {
  assertPermission(access, "content:read");
  await collections(db).notifications.updateMany(
    { workspaceId: access.workspace._id, readAt: null },
    { $set: { readAt: new Date() } },
  );
}

/** Prévient les personnes qui valident (dans l'application et par e-mail) qu'une publication les attend. */
export async function notifyApprovalRequested(db: Db, post: PostDoc, sendEmail: EmailSender, appUrl: string): Promise<void> {
  const network = SOCIAL_NETWORKS[post.network].label;
  const link = `/publications/${post._id.toHexString()}`;
  await createNotification(db, {
    workspaceId: post.workspaceId,
    kind: "approval_requested",
    title: `Publication ${network} à valider`,
    body: "Une publication attend votre validation avant de partir.",
    link,
  });
  const recipients = await approverEmails(db, post.workspaceId);
  for (const to of recipients) {
    try {
      await sendEmail({
        to,
        subject: `Publication ${network} à valider`,
        text: `Bonjour,\n\nUne publication ${network} attend votre validation avant d'être envoyée.\n\nLa relire et la valider : ${appUrl}${link}`,
      });
    } catch (error) {
      console.error("Envoi de l'e-mail de validation impossible", error instanceof Error ? error.message : error);
    }
  }
}

/** Informe l'auteur de la demande de la décision (validée ou refusée, avec la remarque). */
export async function notifyApprovalDecision(db: Db, post: PostDoc, sendEmail: EmailSender, appUrl: string): Promise<void> {
  const network = SOCIAL_NETWORKS[post.network].label;
  const approved = post.approval?.decision === "approved";
  const link = `/publications/${post._id.toHexString()}`;
  const comment = post.approval?.comment ? ` Remarque : ${post.approval.comment}` : "";
  const title = approved ? `Publication ${network} validée` : `Publication ${network} refusée`;
  const body = approved ? "Elle partira à l'heure prévue." : `Elle est revenue en brouillon.${comment}`;
  await createNotification(db, { workspaceId: post.workspaceId, kind: "approval_decided", title, body, link });
  const requester = post.approval?.requestedByUserId;
  if (!requester || !ObjectId.isValid(requester)) return;
  try {
    const user = await db.collection<{ email?: string }>("user").findOne({ _id: new ObjectId(requester) });
    if (user?.email) await sendEmail({ to: user.email, subject: title, text: `Bonjour,\n\n${title}. ${body}\n\nVoir la publication : ${appUrl}${link}` });
  } catch (error) {
    console.error("Envoi de l'e-mail de décision impossible", error instanceof Error ? error.message : error);
  }
}
