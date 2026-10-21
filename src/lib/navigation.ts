import type { Permission } from "@/domain/permissions";
import { TABS, type NavLabelKey, type TabDefinition } from "@/domain/tabs";

/**
 * The application navigation.
 *
 * The items are **derived from the tab registry** (`src/domain/tabs.ts`),
 * so a tab cannot exist without a navigation entry and a navigation entry
 * cannot exist without a tab. The owner configures the tabs; the
 * navigation follows.
 *
 * A navigation item is only shown when the signed-in user's role grants the
 * permission the screen needs — the same permission the route guard and the
 * database policy enforce, so hiding a link is a convenience, never the
 * control.
 */
export interface NavItem {
  key: string;
  href: string;
  icon: string;
  /** Message key in the catalogue. */
  labelKey: NavLabelKey;
  permission: Permission;
  /** Section heading this item belongs to. */
  section: "overview" | "channels" | "operations" | "admin";
  /** Badge count, filled in at runtime (e.g. open alerts). */
  badgeKey?: "alerts";
}

export const NAV_ITEMS: NavItem[] = TABS.map((tab: TabDefinition) => ({
  key: tab.key,
  href: tab.href,
  icon: tab.icon,
  labelKey: tab.labelKey,
  permission: tab.read,
  section: tab.section,
  ...(tab.badgeKey ? { badgeKey: tab.badgeKey } : {}),
}));

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
