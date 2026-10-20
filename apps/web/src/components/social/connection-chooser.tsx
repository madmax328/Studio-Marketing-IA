"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { confirmConnectionAction } from "@/server/actions/social";

export interface ChooserCandidate {
  key: string;
  networkLabel: string;
  displayName: string;
  alreadyConnected: boolean;
}

/** Choix des comptes à connecter parmi ceux que l'utilisateur a autorisés sur le réseau. */
export function ConnectionChooser({ stateId, candidates, freeSlots }: { stateId: string; candidates: ChooserCandidate[]; freeSlots: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Présélection : les comptes déjà connectés (reconnexion), puis les nouveaux dans la limite de l'offre.
  const [selected, setSelected] = useState<Set<string>>(() => {
    let slots = freeSlots;
    return new Set(
      candidates
        .filter((candidate) => {
          if (candidate.alreadyConnected) return true;
          if (slots <= 0) return false;
          slots -= 1;
          return true;
        })
        .map((candidate) => candidate.key),
    );
  });
  const newCount = candidates.filter((candidate) => selected.has(candidate.key) && !candidate.alreadyConnected).length;

  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        start(async () => {
          const result = await confirmConnectionAction(stateId, [...selected]);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(`/reseaux?connexion=ok&comptes=${result.data.connected}`);
          router.refresh();
        });
      }}
    >
      <ul className="space-y-2">
        {candidates.map((candidate) => (
          <li key={candidate.key}>
            <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
              <input type="checkbox" checked={selected.has(candidate.key)} onChange={() => toggle(candidate.key)} />
              <span className="flex-1">
                <span className="font-medium">{candidate.displayName}</span>
                <span className="block text-xs text-muted">
                  {candidate.networkLabel}
                  {candidate.alreadyConnected ? " · déjà connecté (l'autorisation sera renouvelée)" : ""}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {newCount > freeSlots ? (
        <Alert tone="error">
          Votre offre permet encore {freeSlots} nouveau{freeSlots > 1 ? "x" : ""} compte{freeSlots > 1 ? "s" : ""} : décochez-en{" "}
          {newCount - freeSlots} ou passez à une offre supérieure.
        </Alert>
      ) : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || selected.size === 0 || newCount > freeSlots}>
          {pending ? "Connexion…" : `Connecter ${selected.size} compte${selected.size > 1 ? "s" : ""}`}
        </Button>
        <Link href="/reseaux" className="text-sm text-muted hover:underline">
          Annuler
        </Link>
      </div>
    </form>
  );
}
