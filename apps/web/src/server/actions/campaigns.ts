"use server";

import { revalidatePath } from "next/cache";
import { getTextProvider } from "@/server/ai";
import { getDb } from "@/server/db/client";
import { UserFacingError } from "@/server/services/errors";
import {
  archiveCampaign,
  createCampaign,
  generateCampaignBatch,
  proposeStrategy,
  regenerateCampaignPost,
  saveStrategy,
  scheduleCampaignPosts,
} from "@/server/services/campaigns";
import { duplicatePost, setPostSchedule, unschedulePost } from "@/server/services/posts";
import { requireWorkspace } from "@/server/session";
import type { ActionResult } from "@/server/actions/studio";

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof UserFacingError) return { ok: false, error: error.message };
  console.error("Erreur campagne / calendrier", error);
  return { ok: false, error: "L'opération a échoué. Réessayez dans un instant." };
}

function refresh(campaignId?: string) {
  revalidatePath("/campagnes");
  revalidatePath("/calendrier");
  revalidatePath("/publications");
  revalidatePath("/tableau-de-bord");
  if (campaignId) revalidatePath(`/campagnes/${campaignId}`);
}

export async function createCampaignAction(input: unknown): Promise<ActionResult<{ campaignId: string }>> {
  const access = await requireWorkspace();
  try {
    const campaign = await createCampaign(getDb(), access, access.userId, input);
    refresh();
    return { ok: true, data: { campaignId: campaign._id.toHexString() } };
  } catch (error) {
    return failure(error);
  }
}

export async function proposeStrategyAction(campaignId: string, requestId: string): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    await proposeStrategy(getDb(), access, access.userId, campaignId, requestId, getTextProvider());
    refresh(campaignId);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function saveStrategyAction(campaignId: string, strategy: unknown, validate: boolean): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    await saveStrategy(getDb(), access, access.userId, campaignId, strategy, validate);
    refresh(campaignId);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function generateCampaignBatchAction(
  campaignId: string,
  requestId: string,
): Promise<ActionResult<{ created: number; remaining: number; missingInformation: string[] }>> {
  const access = await requireWorkspace();
  try {
    const result = await generateCampaignBatch(getDb(), access, access.userId, campaignId, requestId, getTextProvider());
    refresh(campaignId);
    return { ok: true, data: result };
  } catch (error) {
    return failure(error);
  }
}

export async function regenerateCampaignPostAction(postId: string, requestId: string): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    const post = await regenerateCampaignPost(getDb(), access, access.userId, postId, requestId, getTextProvider());
    refresh(post.campaignId?.toHexString());
    revalidatePath(`/publications/${postId}`);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function scheduleCampaignAction(
  campaignId: string,
): Promise<ActionResult<{ scheduled: number; skipped: { postId: string; reason: string }[] }>> {
  const access = await requireWorkspace();
  try {
    const result = await scheduleCampaignPosts(getDb(), access, access.userId, campaignId);
    refresh(campaignId);
    return { ok: true, data: result };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveCampaignAction(campaignId: string): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    await archiveCampaign(getDb(), access, campaignId);
    refresh(campaignId);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function setPostScheduleAction(
  postId: string,
  input: { date: string; time: string },
  mode: "plan" | "schedule",
): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    await setPostSchedule(getDb(), access, access.userId, postId, input, mode);
    refresh();
    revalidatePath(`/publications/${postId}`);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function unschedulePostAction(postId: string): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    await unschedulePost(getDb(), access, access.userId, postId);
    refresh();
    revalidatePath(`/publications/${postId}`);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function duplicatePostAction(postId: string): Promise<ActionResult<{ postId: string }>> {
  const access = await requireWorkspace();
  try {
    const copy = await duplicatePost(getDb(), access, access.userId, postId);
    refresh();
    return { ok: true, data: { postId: copy._id.toHexString() } };
  } catch (error) {
    return failure(error);
  }
}
