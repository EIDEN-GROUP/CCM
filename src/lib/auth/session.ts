import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  permissionsForRoles,
  type Permission,
  type Role,
} from "@/domain/permissions";
import { isLocale, type Locale } from "@/lib/i18n";

export interface CcmSession {
  /** Authenticated user id, or null when signed out. */
  userId: string | null;
  userEmail: string | null;
  workspaceId: string | null;
  workspaceName: string;
  workspaceTimezone: string;
  workspaceCurrency: string;
  /** The user's role in the active workspace. */
  role: Role | null;
  /** All permissions implied by that role. */
  permissions: Set<Permission>;
  /**
   * False when Supabase is not configured or the schema has not been
   * migrated yet. The shell renders a setup screen instead of failing.
   */
  configured: boolean;
  /** Why the session could not be established, for the setup screen. */
  problem: string | null;
}

const FALLBACK: CcmSession = {
  userId: null,
  userEmail: null,
  workspaceId: null,
  workspaceName: "Medical Bay",
  workspaceTimezone: "Africa/Casablanca",
  workspaceCurrency: "MAD",
  role: null,
  permissions: new Set<Permission>(),
  configured: false,
  problem: null,
};

/**
 * Load the current session.
 *
 * Cached per request so a page that needs the session in several places
 * performs one query.
 */
export const getSession = cache(async (): Promise<CcmSession> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return {
      ...FALLBACK,
      problem:
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.",
    };
  }

  try {
    const supabase = await createClient();

    const {
      data: claimsData,
      error: userError,
    } = await supabase.auth.getClaims();

    if (userError) {
      return { ...FALLBACK, problem: userError.message };
    }

    const claims = claimsData?.claims ?? null;
    if (!claims?.sub) {
      return { ...FALLBACK, configured: true };
    }

    const userId = claims.sub;
    // Supabase includes the email in the access token when the project is
    // configured to do so. It may be absent, in which case the UI shows a
    // placeholder rather than inventing one.
    const userEmail =
      typeof claims.email === "string" ? claims.email : null;

    // The active workspace is the user's first membership. A future
    // workspace switcher reads the same table with a different filter.
    const { data: memberships, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      return {
        ...FALLBACK,
        configured: true,
        userId,
        userEmail,
        problem: membershipError.message,
      };
    }

    const membership = memberships as
      | { workspace_id: string; role: string }
      | null;

    if (!membership) {
      return {
        ...FALLBACK,
        configured: true,
        userId,
        userEmail,
        problem: "This account is not a member of any workspace.",
      };
    }

    const { data: workspaceRow } = await supabase
      .from("workspaces")
      .select("id, name, timezone, currency")
      .eq("id", membership.workspace_id)
      .maybeSingle();

    const workspace = workspaceRow as
      | { id: string; name: string; timezone: string; currency: string }
      | null;

    const role = membership.role as Role;

    return {
      userId,
      userEmail,
      workspaceId: membership.workspace_id,
      workspaceName: workspace?.name ?? "Workspace",
      workspaceTimezone: workspace?.timezone ?? "Africa/Casablanca",
      workspaceCurrency: workspace?.currency ?? "MAD",
      role,
      permissions: permissionsForRoles([role]),
      configured: true,
      problem: null,
    };
  } catch (error) {
    return {
      ...FALLBACK,
      problem:
        error instanceof Error
          ? error.message
          : "Could not establish a session.",
    };
  }
});

export function hasPermission(
  session: CcmSession,
  permission: Permission,
): boolean {
  return session.permissions.has(permission);
}

/**
 * The locale of the signed-in user's preference, falling back to the
 * interface default. Kept server-side so the shell can render the correct
 * `dir` on the first paint without a client round-trip.
 */
export function sessionLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : "en";
}
