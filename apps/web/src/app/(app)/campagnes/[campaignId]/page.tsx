import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CAMPAIGN_OBJECTIVE_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CREDIT_COSTS,
  POST_STATUS_LABELS,
  roleHasPermission,
  SOCIAL_NETWORKS,
  toZoned,
} from "@smia/shared";
import { CampaignWorkspace } from "@/components/campaigns/campaign-workspace";
import { getTextProvider } from "@/server/ai";
import { getDb } from "@/server/db/client";
import { collections } from "@/server/db/collections";
import { CAMPAIGN_BATCH_SIZE, getCampaign, pendingSlotIds } from "@/server/services/campaigns";
import { UserFacingError } from "@/server/services/errors";
import { hasAiConsent } from "@/server/services/generation";
import { postStatusLabel, schedulingProblems } from "@/server/services/posts";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Campagne" };

/** Proposer une stratégie ou rédiger un lot peut prendre jusqu'à une minute. */
export const maxDuration = 120;

export default async function CampaignPage({ params }: PageProps<"/campagnes/[campaignId]">) {
  const { campaignId } = await params;
  const access = await requireWorkspace();
  const db = getDb();
  const campaign = await getCampaign(db, access, campaignId).catch((error: unknown) => {
    if (error instanceof UserFacingError && error.code === "not_found") notFound();
    throw error;
  });
  const provider = getTextProvider();
  const posts = await collections(db)
    .posts.find({ workspaceId: access.workspace._id, campaignId: campaign._id })
    .sort({ scheduledAt: 1 })
    .limit(500)
    .toArray();
  const pending = await pendingSlotIds(db, access, campaign);

  return (
    <div className="space-y-6">
      <Link href="/campagnes" className="text-sm text-primary hover:underline">
        ← Campagnes
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{campaign.name}</h1>
        <p className="text-sm text-muted">
          {CAMPAIGN_OBJECTIVE_LABELS[campaign.objective]} · {campaign.networks.map((n) => SOCIAL_NETWORKS[n].label).join(", ")} ·
          du {campaign.startDate} au {campaign.endDate} · {campaign.postsPerWeek} par semaine · {CAMPAIGN_STATUS_LABELS[campaign.status]}
        </p>
        <p className="text-xs text-muted">Heures exprimées dans le fuseau {campaign.timeZone}.</p>
      </header>
      <CampaignWorkspace
        campaign={{
          id: campaignId,
          status: campaign.status,
          strategy: campaign.strategy,
          missingInformation: campaign.missingInformation,
          networks: campaign.networks,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          defaultTime: campaign.defaultTime,
        }}
        posts={posts.map((post) => {
          const local = post.scheduledAt ? toZoned(post.scheduledAt, post.timeZone) : null;
          return {
            id: post._id.toHexString(),
            slotId: post.slotId ?? null,
            network: post.network,
            status: post.status,
            statusLabel: postStatusLabel(post, POST_STATUS_LABELS),
            excerpt: post.text.slice(0, 220),
            localDate: local?.date ?? null,
            localTime: local?.time ?? null,
            problems: schedulingProblems(post),
          };
        })}
        pendingSlots={pending.length}
        batchSize={CAMPAIGN_BATCH_SIZE}
        creditsPerBatch={CREDIT_COSTS.campaign_posts}
        aiReady={provider.isConfigured() && hasAiConsent(access, provider)}
        canWrite={roleHasPermission(access.role, "content:write")}
        canPublish={roleHasPermission(access.role, "content:publish")}
      />
    </div>
  );
}
