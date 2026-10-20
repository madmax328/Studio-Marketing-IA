"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { notifyDecision } from "@/server/approval-notify";
import { getDb } from "@/server/db/client";
import { sendEmail } from "@/server/email";
import { getServerEnv } from "@/server/env";
import { getMediaStorage } from "@/server/media/storage";
import { createClientSpace, deleteClientSpace, renameWorkspace } from "@/server/services/client-spaces";
import { UserFacingError } from "@/server/services/errors";
import { approvePost, rejectPost } from "@/server/services/posts";
import { acceptInvitation, changeMemberRole, inviteMember, leaveWorkspace, removeMember, revokeInvitation, setApprovalRequired } from "@/server/services/team";
import { getWorkspaceAccess } from "@/server/services/workspaces";
import { ACTIVE_WORKSPACE_COOKIE, requireUser, requireWorkspace } from "@/server/session";
import type { ActionResult } from "@/server/actions/studio";

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof UserFacingError) return { ok: false, error: error.message };
  console.error("Erreur de gestion d'équipe", error);
  return { ok: false, error: "Une erreur est survenue. Réessayez dans un instant." };
}

async function run(paths: string[], operation: () => Promise<void>): Promise<ActionResult<null>> {
  try {
    await operation();
  } catch (error) {
    return failure(error);
  }
  for (const path of paths) revalidatePath(path);
  return { ok: true, data: null };
}

/** L'espace actif n'est qu'une préférence : l'adhésion est revérifiée ici et à chaque requête. */
async function setActiveWorkspace(workspaceId: string) {
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    secure: getServerEnv().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 86_400,
  });
}

export async function inviteMemberAction(input: { email: string; role: string }): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  const user = await requireUser();
  return run(["/equipe"], () =>
    inviteMember(getDb(), access, access.userId, input, { sendEmail, appUrl: getServerEnv().APP_URL, inviterName: user.name || user.email }),
  );
}

export async function revokeInvitationAction(invitationId: string): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  return run(["/equipe"], () => revokeInvitation(getDb(), access, access.userId, invitationId));
}

export async function changeMemberRoleAction(memberUserId: string, role: string): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  return run(["/equipe"], () => changeMemberRole(getDb(), access, access.userId, memberUserId, role));
}

export async function removeMemberAction(memberUserId: string): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  return run(["/equipe"], () => removeMember(getDb(), access, access.userId, memberUserId));
}

export async function leaveWorkspaceAction(): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  const result = await run([], () => leaveWorkspace(getDb(), access, access.userId));
  if (result.ok) (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
  return result;
}

export async function setApprovalRequiredAction(value: boolean): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  return run(["/equipe", "/publications"], () => setApprovalRequired(getDb(), access, access.userId, value));
}

export async function renameWorkspaceAction(name: string): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  return run(["/equipe", "/", "/tableau-de-bord"], () => renameWorkspace(getDb(), access, access.userId, { name }));
}

export async function createClientSpaceAction(name: string): Promise<ActionResult<{ workspaceId: string }>> {
  const access = await requireWorkspace();
  try {
    const workspace = await createClientSpace(getDb(), access, access.userId, { name });
    revalidatePath("/equipe");
    return { ok: true, data: { workspaceId: workspace._id.toHexString() } };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteClientSpaceAction(workspaceId: string): Promise<ActionResult<null>> {
  const user = await requireUser();
  const result = await run(["/equipe"], () => deleteClientSpace(getDb(), user.id, workspaceId, getMediaStorage()));
  if (result.ok && (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value === workspaceId) (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
  return result;
}

/** Change d'espace actif, après vérification de l'adhésion. */
export async function switchWorkspaceAction(workspaceId: string): Promise<ActionResult<null>> {
  const user = await requireUser();
  const access = typeof workspaceId === "string" ? await getWorkspaceAccess(getDb(), user.id, workspaceId) : null;
  if (!access) return { ok: false, error: "Vous n'avez pas accès à cet espace." };
  await setActiveWorkspace(workspaceId);
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function acceptInvitationAction(token: string): Promise<ActionResult<null>> {
  const user = await requireUser();
  try {
    const workspaceId = await acceptInvitation(getDb(), { id: user.id, email: user.email, emailVerified: user.emailVerified }, token);
    await setActiveWorkspace(workspaceId.toHexString());
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

export async function approvePostAction(postId: string): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  return run(["/publications", `/publications/${postId}`, "/calendrier", "/tableau-de-bord"], async () => {
    await notifyDecision(await approvePost(getDb(), access, access.userId, postId));
  });
}

export async function rejectPostAction(postId: string, comment: string): Promise<ActionResult<null>> {
  const access = await requireWorkspace();
  return run(["/publications", `/publications/${postId}`, "/calendrier", "/tableau-de-bord"], async () => {
    await notifyDecision(await rejectPost(getDb(), access, access.userId, postId, comment));
  });
}
