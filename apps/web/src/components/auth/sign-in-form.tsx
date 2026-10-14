"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
      callbackURL: "/tableau-de-bord",
    });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    router.push("/tableau-de-bord");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-xl font-semibold">Connexion</h1>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <TextField label="Adresse e-mail" name="email" type="email" autoComplete="email" required />
      <TextField label="Mot de passe" name="password" type="password" autoComplete="current-password" required />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/mot-de-passe-oublie" className="text-primary hover:underline">
          Mot de passe oublié ?
        </Link>
        <Link href="/inscription" className="text-primary hover:underline">
          Créer un compte
        </Link>
      </div>
    </form>
  );
}
