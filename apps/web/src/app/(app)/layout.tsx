import type { ReactNode } from "react";
import { Sidebar } from "@/components/app/sidebar";
import { getDb } from "@/server/db/client";
import { countUnreadNotifications } from "@/server/services/notifications";
import { requireUser, requireWorkspace } from "@/server/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const access = await requireWorkspace();
  const { workspace } = access;
  const unreadAlerts = await countUnreadNotifications(getDb(), access);

  return (
    <div className="md:flex">
      <Sidebar userName={user.name} workspaceName={workspace.name} unreadAlerts={unreadAlerts} />
      <main className="flex-1 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
