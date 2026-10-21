import {
  TABS,
  permissionsForLevel,
  type TabLevel,
} from "./tabs";
import type { Permission, Role } from "./permissions";

/**
 * The default access of each role.
 *
 * This is the **input**: the owner changes these levels in the interface,
 * and the feature permissions the database enforces are derived from them.
 * Deriving rather than hand-writing both is what keeps the tab map and the
 * authorisation from ever disagreeing.
 */

/** The levels of one role, keyed by tab. */
export type TabLevels = Record<string, TabLevel>;

/** Every tab at the "edit" level, which is what the owner and the administrator get. */
const EVERYTHING: TabLevels = Object.fromEntries(
  TABS.map((tab) => [tab.key, "edit" as TabLevel]),
);

/** The levels each role starts with. */
export const DEFAULT_TAB_LEVELS: Record<Role, TabLevels> = {
  owner: {
    ...EVERYTHING,
    // The owner-only tab is all-or-nothing.
    people: "edit",
  },

  // The administrator runs the operation, not the authority. The people tab
  // is the owner's alone, so it is not on.
  admin: {
    ...EVERYTHING,
    people: "none",
  },

  marketing_analyst: {
    overview: "view",
    websites: "view",
    "google-ads": "use",
    analytics: "use",
    gtm: "use",
    seo: "use",
    ux: "use",
    social: "use",
    inbox: "none",
    launcher: "use",
    alerts: "use",
    reports: "use",
    integrations: "view",
    audit: "none",
    settings: "none",
    "provider-apps": "none",
    people: "none",
  },

  seo: {
    overview: "view",
    websites: "view",
    "google-ads": "none",
    analytics: "use",
    gtm: "none",
    seo: "use",
    ux: "none",
    social: "none",
    inbox: "none",
    launcher: "use",
    alerts: "none",
    reports: "use",
    integrations: "view",
    audit: "none",
    settings: "none",
    "provider-apps": "none",
    people: "none",
  },

  ads_manager: {
    overview: "view",
    websites: "view",
    "google-ads": "use",
    analytics: "use",
    gtm: "none",
    seo: "none",
    ux: "none",
    social: "none",
    inbox: "none",
    launcher: "use",
    alerts: "none",
    reports: "use",
    integrations: "view",
    audit: "none",
    settings: "none",
    "provider-apps": "none",
    people: "none",
  },

  social_manager: {
    overview: "view",
    websites: "none",
    "google-ads": "none",
    analytics: "none",
    gtm: "none",
    seo: "none",
    ux: "none",
    social: "use",
    inbox: "view",
    launcher: "use",
    alerts: "none",
    reports: "use",
    integrations: "view",
    audit: "none",
    settings: "none",
    "provider-apps": "none",
    people: "none",
  },

  // A mailbox user reads and sends in the mailbox they were granted, and
  // may open an account from the launcher.
  mailbox_user: {
    overview: "none",
    websites: "none",
    "google-ads": "none",
    analytics: "none",
    gtm: "none",
    seo: "none",
    ux: "none",
    social: "none",
    inbox: "use",
    launcher: "view",
    alerts: "none",
    reports: "none",
    integrations: "none",
    audit: "none",
    settings: "none",
    "provider-apps": "none",
    people: "none",
  },

  read_only: {
    overview: "view",
    websites: "view",
    "google-ads": "view",
    analytics: "view",
    gtm: "view",
    seo: "view",
    ux: "view",
    social: "view",
    inbox: "none",
    launcher: "view",
    alerts: "view",
    reports: "view",
    integrations: "view",
    audit: "none",
    settings: "none",
    "provider-apps": "none",
    people: "none",
  },
};

/**
 * The permissions a role holds, given its tab levels.
 *
 * The owner's role is never derived — it always holds everything, so the
 * workspace can always be administered.
 */
export function deriveRolePermissions(
  role: Role,
  levels: TabLevels,
  allPermissions: readonly Permission[],
): Permission[] {
  if (role === "owner") return [...allPermissions];

  const permissions = new Set<Permission>();

  for (const tab of TABS) {
    const level = levels[tab.key] ?? "none";
    for (const permission of permissionsForLevel(tab, level)) {
      permissions.add(permission);
    }
  }

  // The owner-only permission is granted by the role, never derived, so
  // handing the people tab to the administrator cannot hand over the
  // authority to change roles.
  if (role !== "admin" && (levels.people ?? "none") !== "none") {
    permissions.add("roles.manage");
  }

  return [...permissions].sort();
}
