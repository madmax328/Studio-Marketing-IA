import type { Metadata } from "next";
import Link from "next/link";
import { CREDIT_COSTS, roleHasPermission } from "@smia/shared";
import { AiVideoCreator } from "@/components/media/ai-video-creator";
import { AiConsent } from "@/components/studio/ai-consent";
import { VideoEditor } from "@/components/media/video-editor";
import { buttonStyles } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { getSpeechProvider, getVideoProvider } from "@/server/ai";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { getMediaStorage } from "@/server/media/storage";
import { listBrands } from "@/server/services/brands";
import { getCreditAccount, remainingCredits } from "@/server/services/billing";
import { hasAiConsent } from "@/server/services/generation";
import { listPendingVideoJobs } from "@/server/services/video-generation";
import { listMedia } from "@/server/services/media";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Créer une vidéo" };

/** La récupération d'une vidéo créée par IA (téléchargement, vérification, rangement) peut prendre du temps. */
export const maxDuration = 120;

/** Montage d'une courte vidéo à partir des images de la médiathèque, directement dans le navigateur. */
export default async function VideoPage() {
  const access = await requireWorkspace();
  const db = getDb();
  const brands = await listBrands(db, access);
  const images = await listMedia(db, access, 1, "image");
  const speech = getSpeechProvider();
  const videoAi = getVideoProvider();
  const showVideoAi = videoAi.isConfigured() && roleHasPermission(access.role, "content:write") && getMediaStorage().isConfigured() && brands.length > 0;

  return (
    <div className="space-y-6">
      <Link href="/medias" className="text-sm text-primary hover:underline">
        ← Médiathèque
      </Link>
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Créer une vidéo</h1>
        <p className="mt-1 text-sm text-muted">
          Assemblez vos photos et vos messages en une courte vidéo, avec voix off, sous-titres et musique, idéale pour les
          Reels et les stories. Le montage se fait
          sur votre appareil, en quelques secondes.
        </p>
      </header>
      {!roleHasPermission(access.role, "content:write") ? (
        <Alert>Votre rôle permet de consulter la médiathèque, pas de créer des vidéos.</Alert>
      ) : !getMediaStorage().isConfigured() ? (
        <Alert>Le stockage des médias n&apos;est pas encore activé sur cette installation.</Alert>
      ) : brands.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-sm">Créez d&apos;abord votre marque : ses couleurs et son logo habillent la vidéo.</p>
          <Link href="/ma-marque/nouvelle" className={buttonStyles("primary")}>
            Créer ma marque
          </Link>
        </Card>
      ) : (
        <>
        {showVideoAi ? (
          hasAiConsent(access, videoAi) ? (
            <AiVideoCreator
              brands={brands.map((brand) => ({ id: brand._id.toHexString(), name: brand.name }))}
              credits={remainingCredits(await getCreditAccount(db, access.workspace))}
              costs={{ 4: CREDIT_COSTS.video_generation_4s, 8: CREDIT_COSTS.video_generation_8s }}
              pending={await listPendingVideoJobs(db, access)}
            />
          ) : (
            <AiConsent kind="video" providerLabel={videoAi.label} dataProcessor={videoAi.dataProcessor} canAccept={roleHasPermission(access.role, "workspace:manage")} />
          )
        ) : null}
        <h2 className="pt-2 text-lg font-semibold">Ou montez une vidéo avec vos photos</h2>
        <VideoEditor
          access={getServerEnv().MEDIA_BLOB_ACCESS}
          brands={brands.map((brand) => ({
            id: brand._id.toHexString(),
            name: brand.name,
            colors: brand.brandColors,
            logoMediaId: brand.logoMediaId ? brand.logoMediaId.toHexString() : null,
            callToAction: brand.preferredCallToAction,
          }))}
          images={images.items.map((item) => ({ id: item._id.toHexString(), name: item.name }))}
          voice={{
            available: speech.isConfigured(),
            consented: hasAiConsent(access, speech),
            canAccept: roleHasPermission(access.role, "workspace:manage"),
            label: speech.label,
            dataProcessor: speech.dataProcessor,
            cost: CREDIT_COSTS.voiceover,
          }}
        />
        </>
      )}
    </div>
  );
}
