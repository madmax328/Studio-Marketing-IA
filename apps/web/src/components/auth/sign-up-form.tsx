"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

export function SignUpForm() {
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")),
      email,
      password: String(form.get("password")),
      callbackURL: "/tableau-de-bord",
    });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Vérifiez votre boîte e-mail</h1>
        <p className="text-sm text-muted">
          Un lien de confirmation a été envoyé à <strong>{sentTo}</strong>. Ouvrez-le pour activer votre compte.
        </p>
        <Link href="/verifier-email" className="text-sm text-primary hover:underline">
          Je n&apos;ai rien reçu
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">Créer un compte</h1>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <TextField label="Votre nom" name="name" autoComplete="name" required maxLength={100} />
      <TextField label="Adresse e-mail" name="email" type="email" autoComplete="email" required />
      <TextField
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint="Au moins 10 caractères."
      />
      <label className="flex items-start gap-2.5 text-sm text-muted">
        <input type="checkbox" name="terms" required className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" />
        <span>
          J&apos;accepte les{" "}
          <Link href="/conditions" target="_blank" className="text-primary hover:underline">
            conditions générales
          </Link>{" "}
          et la{" "}
          <Link href="/confidentialite" target="_blank" className="text-primary hover:underline">
            politique de confidentialité
          </Link>
          .
        </span>
      </label>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Création…" : "Créer mon compte"}
      </Button>
      <p className="text-center text-sm">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="text-primary hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
