"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { acceptAiConsentAction } from "@/server/actions/studio";

/** Information et accord avant le premier envoi de données à un fournisseur d'IA externe (RGPD). */
export function AiConsent({
  providerLabel,
  dataProcessor,
  canAccept,
}: {
  providerLabel: string;
  dataProcessor: string;
  canAccept: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">Avant de commencer</h2>
      <p className="text-sm">
        Pour rédiger vos publications, les informations de votre marque et votre demande sont envoyées à{" "}
        <strong>{providerLabel}</strong>, un service d&apos;intelligence artificielle opéré par {dataProcessor}.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
        <li>Seules les informations nécessaires à la rédaction sont envoyées.</li>
        <li>Nous n&apos;utilisons pas vos contenus pour entraîner des modèles d&apos;IA.</li>
        <li>Vous pouvez supprimer vos données à tout moment depuis les paramètres.</li>
      </ul>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {canAccept ? (
        <Button
          disabled={pending}
          onClick={async () => {
            setPending(true);
            const result = await acceptAiConsentAction();
            setPending(false);
            if (!result.ok) setError(result.error);
          }}
        >
          {pending ? "Enregistrement…" : "J'ai compris, j'accepte"}
        </Button>
      ) : (
        <Alert>Seul un administrateur de l&apos;espace peut donner cet accord.</Alert>
      )}
    </Card>
  );
}
