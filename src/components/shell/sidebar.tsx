"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useSyncExternalStore,
  createElement,
} from "react";
import { ChevronsLeft, PanelLeftOpen, X } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useShell } from "@/components/providers/shell-provider";
import { getIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  NAV_SECTIONS,
  navItemsForPermissions,
  type NavItem,
} from "@/lib/navigation";
import type { Permission } from "@/domain/permissions";

/** Where the rail's collapse preference is remembered. */
const COLLAPSE_KEY = "ccm_nav_collapsed";

/** Announced when the collapse preference changes in this tab. */
const COLLAPSE_EVENT = "ccm_nav_collapsed:change";

/** The phone breakpoint. Mirrors Tailwind's `md` (768px). */
const PHONE_QUERY = "(max-width: 767px)";

/**
 * The left navigation.
 *
 * Deliberately quiet: white surface, soft separators, teal only for the
 * active item. Dense enough for an operational tool, calm enough to sit in a
 * medical-hospitality product.
 *
 * Below the `md` breakpoint the rail leaves the flow and becomes an
 * off-canvas drawer: the phone has no room for a 248px column next to the
 * content, so the content takes the whole screen and the navigation slides
 * in over it when it is asked for.
 */
export function Sidebar({
  permissions,
  alertCount = null,
}: {
  permissions: ReadonlySet<Permission>;
  alertCount?: number | null;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { navOpen, closeNav } = useShell();
  const [collapsed, setCollapsed] = useCollapsePreference();
  const isPhone = useIsPhone();

  const items = navItemsForPermissions(permissions);
  // The collapse preference belongs to the wide layout; the phone drawer is
  // always full width and always shows the labels.
  const railCollapsed = collapsed && !isPhone;
  // Off canvas means off screen *and* unreachable by keyboard.
  const offCanvas = isPhone && !navOpen;

  function toggleCollapsed() {
    setCollapsed(!collapsed);
  }

  // A route change means the drawer has done its job.
  useEffect(() => {
    closeNav();
  }, [pathname, closeNav]);

  // Nothing behind an open drawer may scroll.
  useEffect(() => {
    if (!navOpen) return;

    const body = document.body;
    const main = document.getElementById("main-content");
    const bodyOverflow = body.style.overflow;
    const mainOverflow = main?.style.overflowY ?? "";

    body.style.overflow = "hidden";
    if (main) main.style.overflowY = "hidden";

    return () => {
      body.style.overflow = bodyOverflow;
      if (main) main.style.overflowY = mainOverflow;
    };
  }, [navOpen]);

  return (
    <>
      {navOpen ? (
        <div
          aria-hidden="true"
          onClick={closeNav}
          className="fixed inset-0 z-40 bg-tertiary/40 md:hidden"
        />
      ) : null}

      <aside
        id="app-navigation"
        aria-label={t("nav.navigation")}
        aria-hidden={offCanvas ? true : undefined}
        inert={offCanvas ? true : undefined}
        className={cn(
          "flex h-full shrink-0 flex-col border-e border-border/80 bg-surface transition-[width] duration-200",
          railCollapsed ? "w-[72px]" : "w-[248px]",
          // Below the phone breakpoint the rail is a drawer anchored to the
          // inline start edge. The slide mirrors with the text direction.
          "max-md:fixed max-md:inset-y-0 max-md:start-0 max-md:z-50 max-md:w-[248px] max-md:transition-transform",
          navOpen
            ? "max-md:ltr:translate-x-0 max-md:rtl:translate-x-0"
            : "max-md:ltr:-translate-x-full max-md:rtl:translate-x-full max-md:pointer-events-none",
        )}
      >
        <div className={cn("border-b border-border/80 px-4 py-4", railCollapsed && "px-3")}>
          <div className={cn("flex min-w-0 items-center gap-3", railCollapsed && "justify-center")}>
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pale text-primary-ink ring-1 ring-inset ring-primary/20">
              <span className="text-label-md font-extrabold tracking-tight">CCM</span>
            </span>
            {!railCollapsed ? (
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-body-md font-bold text-tertiary">{t("app.name")}</span>
                <span className="mt-0.5 block truncate text-label-sm text-muted-text">{t("app.tagline")}</span>
              </span>
            ) : null}
          </div>
        </div>
        <nav
          aria-label={t("nav.overview")}
          className="scrollbar-calm flex-1 overflow-y-auto px-3 py-5"
        >
          {NAV_SECTIONS.map((section) => {
            const sectionItems = items.filter(
              (item) => item.section === section.id,
            );
            if (sectionItems.length === 0) return null;

            return (
              <div key={section.id} className="mb-6">
                {!railCollapsed ? (
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
                        collapsed={railCollapsed}
                        onNavigate={closeNav}
                        badge={
                          item.badgeKey === "alerts" &&
                          alertCount !== null &&
                          alertCount > 0
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
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-label-md font-semibold text-muted-text",
              "transition-colors hover:bg-surface-muted hover:text-secondary",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink",
              // The drawer is closed by the menu button, the scrim, Escape or
              // a link — the collapse toggle belongs to the wide layout.
              "max-md:hidden",
              railCollapsed && "justify-center px-0",
            )}
          >
            {railCollapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-4" />
            ) : (
              <>
                <ChevronsLeft aria-hidden="true" className="size-4" />
                <span>{t("nav.collapse")}</span>
              </>
            )}
            <span className="sr-only">
              {railCollapsed ? t("nav.expand") : t("nav.collapse")}
            </span>
          </button>

          <button
            type="button"
            onClick={closeNav}
            className={cn(
              "hidden max-md:flex w-full items-center gap-2 rounded-md px-3 py-2 text-label-md font-semibold text-muted-text",
              "transition-colors hover:bg-surface-muted hover:text-secondary",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink",
            )}
          >
            <X aria-hidden="true" className="size-4" />
            <span>{t("shell.closeMenu")}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

/**
 * Whether the viewport is narrow enough to need the drawer.
 *
 * The server has no viewport, so it reports the wide layout and the client
 * corrects it after hydration. `useSyncExternalStore` is used because it is
 * the only React API that can read a browser-only value without risking a
 * hydration mismatch.
 */
function useIsPhone() {
  return useSyncExternalStore(
    subscribeToPhoneViewport,
    isPhoneViewport,
    () => false,
  );
}

function subscribeToPhoneViewport(onChange: () => void) {
  const media = window.matchMedia(PHONE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function isPhoneViewport() {
  return window.matchMedia(PHONE_QUERY).matches;
}

/**
 * The collapse preference, remembered across route changes and page loads.
 *
 * `localStorage` is read through `useSyncExternalStore` so the server and
 * the first client paint agree: the server has no storage, so it renders
 * the expanded rail, and the client adopts the stored value once it takes
 * over.
 */
function useCollapsePreference(): [boolean, (next: boolean) => void] {
  const collapsed = useSyncExternalStore(
    subscribeToCollapsePreference,
    readCollapsePreference,
    () => false,
  );

  const setCollapsed = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, String(next));
    } catch {
      // The preference simply is not remembered this time.
    }
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  }, []);

  return [collapsed, setCollapsed];
}

function subscribeToCollapsePreference(onChange: () => void) {
  window.addEventListener(COLLAPSE_EVENT, onChange);
  // Another tab may have changed the preference.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readCollapsePreference() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "true";
  } catch {
    // A blocked storage API must not break the navigation.
    return false;
  }
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
  badge,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
  badge?: number;
}) {
  const { t } = useI18n();
  const label = t(item.labelKey);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-nav-link transition-[background-color,color,box-shadow] duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink",
        active
          ? "bg-pale font-semibold text-primary-ink shadow-[inset_0_0_0_1px_rgba(75,189,189,0.18)] before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full before:bg-primary-ink"
          : "text-secondary hover:bg-surface-muted hover:text-tertiary",
        collapsed && "justify-center px-0",
      )}
    >
      {createElement(getIcon(item.icon), {
        "aria-hidden": true,
        className: cn(
          "size-[18px] shrink-0",
          active ? "text-primary-ink" : "text-muted-text group-hover:text-secondary",
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
            "ms-auto inline-flex min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-label-sm font-bold text-tertiary",
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
