import type { Metadata } from "next";
import Link from "next/link";
import { POST_STATUS_LABELS, SOCIAL_NETWORKS } from "@smia/shared";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { getDashboardData } from "@/server/services/dashboard";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Tableau de bord" };

function formatInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone }).format(date);
}

export default async function DashboardPage() {
  const access = await requireWorkspace();
  const data = await getDashboardData(getDb(), access);
  const isEmpty = data.brandCount === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/studio" className={buttonStyles("primary")}>
            Générer une publication
          </Link>
          <button type="button" disabled className={buttonStyles("secondary")} title="Disponible avec le module Campagnes">
            Créer une campagne · bientôt
          </button>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Programmées" value={data.postsByStatus.scheduled} />
        <Stat label="Publiées" value={data.postsByStatus.published} />
        <Stat label="Brouillons" value={data.postsByStatus.draft} />
        <Stat label="En échec" value={data.postsByStatus.failed} tone={data.postsByStatus.failed > 0 ? "danger" : undefined} />
      </div>

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
          <p className="text-xs text-muted">Statut : {POST_STATUS_LABELS.scheduled.toLowerCase()} uniquement.</p>
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
