import type { Metadata } from "next";
import Link from "next/link";
import { CAMPAIGN_OBJECTIVE_LABELS, CAMPAIGN_STATUS_LABELS } from "@smia/shared";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { listCampaigns } from "@/server/services/campaigns";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Campagnes" };

const frDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });

export default async function CampaignsPage() {
  const access = await requireWorkspace();
  const campaigns = await listCampaigns(getDb(), access);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">Campagnes</h1>
          <p className="text-sm text-muted">Un objectif, une période : l&apos;IA prépare le plan et toutes les publications.</p>
        </div>
        <Link href="/campagnes/nouvelle" className={buttonStyles("primary")}>
          Créer une campagne
        </Link>
      </header>
      {campaigns.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Aucune campagne pour le moment.</p>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <li key={campaign._id.toHexString()}>
              <Link href={`/campagnes/${campaign._id.toHexString()}`} className="block">
                <Card className="space-y-1 transition hover:border-primary">
                  <p className="font-semibold">{campaign.name}</p>
                  <p className="text-sm text-muted">
                    {CAMPAIGN_OBJECTIVE_LABELS[campaign.objective]} · du {frDate(campaign.startDate)} au {frDate(campaign.endDate)}
                  </p>
                  <p className="text-xs text-muted">{CAMPAIGN_STATUS_LABELS[campaign.status]}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
