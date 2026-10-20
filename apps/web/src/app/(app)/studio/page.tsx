import type { Metadata } from "next";
import Link from "next/link";
import { CREDIT_COSTS, roleHasPermission } from "@smia/shared";
import { AiConsent } from "@/components/studio/ai-consent";
import { BrowserOnly } from "@/components/desktop/desktop-notice";
import { StudioClient } from "@/components/studio/studio-client";
import { desktopDownloadUrl } from "@/lib/features";
import { buttonStyles } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { getTextProvider } from "@/server/ai";
import { getDb } from "@/server/db/client";
import { listBrands } from "@/server/services/brands";
import { getCreditAccount, remainingCredits } from "@/server/services/billing";
import { hasAiConsent } from "@/server/services/generation";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Studio de contenu" };

/** La génération peut prendre jusqu'à une minute. */
export const maxDuration = 120;

export default async function StudioPage() {
  const access = await requireWorkspace();
  const db = getDb();
  const provider = getTextProvider();
  const brands = await listBrands(db, access);
  const download = desktopDownloadUrl();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Studio de contenu</h1>
        <p className="text-sm text-muted">
          Décrivez ce que vous voulez dire : l&apos;IA rédige une publication adaptée à chaque réseau.
        </p>
        {download ? (
          <BrowserOnly>
            <p className="mt-2 text-xs text-muted">
              Écrire sans crédits ?{" "}
              <a href={download} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                Téléchargez l&apos;application de bureau (Windows)
              </a>{" "}
              : l&apos;IA tourne alors sur votre ordinateur.
            </p>
          </BrowserOnly>
        ) : null}
      </header>

      {!roleHasPermission(access.role, "content:write") ? (
        <Alert>Votre rôle permet de consulter les publications, pas d&apos;en créer.</Alert>
      ) : brands.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-sm">Décrivez d&apos;abord votre marque : l&apos;IA en a besoin pour écrire à votre place.</p>
          <Link href="/ma-marque/nouvelle" className={buttonStyles("primary")}>
            Créer ma marque
          </Link>
        </Card>
      ) : (
        // Dans l'application de bureau, l'IA locale reste utilisable même si le cloud ne l'est pas.
        <StudioClient
          brands={brands.map((brand) => ({ id: brand._id.toHexString(), name: brand.name, tone: brand.tone }))}
          credits={remainingCredits(await getCreditAccount(db, access.workspace))}
          costPerGeneration={CREDIT_COSTS.text_generation}
          cloudBlocker={
            !provider.isConfigured() ? (
              <Alert>La génération de texte n&apos;est pas encore activée sur cette installation.</Alert>
            ) : !hasAiConsent(access, provider) ? (
              <AiConsent
                providerLabel={provider.label}
                dataProcessor={provider.dataProcessor}
                canAccept={roleHasPermission(access.role, "workspace:manage")}
              />
            ) : null
          }
        />
      )}
    </div>
  );
}
