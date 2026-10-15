import type { Metadata } from "next";
import { roleHasPermission, SOCIAL_NETWORK_IDS, SOCIAL_NETWORKS, type IntegrationStatus } from "@smia/shared";
import { ConnectSimulationButton, DisconnectButton } from "@/components/social/account-buttons";
import { Alert, Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { listSocialAccounts } from "@/server/services/social-accounts";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Réseaux sociaux" };

const STATUS_LABELS: Record<IntegrationStatus, string> = {
  planned: "Connexion réelle en préparation",
  in_development: "Connexion réelle en test",
  available: "Disponible",
};

const ACCOUNT_STATUS: Record<string, string> = {
  connected: "Connecté",
  expired: "Autorisation expirée",
  revoked: "Autorisation retirée",
  error: "Erreur",
};

const dateTime = (date: Date | null) =>
  date ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(date) : null;

export default async function NetworksPage() {
  const access = await requireWorkspace();
  const accounts = await listSocialAccounts(getDb(), access);
  const env = getServerEnv();
  const simulationEnabled = env.SOCIAL_SIMULATION_ENABLED === "true";
  const canConnect = roleHasPermission(access.role, "social:connect");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Réseaux sociaux</h1>
        <p className="text-sm text-muted">
          Les connexions passent toujours par la page officielle de chaque réseau : nous ne vous demanderons jamais votre
          mot de passe.
        </p>
      </header>

      {simulationEnabled ? (
        <Alert>
          Mode test : un « compte de test » permet d&apos;essayer toute la chaîne de publication. Les publications sont
          marquées « Simulée » et <strong>rien n&apos;est envoyé sur le réseau</strong>.
        </Alert>
      ) : null}
      {!env.CRON_SECRET ? (
        <Alert tone="error">
          L&apos;envoi automatique n&apos;est pas encore activé sur cette installation (planificateur non configuré) : les
          publications programmées ne partiront pas.
        </Alert>
      ) : null}

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

                {connected.length === 0 ? (
                  <p className="text-sm text-muted">Non connecté</p>
                ) : (
                  <ul className="space-y-2">
                    {connected.map((account) => (
                      <li key={account._id.toHexString()} className="rounded-lg border border-border p-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{account.displayName}</span>
                          {canConnect ? <DisconnectButton accountId={account._id.toHexString()} label={account.displayName} /> : null}
                        </div>
                        <p className={account.status === "connected" ? "text-xs text-success" : "text-xs text-danger"}>
                          {ACCOUNT_STATUS[account.status] ?? account.status}
                          {account.tokenExpiresAt ? ` · expire le ${dateTime(account.tokenExpiresAt)}` : ""}
                          {account.lastCheckedAt ? ` · vérifié le ${dateTime(account.lastCheckedAt)}` : ""}
                        </p>
                        {account.scopes.length > 0 ? (
                          <p className="text-xs text-muted">Autorisations : {account.scopes.join(", ")}</p>
                        ) : null}
                        {account.lastError ? <p className="text-xs text-danger">{account.lastError}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}

                <details className="text-sm text-muted">
                  <summary className="cursor-pointer">Conditions de l&apos;API officielle</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {network.approvalRequirements.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                </details>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled
                    className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Connexion réelle bientôt disponible
                  </button>
                  {simulationEnabled && canConnect && !connected.some((a) => a.provider === "simulation") ? (
                    <ConnectSimulationButton network={id} />
                  ) : null}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
