"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { switchWorkspaceAction } from "@/server/actions/team";
import type { WorkspaceSummary } from "@/server/services/client-spaces";

/** Choix de l'espace de travail (espace personnel, espaces clients, espaces où l'on est invité). */
export function WorkspaceSwitcher({ workspaces, activeId }: { workspaces: WorkspaceSummary[]; activeId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <label className="sr-only" htmlFor="workspace-switcher">
        Espace de travail
      </label>
      <select
        id="workspace-switcher"
        value={activeId}
        disabled={pending}
        onChange={(event) => {
          const id = event.target.value;
          setError(null);
          startTransition(async () => {
            const result = await switchWorkspaceAction(id);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push("/tableau-de-bord");
            router.refresh();
          });
        }}
        className="w-full truncate rounded-lg border border-border bg-black/30 px-2.5 py-1.5 text-xs text-foreground transition hover:border-border-strong focus-visible:border-primary/60 focus-visible:outline-none"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.client ? `Client · ${workspace.name}` : workspace.name}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
