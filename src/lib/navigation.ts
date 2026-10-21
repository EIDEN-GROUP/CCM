import type { Permission } from "@/domain/permissions";

/**
 * The application navigation.
 *
 * Every entry points at a real route with a working screen. A navigation item
 * is only shown when the signed-in user's role grants the permission the
 * screen needs — the same permission the route guard and the database policy
 * enforce, so hiding a link is a convenience, never the control.
 */
export interface NavItem {
  key: string;
  href: string;
  icon: string;
  /** Message key in the catalogue. */
  labelKey:
    | "nav.overview"
    | "nav.websites"
    | "nav.googleAds"
    | "nav.analytics"
    | "nav.gtmTracking"
    | "nav.seoRankings"
    | "nav.heatmaps"
    | "nav.socialMedia"
    | "nav.unifiedInbox"
    | "nav.accountLauncher"
    | "nav.alertsActions"
    | "nav.reports"
    | "nav.integrations"
    | "nav.auditSecurity"
    | "nav.settings"
    | "nav.providerApps";
  permission: Permission;
  /** Section heading this item belongs to. */
  section: "overview" | "channels" | "operations" | "admin";
  /** Badge count, filled in at runtime (e.g. open alerts). */
  badgeKey?: "alerts";
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: "overview",
    href: "/overview",
    icon: "LayoutDashboard",
    labelKey: "nav.overview",
    permission: "overview.read",
    section: "overview",
  },
  {
    key: "websites",
    href: "/websites",
    icon: "Globe",
    labelKey: "nav.websites",
    permission: "websites.read",
    section: "channels",
  },
  {
    key: "google-ads",
    href: "/google-ads",
    icon: "BadgeDollarSign",
    labelKey: "nav.googleAds",
    permission: "ads.read",
    section: "channels",
  },
  {
    key: "analytics",
    href: "/analytics",
    icon: "ChartPie",
    labelKey: "nav.analytics",
    permission: "analytics.read",
    section: "channels",
  },
  {
    key: "gtm",
    href: "/gtm",
    icon: "Tags",
    labelKey: "nav.gtmTracking",
    permission: "gtm.read",
    section: "channels",
  },
  {
    key: "seo",
    href: "/seo",
    icon: "Search",
    labelKey: "nav.seoRankings",
    permission: "seo.read",
    section: "channels",
  },
  {
    key: "ux",
    href: "/ux",
    icon: "Eye",
    labelKey: "nav.heatmaps",
    permission: "ux.read",
    section: "channels",
  },
  {
    key: "social",
    href: "/social",
    icon: "Users",
    labelKey: "nav.socialMedia",
    permission: "social.read",
    section: "channels",
  },
  {
    key: "inbox",
    href: "/inbox",
    icon: "Mail",
    labelKey: "nav.unifiedInbox",
    permission: "inbox.read",
    section: "operations",
  },
  {
    key: "launcher",
    href: "/launcher",
    icon: "Rocket",
    labelKey: "nav.accountLauncher",
    permission: "launch.read",
    section: "operations",
  },
  {
    key: "alerts",
    href: "/alerts",
    icon: "Bell",
    labelKey: "nav.alertsActions",
    permission: "alerts.read",
    section: "operations",
    badgeKey: "alerts",
  },
  {
    key: "reports",
    href: "/reports",
    icon: "FileText",
    labelKey: "nav.reports",
    permission: "reports.read",
    section: "operations",
  },
  {
    key: "integrations",
    href: "/integrations",
    icon: "Plug",
    labelKey: "nav.integrations",
    permission: "integrations.read",
    section: "admin",
  },
  {
    key: "audit",
    href: "/audit",
    icon: "ShieldCheck",
    labelKey: "nav.auditSecurity",
    permission: "audit.read",
    section: "admin",
  },
  {
    key: "settings",
    href: "/settings",
    icon: "Settings",
    labelKey: "nav.settings",
    permission: "settings.manage",
    section: "admin",
  },
  {
    key: "providerApps",
    href: "/settings/integrations",
    icon: "Plug",
    labelKey: "nav.providerApps",
    permission: "settings.manage",
    section: "admin",
  },
];

export const NAV_SECTIONS = [
  { id: "overview", labelKey: "nav.sectionOverview" },
  { id: "channels", labelKey: "nav.sectionChannels" },
  { id: "operations", labelKey: "nav.sectionOperations" },
  { id: "admin", labelKey: "nav.sectionAdmin" },
] as const satisfies ReadonlyArray<{
  id: (typeof NAV_ITEMS)[number]["section"];
  labelKey: string;
}>;

export function navItemsForPermissions(
  permissions: ReadonlySet<Permission>,
): NavItem[] {
  return NAV_ITEMS.filter((item) => permissions.has(item.permission));
}
