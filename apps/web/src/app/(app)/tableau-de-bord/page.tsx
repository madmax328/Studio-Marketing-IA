import type { Metadata } from "next";
import Link from "next/link";
import { POST_STATUS_LABELS, SOCIAL_NETWORKS } from "@smia/shared";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { getAnalyticsOverview } from "@/server/services/analytics";
import { getDashboardData } from "@/server/services/dashboard";
import { listNotifications } from "@/server/services/notifications";
import { shouldAskForTestimonial } from "@/server/services/testimonials";
import { requireUser, requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Tableau de bord" };

function formatInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone }).format(date);
}

export default async function DashboardPage() {
  const access = await requireWorkspace();
  const user = await requireUser();
  const data = await getDashboardData(getDb(), access);
  const alerts = (await listNotifications(getDb(), access, 5)).filter((n) => !n.readAt);
  const isEmpty = data.brandCount === 0;
  const results = await getAnalyticsOverview(getDb(), access, { days: 30 });
  const askForTestimonial = await shouldAskForTestimonial(getDb(), access, user.id, new Date(user.createdAt));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Tableau de bord</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/studio" className={buttonStyles("secondary")}>
            Générer une publication
          </Link>
          <Link href="/campagnes/nouvelle" className={buttonStyles("primary")}>
            Créer une campagne
          </Link>
        </div>
      </header>

      {isEmpty ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Bienvenue ! Commençons par votre marque.</h2>
          <p className="text-sm text-muted">
            Décrivez votre activité une seule fois : l&apos;IA s&apos;appuiera sur ces informations pour créer toutes vos
            publications, sans jamais inventer de prix ni de promotion.
          </p>
          <Link href="/ma-marque/nouvelle" className={buttonStyles("primary")}>
            Créer ma marque
          </Link>
        </Card>
      ) : null}

      {alerts.length > 0 ? (
        <Card className="space-y-2 border-danger/40">
          <h2 className="font-semibold text-danger">À traiter</h2>
          <ul className="space-y-1 text-sm">
            {alerts.map((alert) => (
              <li key={alert._id.toHexString()}>
                <span className="font-medium">{alert.title}</span> — {alert.body}{" "}
                {alert.link ? (
                  <Link href={alert.link} className="text-primary hover:underline">
                    Voir
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
          <Link href="/notifications" className="text-sm text-primary hover:underline">
            Toutes les alertes
          </Link>
        </Card>
      ) : null}

      {askForTestimonial ? (
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Votre avis compte</h2>
            <p className="text-sm text-muted">Deux minutes pour nous dire ce que le studio vous apporte, et ce qu&apos;il faudrait améliorer.</p>
          </div>
          <Link href="/avis" className={buttonStyles("secondary")}>
            Donner mon avis
          </Link>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Programmées" value={data.postsByStatus.scheduled} />
        <Stat label="Publiées" value={data.postsByStatus.published} />
        <Stat label="Brouillons" value={data.postsByStatus.draft} />
        <Stat label="En échec" value={data.postsByStatus.failed} tone={data.postsByStatus.failed > 0 ? "danger" : undefined} />
      </div>

      {data.simulatedCount > 0 ? (
        <p className="text-xs text-muted">
          {data.simulatedCount} envoi(s) en mode simulation, non comptés comme publiés : rien n&apos;est parti sur les réseaux.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-semibold">Prochaines publications</h2>
          {data.upcomingPosts.length === 0 ? (
            <p className="text-sm text-muted">Aucune publication programmée pour le moment.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.upcomingPosts.map((post) => (
                <li key={post._id.toHexString()} className="py-2 text-sm">
                  <span className="font-medium">{SOCIAL_NETWORKS[post.network].label}</span>
                  {post.scheduledAt ? <span className="text-muted"> · {formatInTimeZone(post.scheduledAt, post.timeZone)}</span> : null}
                  <p className="truncate text-muted">{post.text}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted">
            Statut : {POST_STATUS_LABELS.scheduled.toLowerCase()} uniquement.{" "}
            <Link href="/calendrier" className="text-primary hover:underline">
              Ouvrir le calendrier
            </Link>
          </p>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">Résultats des 30 derniers jours</h2>
          {results.measured === 0 ? (
            <p className="text-sm text-muted">
              Les chiffres apparaissent environ une heure après la parution d&apos;une publication sur un réseau connecté.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">Publications mesurées</dt>
                <dd className="text-2xl font-semibold">{results.measured}</dd>
              </div>
              <div>
                <dt className="text-muted">Interactions en moyenne</dt>
                <dd className="text-2xl font-semibold">
                  {results.engagementAverage === null ? "—" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(results.engagementAverage)}
                </dd>
              </div>
            </dl>
          )}
          {results.recommendations[0] ? <p className="text-sm">{results.recommendations[0].title}.</p> : null}
          <Link href="/statistiques" className={buttonStyles("secondary")}>
            Voir les statistiques
          </Link>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">Réseaux sociaux</h2>
          <p className="text-sm text-muted">
            {data.connectedAccountCount === 0
              ? "Aucun compte connecté."
              : `${data.connectedAccountCount} compte(s) connecté(s).`}
          </p>
          <Link href="/reseaux" className={buttonStyles("secondary")}>
            Voir les réseaux
          </Link>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" | undefined }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className={tone === "danger" ? "text-3xl font-semibold text-danger" : "text-3xl font-semibold"}>{value}</p>
    </Card>
  );
}
