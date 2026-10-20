import type { Metadata } from "next";
import Link from "next/link";
import { METRIC_KEYS, METRIC_LABELS, MIN_POSTS_FOR_RECOMMENDATIONS, SOCIAL_NETWORKS } from "@smia/shared";
import { buttonStyles } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { getDb } from "@/server/db/client";
import { ANALYTICS_PERIODS, getAnalyticsOverview, parsePeriod, type MeasuredPostView } from "@/server/services/analytics";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Statistiques" };

const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function dateTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone }).format(date);
}

export default async function StatisticsPage({ searchParams }: PageProps<"/statistiques">) {
  const { periode } = await searchParams;
  const days = parsePeriod(periode);
  const access = await requireWorkspace();
  const overview = await getAnalyticsOverview(getDb(), access, { days });
  const metricsShown = METRIC_KEYS.filter((key) => overview.totals[key]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">Statistiques</h1>
          <p className="mt-1 text-sm text-muted">Les chiffres viennent directement des réseaux. Rien n&apos;est estimé.</p>
        </div>
        <nav aria-label="Période" className="flex rounded-full border border-border p-1 text-sm">
          {ANALYTICS_PERIODS.map((option) => (
            <Link
              key={option}
              href={`/statistiques?periode=${option}`}
              aria-current={option === days ? "page" : undefined}
              className={cn("rounded-full px-3.5 py-1.5 transition", option === days ? "bg-white/10 text-foreground" : "text-muted hover:text-foreground")}
            >
              {option} jours
            </Link>
          ))}
        </nav>
      </header>

      {overview.published === 0 ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Pas encore de chiffres sur cette période</h2>
          <p className="text-sm text-muted">
            Les statistiques apparaissent environ une heure après la parution d&apos;une publication sur un réseau connecté,
            puis sont mises à jour pendant 30 jours.
            {overview.simulated > 0
              ? ` Vos ${overview.simulated} envoi(s) en mode simulation ne sont pas mesurés : rien n'est parti sur les réseaux.`
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/reseaux" className={buttonStyles("primary")}>
              Connecter un réseau
            </Link>
            <Link href="/studio" className={buttonStyles("secondary")}>
              Créer une publication
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Chiffres clés */}
          <section aria-label="Chiffres clés" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Publications parues" value={overview.published} note={`${overview.measured} mesurée(s)${overview.pending > 0 ? ` · ${overview.pending} en attente` : ""}`} />
            <Kpi
              label="Interactions en moyenne"
              value={overview.engagementAverage === null ? null : number.format(overview.engagementAverage)}
              note="j'aime, commentaires, partages et enregistrements, par publication"
            />
            {(["views", "reach"] as const).map((key) => {
              const total = overview.totals[key];
              return (
                <Kpi
                  key={key}
                  label={METRIC_LABELS[key]}
                  value={total ? number.format(total.sum) : null}
                  note={total ? `sur ${total.posts} publication(s) qui fournissent ce chiffre` : "non fourni par vos réseaux"}
                />
              );
            })}
          </section>

          {overview.unsupportedMessages.length > 0 ? (
            <Alert>
              Certaines publications ne sont pas mesurées : {overview.unsupportedMessages.join(" ")}
            </Alert>
          ) : null}

          {/* Conseils */}
          <Card className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">Ce qui marche chez vous</h2>
              <p className="text-xs text-muted">D&apos;après {overview.recommendationBase} publication(s) mesurée(s) sur 6 mois</p>
            </div>
            {overview.recommendations.length === 0 ? (
              <p className="text-sm text-muted">
                {overview.recommendationBase < MIN_POSTS_FOR_RECOMMENDATIONS
                  ? `Il faut au moins ${MIN_POSTS_FOR_RECOMMENDATIONS} publications mesurées pour tirer des conseils fiables (vous en avez ${overview.recommendationBase}). Continuez à publier : les conseils apparaîtront ici.`
                  : "Aucune tendance nette pour l'instant : vos résultats sont assez réguliers d'un réseau, d'un jour ou d'une heure à l'autre."}
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {overview.recommendations.map((item) => (
                  <li key={item.id} className="rounded-xl border border-border bg-white/[0.02] p-4">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-muted">{item.detail}</p>
                    <p className="mt-2 font-mono text-[11px] text-muted/70">Basé sur {item.basedOn} publications</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted">
              Le studio s&apos;appuie aussi sur vos publications qui ont le mieux marché pour écrire les suivantes.
            </p>
          </Card>

          {/* Par réseau */}
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold">Par réseau</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-muted">
                  <tr className="border-b border-border">
                    <th scope="col" className="py-2 pr-4 font-medium">Réseau</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Parues</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Mesurées</th>
                    <th scope="col" className="py-2 font-medium">Interactions moyennes</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.byNetwork.map((row) => (
                    <tr key={row.network} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4 font-medium">{SOCIAL_NETWORKS[row.network].label}</td>
                      <td className="py-3 pr-4 font-mono">{row.published}</td>
                      <td className="py-3 pr-4 font-mono">{row.measured}</td>
                      <td className="py-3 font-mono">
                        {row.engagementAverage === null ? (
                          <span className="font-sans text-muted">{row.unsupported > 0 ? "non fourni par le réseau" : "en attente"}</span>
                        ) : (
                          number.format(row.engagementAverage)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Meilleures publications */}
          {overview.topPosts.length > 0 ? (
            <Card className="space-y-4">
              <h2 className="text-lg font-semibold">Vos publications qui ont le mieux marché</h2>
              <ol className="space-y-3">
                {overview.topPosts.map((post, index) => (
                  <PostRow key={post.id} post={post} rank={index + 1} metrics={metricsShown} />
                ))}
              </ol>
            </Card>
          ) : null}

          {/* Détail */}
          {overview.recent.length > 0 ? (
            <Card className="space-y-4">
              <h2 className="text-lg font-semibold">Détail des publications mesurées</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead className="text-muted">
                    <tr className="border-b border-border">
                      <th scope="col" className="py-2 pr-4 font-medium">Publication</th>
                      {metricsShown.map((key) => (
                        <th key={key} scope="col" className="py-2 pr-4 text-right font-medium">
                          {METRIC_LABELS[key]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recent.map((post) => (
                      <tr key={post.id} className="border-b border-border align-top last:border-0">
                        <td className="max-w-xs py-3 pr-4">
                          <Link href={`/publications/${post.id}`} className="font-medium hover:text-primary">
                            {SOCIAL_NETWORKS[post.network].label}
                          </Link>
                          <span className="text-muted"> · {dateTime(post.publishedAt, post.timeZone)}</span>
                          <p className="truncate text-muted">{post.excerpt}</p>
                        </td>
                        {metricsShown.map((key) => (
                          <td key={key} className="py-3 pr-4 text-right font-mono">
                            {typeof post.values[key] === "number" ? number.format(post.values[key]) : <span className="text-muted">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted">« — » : chiffre non fourni par le réseau pour cette publication.</p>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: number | string | null; note: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value ?? <span className="text-muted">—</span>}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </Card>
  );
}

function PostRow({ post, rank, metrics }: { post: MeasuredPostView; rank: number; metrics: readonly (typeof METRIC_KEYS)[number][] }) {
  return (
    <li className="flex gap-4 rounded-xl border border-border bg-white/[0.02] p-4">
      <span className="font-mono text-sm text-primary">{String(rank).padStart(2, "0")}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <Link href={`/publications/${post.id}`} className="font-medium hover:text-primary">
            {SOCIAL_NETWORKS[post.network].label}
          </Link>
          <span className="text-muted"> · {dateTime(post.publishedAt, post.timeZone)}</span>
          {post.externalUrl ? (
            <>
              {" · "}
              <a href={post.externalUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Voir sur le réseau
              </a>
            </>
          ) : null}
        </p>
        <p className="mt-1 text-sm text-muted">{post.excerpt}</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="text-foreground">{post.engagement} interactions</span>
          {metrics
            .filter((key) => typeof post.values[key] === "number")
            .map((key) => (
              <span key={key}>
                {METRIC_LABELS[key]} : {number.format(post.values[key] as number)}
              </span>
            ))}
        </p>
      </div>
    </li>
  );
}
