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
    <div className="relative md:flex">
      {/* Halo discret en haut de page, comme sur le site. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(50%_100%_at_60%_0%,rgb(255_122_69/0.09),transparent)]" />
      <Sidebar userName={user.name} workspaceName={workspace.name} unreadAlerts={unreadAlerts} />
      <main className="relative min-w-0 flex-1 px-4 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
