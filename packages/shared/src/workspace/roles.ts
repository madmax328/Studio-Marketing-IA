/**
 * Rôles d'un membre dans un espace de travail.
 * Aucun rôle n'est attribué par défaut à un utilisateur hors de son propre espace.
 */
export const WORKSPACE_ROLES = ["owner", "admin", "editor", "viewer"] as const;

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
  | "content:publish";

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
  ],
  editor: ["workspace:read", "brand:read", "brand:write", "content:read", "content:write", "content:publish"],
  viewer: ["workspace:read", "brand:read", "content:read"],
};

export function roleHasPermission(role: WorkspaceRole, permission: WorkspacePermission): boolean {
  return PERMISSIONS[role].includes(permission);
}
