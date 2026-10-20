"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setBenchmarkSharingAction } from "@/server/actions/social";

/** Participation de l'espace aux repères anonymes (retrait possible à tout moment). */
export function BenchmarkSharingToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending}
          className="mt-0.5 size-4 accent-[var(--primary)]"
          onChange={(event) => {
            const value = event.target.checked;
            start(async () => {
              setError(null);
              const result = await setBenchmarkSharingAction(value);
              if (!result.ok) setError(result.error);
              router.refresh();
            });
          }}
        />
        <span>
          Participer aux repères anonymes
          <span className="block text-xs text-muted">En vous retirant, vos résultats ne sont plus comptés et vous ne voyez plus les repères.</span>
        </span>
      </label>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
