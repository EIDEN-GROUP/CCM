/**
 * Permission model.
 *
 * CCM grants access at two levels:
 *  - a workspace role (feature-level permissions), and
 *  - an optional per-account grant (account-level scoping).
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
  "audit.read",
  "launch.read",
  "launch.execute",
  "ai.query",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

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

const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: ALL_PERMISSIONS,
  // `owner` additionally owns the workspace itself (transfer, deletion,
  // billing), which is a workspace property rather than a feature permission.
  admin: ALL_PERMISSIONS,
  marketing_analyst: [
    "overview.read",
    "websites.read",
    "integrations.read",
    "ads.read",
    "analytics.read",
    "gtm.read",
    "seo.read",
    "ux.read",
    "social.read",
    "alerts.read",
    "alerts.manage",
    "reports.read",
    "reports.export",
    "launch.read",
    "launch.execute",
    "ai.query",
  ],
  seo: [
    "overview.read",
    "websites.read",
    "integrations.read",
    "seo.read",
    "analytics.read",
    "reports.read",
    "reports.export",
    "launch.read",
    "launch.execute",
    "ai.query",
  ],
  ads_manager: [
    "overview.read",
    "websites.read",
    "integrations.read",
    "ads.read",
    "analytics.read",
    "reports.read",
    "reports.export",
    "launch.read",
    "launch.execute",
    "ai.query",
  ],
  social_manager: [
    "overview.read",
    "integrations.read",
    "social.read",
    "inbox.read",
    "reports.read",
    "reports.export",
    "launch.read",
    "launch.execute",
    "ai.query",
  ],
  mailbox_user: ["inbox.read", "inbox.send", "launch.read"],
  read_only: [
    "overview.read",
    "websites.read",
    "integrations.read",
    "ads.read",
    "analytics.read",
    "gtm.read",
    "seo.read",
    "ux.read",
    "social.read",
    "alerts.read",
    "reports.read",
    "launch.read",
  ],
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
