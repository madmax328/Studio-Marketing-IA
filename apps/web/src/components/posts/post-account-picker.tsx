"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setPostAccountAction } from "@/server/actions/social";

export interface AccountChoice {
  id: string;
  label: string;
}

/** Compte utilisé pour l'envoi, à choisir quand plusieurs comptes du réseau sont connectés. */
export function PostAccountPicker({
  postId,
  accounts,
  selected,
  editable,
}: {
  postId: string;
  accounts: AccountChoice[];
  selected: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState(selected ?? "");

  return (
    <div className="space-y-1">
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Compte utilisé pour l&apos;envoi</span>
        <select
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          value={value}
          disabled={!editable || pending}
          onChange={(event) => {
            const next = event.target.value;
            setValue(next);
            setError(null);
            start(async () => {
              const result = await setPostAccountAction(postId, next || null);
              if (!result.ok) setError(result.error);
              router.refresh();
            });
          }}
        >
          <option value="">{accounts.length === 1 ? `Automatique (${accounts[0]?.label ?? ""})` : "Choisissez un compte"}</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
