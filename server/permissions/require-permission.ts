import { PermissionDeniedError } from "./errors";
import { hasPermission } from "./permissions";
import type { CurrentUser, Permission } from "./types";

export function requirePermission(
  user: CurrentUser,
  permission: Permission,
): void {
  if (!hasPermission(user, permission)) {
    throw new PermissionDeniedError();
  }
}
