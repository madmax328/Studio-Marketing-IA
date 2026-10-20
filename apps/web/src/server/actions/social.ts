"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { UserFacingError } from "@/server/services/errors";
import { setBenchmarkSharing } from "@/server/services/benchmarks";
import { markAllNotificationsRead } from "@/server/services/notifications";
import { setPostAccount } from "@/server/services/posts";
import { connectSimulationAccount, disconnectSocialAccount } from "@/server/services/social-accounts";
import { confirmOAuthConnection } from "@/server/services/social-connections";
import { requireWorkspace } from "@/server/session";
import type { ActionResult } from "@/server/actions/studio";

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof UserFacingError) return { ok: false, error: error.message };
  console.error("Erreur comptes sociaux", error);
  return { ok: false, error: "L'opération a échoué. Réessayez dans un instant." };
}

export async function connectSimulationAction(network: string): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    await connectSimulationAccount(getDb(), access, access.userId, network, getServerEnv().SOCIAL_SIMULATION_ENABLED === "true");
    revalidatePath("/reseaux");
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function disconnectAccountAction(accountId: string): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    await disconnectSocialAccount(getDb(), access, access.userId, accountId);
    revalidatePath("/reseaux");
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function markNotificationsReadAction(): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    await markAllNotificationsRead(getDb(), access);
    revalidatePath("/notifications");
    revalidatePath("/tableau-de-bord");
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function confirmConnectionAction(stateId: string, keys: string[]): Promise<ActionResult<{ connected: number }>> {
  const access = await requireWorkspace();
  try {
    const connected = await confirmOAuthConnection(getDb(), access, access.userId, stateId, keys);
    revalidatePath("/reseaux");
    return { ok: true, data: { connected } };
  } catch (error) {
    return failure(error);
  }
}

export async function setPostAccountAction(postId: string, accountId: string | null): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    await setPostAccount(getDb(), access, postId, accountId);
    revalidatePath(`/publications/${postId}`);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function setBenchmarkSharingAction(value: boolean): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  try {
    await setBenchmarkSharing(getDb(), access, access.userId, value);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/statistiques");
  return { ok: true, data: null };
}
