import type { Metadata } from "next";
import Link from "next/link";
import { roleHasPermission } from "@smia/shared";
import { VisualEditor } from "@/components/media/visual-editor";
import { buttonStyles } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { getMediaStorage } from "@/server/media/storage";
import { listBrands } from "@/server/services/brands";
import { listMedia } from "@/server/services/media";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Créer un visuel" };
export const maxDuration = 60;

export default async function CreateVisualPage() {
  const access = await requireWorkspace();
  const db = getDb();
  const brands = await listBrands(db, access);
  const media = await listMedia(db, access, 1, "image");

  return (
    <div className="space-y-6">
      <Link href="/medias" className="text-sm text-primary hover:underline">
        ← Médiathèque
      </Link>
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Créer un visuel</h1>
        <p className="text-sm text-muted">
          Le texte, le logo et les couleurs sont placés exactement comme vous les saisissez : rien n&apos;est inventé.
        </p>
      </header>

      {!roleHasPermission(access.role, "content:write") ? (
        <Alert>Votre rôle ne permet pas de créer des visuels.</Alert>
      ) : !getMediaStorage().isConfigured() ? (
        <Alert>Le stockage des médias n&apos;est pas encore activé sur cette installation.</Alert>
      ) : brands.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-sm">Créez d&apos;abord votre marque pour utiliser ses couleurs et son logo.</p>
          <Link href="/ma-marque/nouvelle" className={buttonStyles("primary")}>
            Créer ma marque
          </Link>
        </Card>
      ) : (
        <VisualEditor
          brands={brands.map((brand) => ({
            id: brand._id.toHexString(),
            name: brand.name,
            colors: brand.brandColors,
            hasLogo: Boolean(brand.logoMediaId),
          }))}
          photos={media.items.map((item) => ({ id: item._id.toHexString(), name: item.name }))}
        />
      )}
    </div>
  );
}
