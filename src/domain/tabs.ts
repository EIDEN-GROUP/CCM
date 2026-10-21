import type { Permission } from "./permissions";
import type { MessagePathRoot } from "@/lib/i18n";

/** A message key in the `nav` namespace. */
export type NavLabelKey = Extract<MessagePathRoot, `nav.${string}`>;

/**
 * The tabs.
 *
 * A tab is a screen of the command centre. The owner says, per role, how
 * far into each tab that role may go:
 *
 *   **view** — the tab appears and can be read.
 *   **use**  — the tab's actions are available: export, refresh, open an
 *              account, send a message, run a digest.
 *   **edit** — the tab's configuration may be changed: register a site,
 *              connect a provider, change a rule.
 *
 * The levels are **derived into the feature permissions** the database
 * enforces, so there is one source of truth. The owner edits tabs; the
 * database still authorises on permissions, and the Row Level Security
 * policies do not change.
 */

export const TAB_LEVELS = ["none", "view", "use", "edit"] as const;

export type TabLevel = (typeof TAB_LEVELS)[number];

export interface TabDefinition {
  /** The key used in the database and in the interface. */
  key: string;
  /** The route the tab lives at. */
  href: string;
  /** The message key for the tab's name. */
  labelKey: NavLabelKey;
  /** The icon name from the icon registry. */
  icon: string;
  /** The section of the navigation the tab belongs to. */
  section: "overview" | "channels" | "operations" | "admin";
  /** The permission that lets somebody reach the tab. */
  read: Permission;
  /** The permissions the **use** level adds. */
  use: Permission[];
  /** The permissions the **edit** level adds, on top of use. */
  edit: Permission[];
  /** Whether the tab counts a badge, and which one. */
  badgeKey?: "alerts";
  /**
   * Whether the tab belongs to the owner alone.
   *
   * The permissions of an owner-only tab are **not** derived from its level:
   * they come from the role itself. Otherwise granting the owner-only tab
   * to the administrator would hand over the authority to change roles.
   */
  ownerOnly?: boolean;
  /**
   * Whether the tab may be edited by the owner.
   *
   * The owner's own tab cannot be reduced, because that would lock the
   * workspace out of its own administration.
   */
  immutable?: boolean;
}

/**
 * Every tab, in navigation order.
 */
