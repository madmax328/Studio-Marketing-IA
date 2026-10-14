import type { Metadata } from "next";
import { SOCIAL_NETWORK_IDS, SOCIAL_NETWORKS, type IntegrationStatus } from "@smia/shared";
import { Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { collections } from "@/server/db/collections";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Réseaux sociaux" };

const STATUS_LABELS: Record<IntegrationStatus, string> = {
  planned: "Intégration en préparation",
  in_development: "Intégration en test",
  available: "Disponible",
};

export default async function NetworksPage() {
  const access = await requireWorkspace();
  const accounts = await collections(getDb())
    .socialAccounts.find({ workspaceId: access.workspace._id }, { projection: { network: 1, status: 1, displayName: 1 } })
    .limit(100)
    .toArray();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Réseaux sociaux</h1>
        <p className="text-sm text-muted">
          Les connexions passent toujours par la page officielle de chaque réseau : nous ne vous demanderons jamais votre
          mot de passe.
        </p>
      </header>

      <ul className="grid gap-4 md:grid-cols-2">
        {SOCIAL_NETWORK_IDS.map((id) => {
          const network = SOCIAL_NETWORKS[id];
          const connected = accounts.filter((account) => account.network === id);
          return (
            <li key={id}>
              <Card className="h-full space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{network.label}</h2>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                    {STATUS_LABELS[network.integrationStatus]}
                  </span>
                </div>
                <p className="text-sm">
                  {connected.length === 0
                    ? "Non connecté"
                    : connected.map((account) => `${account.displayName} (${account.status})`).join(", ")}
                </p>
                <details className="text-sm text-muted">
                  <summary className="cursor-pointer">Conditions de l&apos;API officielle</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {network.approvalRequirements.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                </details>
                <button
                  type="button"
                  disabled={network.integrationStatus !== "available"}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {network.integrationStatus === "available" ? "Connecter" : "Connexion bientôt disponible"}
                </button>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
