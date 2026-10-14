"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <div className="space-y-3">
        <Alert tone="error">Ce lien de réinitialisation est invalide ou a expiré.</Alert>
        <Link href="/mot-de-passe-oublie" className="text-sm text-primary hover:underline">
          Faire une nouvelle demande
        </Link>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirmation"))) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token: token ?? "" });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-3">
        <Alert tone="success">Votre mot de passe a été modifié. Vos autres sessions ont été déconnectées.</Alert>
        <Link href="/connexion" className="text-sm text-primary hover:underline">
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-xl font-semibold">Nouveau mot de passe</h1>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <TextField label="Nouveau mot de passe" name="password" type="password" autoComplete="new-password" minLength={10} required />
      <TextField label="Confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={10} required />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
