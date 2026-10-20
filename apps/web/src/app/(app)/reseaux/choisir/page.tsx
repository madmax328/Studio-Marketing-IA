import type { Metadata } from "next";
import Link from "next/link";
import { SOCIAL_NETWORKS } from "@smia/shared";
import { ConnectionChooser } from "@/components/social/connection-chooser";
import { Alert, Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { UserFacingError } from "@/server/services/errors";
import { getPendingConnection } from "@/server/services/social-connections";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Choisir les comptes" };

export default async function ChooseAccountsPage({ searchParams }: PageProps<"/reseaux/choisir">) {
  const { demande } = await searchParams;
  const access = await requireWorkspace();
  const pending =
    typeof demande === "string"
      ? await getPendingConnection(getDb(), access, access.userId, demande).catch((error: unknown) => {
          if (error instanceof UserFacingError) return error;
          throw error;
        })
      : null;

  return (
    <div className="space-y-6">
      <Link href="/reseaux" className="text-sm text-primary hover:underline">
        ← Réseaux sociaux
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">Choisir les comptes à connecter</h1>
        <p className="text-sm text-muted">
          Voici les comptes que vous avez autorisés. Cochez ceux sur lesquels Studio Marketing IA pourra publier.
        </p>
      </header>
      {!pending || pending instanceof UserFacingError ? (
        <Alert tone="error">
          {pending instanceof UserFacingError ? pending.message : "Demande de connexion introuvable."}{" "}
          <Link href="/reseaux" className="underline">
            Recommencer
          </Link>
        </Alert>
      ) : (
        <Card className="space-y-4">
          <p className="text-sm text-muted">
            Comptes connectés : {pending.used} sur {pending.limit} permis par votre offre (comptes de test non compris).
          </p>
          <ConnectionChooser
            stateId={demande as string}
            freeSlots={Math.max(0, pending.limit - pending.used)}
            candidates={pending.candidates.map((candidate) => ({
              key: candidate.key,
              networkLabel: SOCIAL_NETWORKS[candidate.network].label,
              displayName: candidate.displayName,
              alreadyConnected: candidate.alreadyConnected,
            }))}
          />
        </Card>
      )}
    </div>
  );
}
