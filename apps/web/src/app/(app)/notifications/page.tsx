import type { Metadata } from "next";
import Link from "next/link";
import { MarkReadButton } from "@/components/social/account-buttons";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { getDb } from "@/server/db/client";
import { listNotifications } from "@/server/services/notifications";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Alertes" };

export default async function NotificationsPage() {
  const access = await requireWorkspace();
  const notifications = await listNotifications(getDb(), access);
  const format = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Alertes</h1>
        {notifications.some((n) => !n.readAt) ? <MarkReadButton /> : null}
      </header>
      {notifications.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Aucune alerte. Vous serez prévenu ici et par e-mail si une publication échoue.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {notifications.map((notification) => (
            <li key={notification._id.toHexString()}>
              <Card className={cn("space-y-1", !notification.readAt && "border-danger/40")}>
                <p className="text-sm font-medium">{notification.title}</p>
                <p className="text-sm text-muted">{notification.body}</p>
                <p className="text-xs text-muted">
                  {format.format(notification.createdAt)}
                  {notification.link ? (
                    <>
                      {" · "}
                      <Link href={notification.link} className="text-primary hover:underline">
                        Voir
                      </Link>
                    </>
                  ) : null}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
