"use client";

import { Button } from "@/components/ui/button";

/** Page affichée lorsqu'une erreur inattendue survient côté serveur (base indisponible, etc.). */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Le service est momentanément indisponible</h1>
        <p className="text-sm text-muted">
          Une erreur est survenue de notre côté. Réessayez dans quelques instants ; si le problème persiste,
          contactez-nous.
        </p>
        <Button onClick={reset}>Réessayer</Button>
      </div>
    </main>
  );
}
