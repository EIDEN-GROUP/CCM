"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, createElement } from "react";
import { ChevronsLeft, PanelLeftOpen } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { getIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  NAV_SECTIONS,
  navItemsForPermissions,
  type NavItem,
} from "@/lib/navigation";
import type { Permission } from "@/domain/permissions";

/**
 * The left navigation.
 *
 * Deliberately quiet: white surface, soft separators, teal only for the
 * active item. Dense enough for an operational tool, calm enough to sit in a
 * medical-hospitality product.
 */
export function Sidebar({
  permissions,
  alertCount = 0,
}: {
  permissions: ReadonlySet<Permission>;
  alertCount?: number;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const items = navItemsForPermissions(permissions);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-e border-border bg-surface transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[248px]",
      )}
    >
      <nav
        aria-label={t("nav.overview")}
        className="scrollbar-calm flex-1 overflow-y-auto px-3 py-4"
      >
        {NAV_SECTIONS.map((section) => {
          const sectionItems = items.filter(
            (item) => item.section === section.id,
          );
          if (sectionItems.length === 0) return null;

          return (
            <div key={section.id} className="mb-5">
              {!collapsed ? (
                <h2 className="mb-1.5 px-3 text-label-sm font-semibold uppercase tracking-[0.06em] text-muted-text/80">
                  {t(section.labelKey as never)}
                </h2>
              ) : null}
              <ul className="space-y-0.5">
                {sectionItems.map((item) => (
                  <li key={item.key}>
                    <NavLink
                      item={item}
                      active={isActive(pathname, item.href)}
                      collapsed={collapsed}
                      badge={
                        item.badgeKey === "alerts" && alertCount > 0
                          ? alertCount
                          : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-label-md font-semibold text-muted-text",
            "transition-colors hover:bg-surface-muted hover:text-secondary",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-4" />
          ) : (
            <>
              <ChevronsLeft aria-hidden="true" className="size-4" />
              <span>{t("nav.collapse")}</span>
            </>
          )}
          <span className="sr-only">
            {collapsed ? t("nav.expand") : t("nav.collapse")}
          </span>
        </button>
      </div>
    </aside>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  badge,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  badge?: number;
}) {
  const { t } = useI18n();
  const label = t(item.labelKey);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-nav-link transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        active
          ? "bg-pale font-semibold text-primary-ink"
          : "text-secondary hover:bg-surface-muted",
        collapsed && "justify-center px-0",
      )}
    >
      {createElement(getIcon(item.icon), {
        "aria-hidden": true,
        className: cn(
          "size-[18px] shrink-0",
          active ? "text-primary" : "text-muted-text group-hover:text-secondary",
        ),
      })}
      {collapsed ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="min-w-0 flex-1 truncate">{label}</span>
      )}
      {badge ? (
        <span
          className={cn(
            "ms-auto inline-flex min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-label-sm font-bold text-white",
            collapsed && "absolute end-1.5 top-1.5",
          )}
        >
          {badge > 99 ? "99+" : badge}
          <span className="sr-only"> {t("nav.alertsActions")}</span>
        </span>
      ) : null}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Detail pages keep their parent highlighted.
  return pathname.startsWith(`${href}/`);
}
