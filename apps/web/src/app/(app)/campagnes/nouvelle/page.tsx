import type { Metadata } from "next";
import Link from "next/link";
import { roleHasPermission, toZoned } from "@smia/shared";
import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { buttonStyles } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { listBrands } from "@/server/services/brands";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Nouvelle campagne" };

export default async function NewCampaignPage() {
  const access = await requireWorkspace();
  const brands = await listBrands(getDb(), access);
  const today = toZoned(new Date(), brands[0]?.timeZone ?? "Europe/Paris").date;

  return (
    <div className="space-y-6">
      <Link href="/campagnes" className="text-sm text-primary hover:underline">
        ← Campagnes
      </Link>
      <h1 className="text-2xl font-semibold">Créer une campagne</h1>
      {!roleHasPermission(access.role, "content:write") ? (
        <Alert>Votre rôle ne permet pas de créer des campagnes.</Alert>
      ) : brands.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-sm">Décrivez d&apos;abord votre marque.</p>
          <Link href="/ma-marque/nouvelle" className={buttonStyles("primary")}>
            Créer ma marque
          </Link>
        </Card>
      ) : (
        <CampaignWizard brands={brands.map((b) => ({ id: b._id.toHexString(), name: b.name }))} today={today} />
      )}
    </div>
  );
}
