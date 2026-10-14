"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

export function ResendVerificationForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.sendVerificationEmail({
      email: String(form.get("email")),
      callbackURL: "/tableau-de-bord",
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
      <h1 className="text-xl font-semibold">Confirmez votre adresse e-mail</h1>
      <p className="text-sm text-muted">
        Votre compte doit être confirmé avant de pouvoir l&apos;utiliser. Indiquez votre adresse pour recevoir un nouveau
        lien.
      </p>
      {done ? <Alert tone="success">Si cette adresse correspond à un compte, un nouveau lien a été envoyé.</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <TextField label="Adresse e-mail" name="email" type="email" autoComplete="email" required />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Envoi…" : "Renvoyer le lien"}
      </Button>
      <Link href="/connexion" className="block text-center text-sm text-primary hover:underline">
        Retour à la connexion
      </Link>
    </form>
  );
}