export const TABS: TabDefinition[] = [
  {
    key: "overview",
    href: "/overview",
    labelKey: "nav.overview",
    icon: "LayoutDashboard",
    section: "overview",
    read: "overview.read",
    use: [],
    edit: [],
  },
  {
    key: "websites",
    href: "/websites",
    labelKey: "nav.websites",
    icon: "Globe",
    section: "channels",
    read: "websites.read",
    use: [],
    edit: ["integrations.manage"],
  },
  {
    key: "google-ads",
    href: "/google-ads",
    labelKey: "nav.googleAds",
    icon: "BadgeDollarSign",
    section: "channels",
    read: "ads.read",
    use: ["reports.export"],
    edit: [],
  },
  {
    key: "analytics",
    href: "/analytics",
    labelKey: "nav.analytics",
    icon: "ChartPie",
    section: "channels",
    read: "analytics.read",
    use: ["ai.query"],
    edit: [],
  },
  {
    key: "gtm",
    href: "/gtm",
    labelKey: "nav.gtmTracking",
    icon: "Tags",
    section: "channels",
    read: "gtm.read",
    use: ["reports.export"],
    edit: ["integrations.manage"],
  },
  {
    key: "seo",
    href: "/seo",
    labelKey: "nav.seoRankings",
    icon: "Search",
    section: "channels",
    read: "seo.read",
    use: ["reports.export"],
    edit: [],
  },
  {
    key: "ux",
    href: "/ux",
    labelKey: "nav.heatmaps",
    icon: "Eye",
    section: "channels",
    read: "ux.read",
    use: ["reports.export"],
    edit: [],
  },
  {
    key: "social",
    href: "/social",
    labelKey: "nav.socialMedia",
    icon: "Users",
    section: "channels",
    read: "social.read",
    use: ["reports.export"],
    edit: [],
  },
  {
    key: "inbox",
    href: "/inbox",
    labelKey: "nav.unifiedInbox",
    icon: "Mail",
    section: "operations",
    read: "inbox.read",
    use: ["inbox.send"],
    edit: [],
  },
  {
    key: "launcher",
    href: "/launcher",
    labelKey: "nav.accountLauncher",
    icon: "Rocket",
    section: "operations",
    read: "launch.read",
    use: ["launch.execute"],
    edit: ["integrations.manage"],
  },
  {
    key: "alerts",
    href: "/alerts",
    labelKey: "nav.alertsActions",
    icon: "Bell",
    section: "operations",
    read: "alerts.read",
    use: ["alerts.manage"],
    edit: ["alerts.manage"],
    badgeKey: "alerts",
  },
  {
    key: "reports",
    href: "/reports",
    labelKey: "nav.reports",
    icon: "FileText",
    section: "operations",
    read: "reports.read",
    use: ["reports.export", "ai.query"],
    edit: [],
  },
  {
    key: "integrations",
    href: "/integrations",
    labelKey: "nav.integrations",
    icon: "Plug",
    section: "admin",
    read: "integrations.read",
    use: ["integrations.manage"],
    edit: ["integrations.manage"],
  },
  {
    key: "audit",
    href: "/audit",
    labelKey: "nav.auditSecurity",
    icon: "ShieldCheck",
    section: "admin",
    read: "audit.read",
    use: [],
    edit: [],
  },
  {
    key: "settings",
    href: "/settings",
    labelKey: "nav.settings",
    icon: "Settings",
    section: "admin",
    read: "settings.manage",
    use: ["settings.manage"],
    edit: ["settings.manage"],
  },
  {
    key: "provider-apps",
    href: "/settings/integrations",
    labelKey: "nav.providerApps",
    icon: "Plug",
    section: "admin",
    read: "settings.manage",
    use: ["settings.manage"],
    edit: ["settings.manage"],
  },
  {
    key: "people",
    href: "/settings/people",
    labelKey: "nav.people",
    icon: "Users",
    section: "admin",
    read: "roles.manage",
    use: [],
    edit: [],
    ownerOnly: true,
    immutable: true,
  },
];

/** A tab, by its key. */
export function tabByKey(key: string): TabDefinition | undefined {
  return TABS.find((tab) => tab.key === key);
}

/**
 * The permissions a level implies for a tab.
 *
 * `none` implies nothing. `view` implies the read permission. `use` adds the
 * tab's action permissions. `edit` adds the tab's configuration
 * permissions, and keeps the action ones.
 */
export function permissionsForLevel(
  tab: TabDefinition,
  level: TabLevel,
): Permission[] {
  if (level === "none") return [];
  // An owner-only tab grants nothing by derivation. Its permission belongs to
  // the owner as a role, not to whoever is given the tab.
  if (tab.ownerOnly) return [];

  const permissions = new Set<Permission>([tab.read]);

  if (level === "use" || level === "edit") {
    for (const permission of tab.use) permissions.add(permission);
  }
  if (level === "edit") {
    for (const permission of tab.edit) permissions.add(permission);
  }

  return [...permissions];
}

/**
 * The level a set of permissions implies for a tab.
 *
 * The inverse of `permissionsForLevel`, used to show the owner the current
 * state of a role.
 */
export function levelForPermissions(
  tab: TabDefinition,
  permissions: ReadonlySet<Permission>,
): TabLevel {
  if (!permissions.has(tab.read)) return "none";
  // The owner-only tab is all-or-nothing: holding the permission means
  // holding the whole tab.
  if (tab.ownerOnly) return "edit";

  const hasUse = tab.use.every((permission) => permissions.has(permission));
  const hasEdit = tab.edit.every((permission) => permissions.has(permission));

  if (tab.edit.length > 0 && hasEdit && hasUse) return "edit";
  if (tab.use.length > 0 && hasUse) return "use";
  if (tab.use.length === 0 && tab.edit.length === 0) return "view";

  // Some of the tab's action permissions are present but not all.
  return "view";
}
