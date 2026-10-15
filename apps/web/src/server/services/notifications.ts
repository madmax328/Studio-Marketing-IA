import { ObjectId, type Db } from "mongodb";
import { SOCIAL_NETWORKS } from "@smia/shared";
import { collections, type NotificationDoc, type PostDoc, type SocialAccountDoc } from "@/server/db/collections";
import type { Notifier } from "@/server/publishing/dispatcher";
import { assertPermission } from "@/server/services/permissions";
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
export function createNotifier(db: Db, sendEmail: EmailSender, appUrl: string): Notifier {
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
