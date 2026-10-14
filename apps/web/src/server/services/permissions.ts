import { roleHasPermission, type WorkspacePermission } from "@smia/shared";
import { UserFacingError } from "@/server/services/errors";
import type { WorkspaceAccess } from "@/server/services/workspaces";

export function assertPermission(access: WorkspaceAccess, permission: WorkspacePermission): void {
  if (!roleHasPermission(access.role, permission)) {
    throw new UserFacingError("Vous n'avez pas les droits nécessaires pour cette action.", "forbidden");
  }
}
