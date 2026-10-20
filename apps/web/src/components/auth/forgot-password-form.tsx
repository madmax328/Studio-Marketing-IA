"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email: String(form.get("email")),
      redirectTo: "/reinitialiser-mot-de-passe",
    });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    setDone(true);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">Mot de passe oublié</h1>
      {done ? (
        <Alert tone="success">
          Si un compte existe avec cette adresse, un lien de réinitialisation vient d&apos;être envoyé.
        </Alert>
      ) : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <TextField label="Adresse e-mail" name="email" type="email" autoComplete="email" required />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Envoi…" : "Recevoir un lien"}
      </Button>
      <Link href="/connexion" className="block text-center text-sm text-primary hover:underline">
        Retour à la connexion
      </Link>
    </form>
  );
}
