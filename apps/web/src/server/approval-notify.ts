import "server-only";
import type { PostDoc } from "@/server/db/collections";
import { getDb } from "@/server/db/client";
import { sendEmail } from "@/server/email";
import { getServerEnv } from "@/server/env";
import { notifyApprovalDecision, notifyApprovalRequested } from "@/server/services/notifications";

/**
 * Prévient les personnes qui valident quand une demande vient d'être créée par cette opération
 * (la demande porte alors la date même de la modification). Un échec d'envoi ne bloque jamais l'opération.
 */
export async function notifyIfApprovalRequested(post: PostDoc): Promise<void> {
  const requestedAt = post.approval?.requestedAt;
  if (post.status !== "pending_approval" || !requestedAt || requestedAt.getTime() !== post.updatedAt.getTime()) return;
  try {
    await notifyApprovalRequested(getDb(), post, sendEmail, getServerEnv().APP_URL);
  } catch (error) {
    console.error("Notification de validation impossible", error instanceof Error ? error.message : error);
  }
}

export async function notifyDecision(post: PostDoc): Promise<void> {
  try {
    await notifyApprovalDecision(getDb(), post, sendEmail, getServerEnv().APP_URL);
  } catch (error) {
    console.error("Notification de décision impossible", error instanceof Error ? error.message : error);
  }
}
