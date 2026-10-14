import type { Metadata } from "next";
import Link from "next/link";
import { POST_STATUSES, POST_STATUS_LABELS, SOCIAL_NETWORKS, type PostStatus } from "@smia/shared";
import { buttonStyles } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { getDb } from "@/server/db/client";
import { listPosts } from "@/server/services/posts";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Publications" };

function isStatus(value: unknown): value is PostStatus {
  return typeof value === "string" && (POST_STATUSES as readonly string[]).includes(value);
}

export default async function PostsPage({ searchParams }: PageProps<"/publications">) {
  const { statut, page, supprimee } = await searchParams;
  const status = isStatus(statut) ? statut : undefined;
  const access = await requireWorkspace();
  const result = await listPosts(getDb(), access, { status, page: Number(page) || 1 });

  const href = (next: { statut?: PostStatus | undefined; page?: number }) => {
    const params = new URLSearchParams();
    if (next.statut) params.set("statut", next.statut);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    return query ? `/publications?${query}` : "/publications";
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Publications</h1>
        <Link href="/studio" className={buttonStyles("primary")}>
          Générer une publication
        </Link>
      </header>

      {supprimee ? <Alert tone="success">La publication a été supprimée.</Alert> : null}

      <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
        {[undefined, ...POST_STATUSES].map((value) => (
          <Link
            key={value ?? "all"}
            href={href({ statut: value })}
            aria-current={value === status ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              value === status ? "border-primary bg-primary text-primary-foreground" : "border-border",
            )}
          >
            {value ? POST_STATUS_LABELS[value] : "Toutes"}
          </Link>
        ))}
      </nav>

      {result.items.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-sm text-muted">Aucune publication pour le moment.</p>
          <Link href="/studio" className={buttonStyles("secondary")}>
            Ouvrir le studio
          </Link>
        </Card>
      ) : (
        <ul className="space-y-3">
          {result.items.map((post) => (
            <li key={post._id.toHexString()}>
              <Link href={`/publications/${post._id.toHexString()}`} className="block">
                <Card className="space-y-1 transition hover:border-primary">
                  <p className="text-sm">
                    <span className="font-semibold">{SOCIAL_NETWORKS[post.network].label}</span>
                    <span className="text-muted"> · {POST_STATUS_LABELS[post.status]}</span>
                  </p>
                  <p className="line-clamp-2 text-sm text-muted">{post.text}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          {result.page > 1 ? (
            <Link href={href({ statut: status, page: result.page - 1 })} className="text-primary hover:underline">
              ← Précédentes
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {result.page} sur {result.pageCount}
          </span>
          {result.page < result.pageCount ? (
            <Link href={href({ statut: status, page: result.page + 1 })} className="text-primary hover:underline">
              Suivantes →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
