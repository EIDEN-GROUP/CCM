import type { ReactNode } from "react";
import { PermissionDeniedState } from "@/components/ui/states";
import type { CcmSession } from "@/lib/auth/session";
import type { Permission } from "@/domain/permissions";

/**
 * Route-level permission guard.
 *
 * The navigation hides links a user may not use, and the database refuses the
 * rows. This is the third layer: the screen itself states that the user has
 * no access, instead of rendering an empty page that looks like missing data.
 */
export type GuardResult =
  | { allowed: true; response: null }
  | { allowed: false; response: ReactNode };

export function requirePermission(
  session: CcmSession,
  permission: Permission,
): GuardResult {
  if (session.permissions.has(permission)) {
    return { allowed: true, response: null };
  }
  return {
    allowed: false,
    response: <PermissionDeniedState />,
  };
}

/**
 * Guard for actions that need a stronger permission than the read the page
 * already required.
 */
export function requireAnyPermission(
  session: CcmSession,
  permissions: Permission[],
): GuardResult {
  if (permissions.some((permission) => session.permissions.has(permission))) {
    return { allowed: true, response: null };
  }
  return {
    allowed: false,
    response: <PermissionDeniedState />,
  };
}
