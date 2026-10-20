import type { Metadata } from "next";
import { roleHasPermission, SOCIAL_NETWORK_IDS, SOCIAL_NETWORKS, type IntegrationStatus } from "@smia/shared";
import { ConnectSimulationButton, DisconnectButton } from "@/components/social/account-buttons";
import { buttonStyles } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { listSocialAccounts } from "@/server/services/social-accounts";
import { requireWorkspace } from "@/server/session";
import { getOAuthProvider } from "@/server/social";
import { NETWORK_OAUTH_PROVIDER } from "@/server/social/oauth";

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

/** Résultat d'une tentative de connexion (paramètre `connexion` de l'adresse). */
const CONNECTION_MESSAGES: Record<string, { tone: "success" | "error" | "info"; text: string }> = {
  annulee: { tone: "info", text: "Connexion annulée sur la page du réseau : aucun compte n'a été ajouté." },
  expiree: { tone: "error", text: "La demande de connexion a expiré ou n'a pas pu être vérifiée. Recommencez." },
  indisponible: { tone: "error", text: "La connexion à ce réseau n'est pas encore activée sur cette installation." },
  limite: { tone: "error", text: "Votre offre ne permet pas de connecter un compte de plus. Déconnectez un compte ou passez à une offre supérieure." },
  interdit: { tone: "error", text: "Votre rôle ne permet pas de connecter des comptes." },
  "aucune-page": {
    tone: "error",
    text: "Aucune Page Facebook n'a été partagée. Recommencez en cochant au moins une Page (et le compte Instagram qui lui est lié).",
  },
  echec: {
    tone: "error",
    text: "Le réseau a refusé la connexion. Réessayez ; si le problème continue, vérifiez que votre compte remplit les conditions indiquées sur la carte du réseau.",
  },
  inconnu: { tone: "error", text: "Réseau inconnu." },
};

const dateTime = (date: Date | null) =>
  date ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(date) : null;

export default async function NetworksPage({ searchParams }: PageProps<"/reseaux">) {
  const { connexion, comptes } = await searchParams;
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

      {connexion === "ok" ? (
        <Alert tone="success">
          {comptes === "1" ? "Compte connecté." : `${typeof comptes === "string" ? comptes : ""} comptes connectés.`} Les
          publications programmées sur ce réseau partiront avec ce compte.
        </Alert>
      ) : typeof connexion === "string" && CONNECTION_MESSAGES[connexion] ? (
        <Alert tone={CONNECTION_MESSAGES[connexion].tone}>{CONNECTION_MESSAGES[connexion].text}</Alert>
      ) : null}

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
          const provider = NETWORK_OAUTH_PROVIDER[id];
          const connectUrl = provider && getOAuthProvider(provider) ? `/api/reseaux/connexion/${provider}` : null;
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
                        {account.status !== "connected" && account.provider !== "simulation" && connectUrl && canConnect ? (
                          <a href={connectUrl} className="text-xs text-primary hover:underline">
                            Reconnecter
                          </a>
                        ) : null}
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
                  {connectUrl && canConnect ? (
                    // Lien classique (pas de navigation côté client) : la route redirige vers le site du réseau.
                    <a href={connectUrl} className={buttonStyles("secondary")}>
                      {provider === "meta" ? "Connecter Facebook / Instagram" : `Connecter ${network.label}`}
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {connectUrl ? "Connexion réservée aux administrateurs" : "Connexion réelle bientôt disponible"}
                    </button>
                  )}
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
