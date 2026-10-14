"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

const CONFIRMATION_WORD = "SUPPRIMER";

export function DeleteAccount() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("confirmation") !== CONFIRMATION_WORD) {
      setError(`Tapez ${CONFIRMATION_WORD} pour confirmer.`);
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await authClient.deleteUser({ password: String(form.get("password")) });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    router.push("/connexion");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm text-muted">
        La suppression est définitive : votre compte, vos marques, vos publications et vos connexions sociales seront
        effacés.
      </p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <TextField label="Mot de passe" name="password" type="password" autoComplete="current-password" required />
      <TextField label={`Tapez ${CONFIRMATION_WORD} pour confirmer`} name="confirmation" required autoComplete="off" />
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Suppression…" : "Supprimer définitivement mon compte"}
      </Button>
    </form>
  );
}
