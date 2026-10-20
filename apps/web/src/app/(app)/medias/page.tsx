import type { Metadata } from "next";
import Link from "next/link";
import { roleHasPermission } from "@smia/shared";
import { DeleteMediaButton } from "@/components/media/delete-media-button";
import { MediaUploader } from "@/components/media/media-uploader";
import { buttonStyles } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { getMediaStorage } from "@/server/media/storage";
import { listMedia } from "@/server/services/media";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Médiathèque" };

export default async function MediaPage({ searchParams }: PageProps<"/medias">) {
  const { page, cree } = await searchParams;
  const access = await requireWorkspace();
  const configured = getMediaStorage().isConfigured();
  const result = await listMedia(getDb(), access, Number(page) || 1);
  const canWrite = roleHasPermission(access.role, "content:write");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">Médiathèque</h1>
          <p className="text-sm text-muted">Vos photos, votre logo et les visuels créés avec vos couleurs.</p>
        </div>
        {configured && canWrite ? (
          <div className="flex flex-wrap items-start gap-2">
            <MediaUploader access={getServerEnv().MEDIA_BLOB_ACCESS} />
            <Link href="/medias/creer" className={buttonStyles("primary")}>
              Créer un visuel
            </Link>
          </div>
        ) : null}
      </header>

      {!configured ? <Alert>Le stockage des médias n&apos;est pas encore activé sur cette installation.</Alert> : null}
      {cree ? <Alert tone="success">Le visuel a été ajouté à la médiathèque.</Alert> : null}

      {result.items.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Aucune image pour le moment. Ajoutez vos photos (produits, équipe, lieu) et votre logo, ou créez un visuel.
          </p>
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {result.items.map((media) => (
            <li key={media._id.toHexString()}>
              <Card className="space-y-2 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/medias/${media._id.toHexString()}/fichier`}
                  alt={media.name}
                  loading="lazy"
                  className="aspect-square w-full rounded-lg bg-background object-contain"
                />
                <p className="truncate text-xs" title={media.name}>
                  {media.name}
                </p>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>
                    {media.width}×{media.height} · {media.source === "template" ? "Visuel" : "Envoyée"}
                  </span>
                  {canWrite ? <DeleteMediaButton mediaId={media._id.toHexString()} /> : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          {result.page > 1 ? <Link href={`/medias?page=${result.page - 1}`} className="text-primary hover:underline">← Précédentes</Link> : <span />}
          <span className="text-muted">Page {result.page} sur {result.pageCount}</span>
          {result.page < result.pageCount ? <Link href={`/medias?page=${result.page + 1}`} className="text-primary hover:underline">Suivantes →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
