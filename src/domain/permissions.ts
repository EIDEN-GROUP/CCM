/**
 * Permission model.
 *
 * CCM grants access at three levels:
 *  - a workspace role,
 *  - a tab level within that role (view / use / edit), and
 *  - an optional per-account grant, for account-scoped roles.
 *
 * The tab levels are the **input**; the feature permissions below are the
 * **derived output** that the database enforces. The owner edits tabs in the
 * interface, and CCM writes the resulting permission set into
 * `role_permissions`, so the Row Level Security policies never change and
 * there is only one source of truth.
 *
 * A user with the `mailbox_user` role can read mailboxes, but only the
 * mailboxes explicitly granted to them — that is enforced in the database by
 * Row Level Security, and mirrored here for UI affordances only.
 */

export const PERMISSIONS = [
  "overview.read",
  "websites.read",
  "ads.read",
  "analytics.read",
  "gtm.read",
  "seo.read",
  "ux.read",
  "social.read",
  "inbox.read",
  "inbox.send",
  "alerts.read",
  "alerts.manage",
  "reports.read",
  "reports.export",
  "integrations.read",
  "integrations.manage",
  "settings.manage",
  "roles.manage",
  "audit.read",
  "launch.read",
  "launch.execute",
  "ai.query",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

import {
  DEFAULT_TAB_LEVELS,
  deriveRolePermissions,
  type TabLevels,
} from "./roles";

export { DEFAULT_TAB_LEVELS };
export type { TabLevels };

export const ROLES = [
  "owner",
  "admin",
  "marketing_analyst",
  "seo",
  "ads_manager",
  "social_manager",
  "mailbox_user",
  "read_only",
] as const;

export type Role = (typeof ROLES)[number];

/**
 * The permissions only the owner may hold.
 *
 * `roles.manage` is what lets somebody change a role. The owner has it
 * unconditionally, so the workspace can always be administered. It is
 * deliberately **not** part of the administrator's set: an administrator
 * administers the operation, not the authority.
 */
export const OWNER_ONLY_PERMISSIONS: readonly Permission[] = ["roles.manage"];

const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

/**
 * The permissions of each role, **derived** from its tab levels.
 *
 * The owner configures tabs — view, use or edit — and the feature
 * permissions the database enforces come from them. Deriving rather than
 * writing both by hand is what stops the interface offering a permission
 * the database refuses.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: deriveRolePermissions("owner", DEFAULT_TAB_LEVELS.owner, ALL_PERMISSIONS),
  admin: deriveRolePermissions("admin", DEFAULT_TAB_LEVELS.admin, ALL_PERMISSIONS),
  marketing_analyst: deriveRolePermissions(
    "marketing_analyst",
    DEFAULT_TAB_LEVELS.marketing_analyst,
    ALL_PERMISSIONS,
  ),
  seo: deriveRolePermissions("seo", DEFAULT_TAB_LEVELS.seo, ALL_PERMISSIONS),
  ads_manager: deriveRolePermissions(
    "ads_manager",
    DEFAULT_TAB_LEVELS.ads_manager,
    ALL_PERMISSIONS,
  ),
  social_manager: deriveRolePermissions(
    "social_manager",
    DEFAULT_TAB_LEVELS.social_manager,
    ALL_PERMISSIONS,
  ),
  mailbox_user: deriveRolePermissions(
    "mailbox_user",
    DEFAULT_TAB_LEVELS.mailbox_user,
    ALL_PERMISSIONS,
  ),
  read_only: deriveRolePermissions(
    "read_only",
    DEFAULT_TAB_LEVELS.read_only,
    ALL_PERMISSIONS,
  ),
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionsForRoles(roles: readonly Role[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) set.add(permission);
  }
  return set;
}

/**
 * Roles whose access is scoped to explicitly granted accounts.
 *
 * These roles never get workspace-wide read access to the underlying tables
 * unless an account grant exists.
 */
export const ACCOUNT_SCOPED_ROLES: readonly Role[] = ["mailbox_user"];

export function isAccountScoped(role: Role): boolean {
  return ACCOUNT_SCOPED_ROLES.includes(role);
}

/**
 * Whether a role may change other roles.
 *
 * Only the owner may. The owner's own role is not editable at all, so a
 * mistake cannot lock the workspace out of its own administration.
 */
export function roleCanManageRoles(role: Role): boolean {
  return roleHasPermission(role, "roles.manage");
}

/** Human-readable role labels used in settings and audit views. */
export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Administrator",
  marketing_analyst: "Marketing Analyst",
  seo: "SEO",
  ads_manager: "Ads Manager",
  social_manager: "Social Manager",
  mailbox_user: "Mailbox User",
  read_only: "Read-only",
};
