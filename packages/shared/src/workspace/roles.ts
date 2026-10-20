/**
 * Rôles d'un membre dans un espace de travail.
 * Aucun rôle n'est attribué par défaut à un utilisateur hors de son propre espace.
 */
export const WORKSPACE_ROLES = ["owner", "admin", "editor", "viewer", "client"] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export type WorkspacePermission =
  | "workspace:read"
  | "workspace:manage"
  | "members:manage"
  | "billing:manage"
  | "brand:read"
  | "brand:write"
  | "content:read"
  | "content:write"
  | "social:connect"
  | "content:publish"
  /** Valider (ou refuser) une publication soumise à validation avant son envoi. */
  | "content:approve";

const PERMISSIONS: Record<WorkspaceRole, readonly WorkspacePermission[]> = {
  owner: [
    "workspace:read",
    "workspace:manage",
    "members:manage",
    "billing:manage",
    "brand:read",
    "brand:write",
    "content:read",
    "content:write",
    "social:connect",
    "content:publish",
    "content:approve",
  ],
  admin: [
    "workspace:read",
    "workspace:manage",
    "members:manage",
    "brand:read",
    "brand:write",
    "content:read",
    "content:write",
    "social:connect",
    "content:publish",
    "content:approve",
  ],
  editor: ["workspace:read", "brand:read", "brand:write", "content:read", "content:write", "content:publish"],
  viewer: ["workspace:read", "brand:read", "content:read"],
  /** Client d'une agence : consulte et valide les publications de son espace, sans rien modifier. */
  client: ["workspace:read", "brand:read", "content:read", "content:approve"],
};

/** Rôles proposés à l'invitation (le propriétaire est unique : celui qui a créé l'espace). */
export const INVITABLE_ROLES = ["admin", "editor", "viewer", "client"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const ROLE_LABELS: Record<WorkspaceRole, { label: string; description: string }> = {
  owner: { label: "Propriétaire", description: "Tous les droits, dont l'abonnement." },
  admin: { label: "Administrateur", description: "Tout gérer sauf l'abonnement : équipe, réseaux, publications." },
  editor: { label: "Rédacteur", description: "Écrire, préparer et programmer les publications." },
  viewer: { label: "Lecteur", description: "Consulter, sans rien modifier." },
  client: { label: "Client (validation)", description: "Consulter et valider les publications avant leur envoi." },
};

export function roleHasPermission(role: WorkspaceRole, permission: WorkspacePermission): boolean {
  return PERMISSIONS[role].includes(permission);
}
