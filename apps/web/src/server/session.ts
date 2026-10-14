import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/server/auth";
import { ensureDatabaseReady, getDb } from "@/server/db/client";
import { ensurePersonalWorkspace, getWorkspaceAccess, type WorkspaceAccess } from "@/server/services/workspaces";

export const ACTIVE_WORKSPACE_COOKIE = "smia_workspace";

/** Session courante (mise en cache pour la durée d'un rendu). */
export const getSession = cache(async () => {
  // headers() en premier : rend la page dynamique avant toute lecture de configuration.
  const requestHeaders = await headers();
  await ensureDatabaseReady();
  return getAuth().api.getSession({ headers: requestHeaders });
});

/** Exige un utilisateur connecté et vérifié, sinon redirige vers la connexion. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!session.user.emailVerified) redirect("/verifier-email");
  return session.user;
}

/**
 * Retourne l'espace de travail actif après vérification des droits.
 * Le cookie n'est qu'une préférence : l'adhésion est toujours revérifiée en base.
 */
export const requireWorkspace = cache(async (): Promise<WorkspaceAccess & { userId: string }> => {
  const user = await requireUser();
  const db = getDb();
  const preferred = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;

  if (preferred) {
    const access = await getWorkspaceAccess(db, user.id, preferred);
    if (access) return { ...access, userId: user.id };
  }

  const personal = await ensurePersonalWorkspace(db, { id: user.id, name: user.name });
  const access = await getWorkspaceAccess(db, user.id, personal._id.toHexString());
  if (!access) throw new Error("Espace personnel inaccessible : adhésion manquante.");
  return { ...access, userId: user.id };
});

/**
 * Variante pour les routes API : retourne null au lieu de rediriger.
 * Mêmes vérifications que requireWorkspace (session, e-mail vérifié, adhésion en base).
 */
export async function getWorkspaceForApi(): Promise<(WorkspaceAccess & { userId: string }) | null> {
  const session = await getSession();
  if (!session?.user.emailVerified) return null;
  const db = getDb();
  const preferred = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
  if (preferred) {
    const access = await getWorkspaceAccess(db, session.user.id, preferred);
    if (access) return { ...access, userId: session.user.id };
  }
  const personal = await ensurePersonalWorkspace(db, { id: session.user.id, name: session.user.name });
  const access = await getWorkspaceAccess(db, session.user.id, personal._id.toHexString());
  return access ? { ...access, userId: session.user.id } : null;
}
