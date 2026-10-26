"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Globe,
  Menu,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useShell } from "@/components/providers/shell-provider";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { cn } from "@/lib/cn";
import {
  LOCALE_LABELS,
  LOCALES,
  type Locale,
  type MessagePathRoot,
} from "@/lib/i18n";
import { formatDay } from "@/domain/dates";
import type { RangePreset } from "@/domain/dates";
import { WorkspaceSwitcher, type WorkspaceChoice } from "@/components/shell/workspace-switcher";

/**
 * The preset labels live in the message catalogue — the date range button is
 * translated, so the presets beside it have to be too.
 */
const RANGE_LABEL_KEYS: Record<
  Exclude<RangePreset, "custom">,
  MessagePathRoot
> = {
  "7d": "shell.range7d",
  "28d": "shell.range28d",
  "90d": "shell.range90d",
};

const ICON_BUTTON =
  "inline-flex size-11 items-center justify-center rounded-md border border-border bg-surface text-secondary transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink";

/**
 * The top utility bar: workspace switcher, global search, period selector, language,
 * notifications and the account menu.
 *
 * Below the `md` breakpoint the bar wraps onto two rows instead of
 * overflowing, and the two things that do not fit into it — the navigation
 * drawer and the search field — become buttons of their own.
 */
export function Topbar({
  userEmail,
  workspaceName,
  workspaceId,
  workspaces,
  canCreateWorkspace,
  roleLabel,
  alertCount = null,
  canViewAlerts = false,
}: {
  userEmail: string | null;
  workspaceName: string;
  workspaceId: string;
  workspaces: WorkspaceChoice[];
  canCreateWorkspace: boolean;
  roleLabel: string;
  /**
   * How many alerts are open, or `null` when the count could not be read.
   *
   * `null` is not zero. A bell that reads zero because the query failed
   * says the team has nothing to look at, when in fact nobody knows.
   */
  alertCount?: number | null;
  /** Whether this person may read alerts at all. */
  canViewAlerts?: boolean;
}) {
  const { t, locale, intlLocale: dateLocale } = useI18n();
  const {
    range,
    setPreset,
    setCustomRange,
    navOpen,
    openNav,
    closeNav,
  } = useShell();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [customStart, setCustomStart] = useState(range.start);
  const [customEnd, setCustomEnd] = useState(range.end);
  const [query, setQuery] = useState("");
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  // The button always says what is applied, not what could be applied.
  const appliedRange =
    range.preset === "custom"
      ? `${formatDay(range.start, dateLocale)} – ${formatDay(range.end, dateLocale)}`
      : t(RANGE_LABEL_KEYS[range.preset]);

  function changeLocale(next: Locale) {
    startTransition(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      router.refresh();
    });
  }

  function submitSearch() {
    router.push(`/search?q=${encodeURIComponent(query)}`);
    setMobileSearchOpen(false);
  }

  // Escape closes whatever the phone layout has open and hands the focus
  // back to the button that opened it.
  useEffect(() => {
    if (!navOpen && !mobileSearchOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (mobileSearchOpen) {
        setMobileSearchOpen(false);
        searchButtonRef.current?.focus();
        return;
      }
      event.preventDefault();
      closeNav();
      menuButtonRef.current?.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navOpen, mobileSearchOpen, closeNav]);

  return (
    // The bar is 72px tall on a wide screen, border included; below the
    // breakpoint it grows with its content.
    <header className="shrink-0 border-b border-border bg-surface md:h-[72px]">
      <div className="flex min-h-[72px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 md:h-full md:flex-nowrap md:gap-4 md:px-6 md:py-0">
        {/* Workspace controls and the search affordance for narrow screens */}
        <div className="flex min-w-0 shrink-0 items-center gap-2 max-md:grow md:gap-3">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => (navOpen ? closeNav() : openNav())}
            aria-expanded={navOpen}
            aria-controls="app-navigation"
            aria-label={t("shell.menu")}
            className={cn(ICON_BUTTON, "md:hidden")}
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>

          <WorkspaceSwitcher
            workspaces={workspaces}
            activeWorkspaceId={workspaceId}
            canCreateWorkspace={canCreateWorkspace}
            canRenameWorkspace={workspaces.find((item) => item.id === workspaceId)?.role === "owner"}
          />

          <button
            ref={searchButtonRef}
            type="button"
            onClick={() => setMobileSearchOpen((value) => !value)}
            aria-expanded={mobileSearchOpen}
            aria-controls={
              mobileSearchOpen ? "shell-mobile-search" : undefined
            }
            aria-label={t("shell.searchLabel")}
            className={cn(ICON_BUTTON, "ms-auto md:hidden")}
          >
            <Search aria-hidden="true" className="size-4" />
          </button>
        </div>

        {/* Global search */}
        <SearchForm
          id="global-search"
          value={query}
          onChange={setQuery}
          onSubmit={submitSearch}
          className="relative hidden max-w-md flex-1 md:block"
        />

        <div className="flex w-full flex-wrap items-center gap-2 md:ms-auto md:w-auto md:flex-nowrap">
          {/* Period selector */}
          <Dropdown
            label={t("shell.dateRange")}
            panelRole="group"
            trigger={({ toggle, open, id, panelId, triggerRef }) => (
              <button
                ref={triggerRef}
                type="button"
                id={id}
                onClick={() => {
                  setRangeError(null);
                  toggle();
                }}
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                aria-label={`${t("shell.dateRange")}: ${appliedRange}`}
                title={appliedRange}
                className={cn(
                  "inline-flex h-11 min-w-0 shrink items-center gap-2 rounded-md border border-border bg-surface px-3",
                  "text-label-md font-semibold text-secondary transition-colors hover:bg-surface-muted",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink",
                )}
              >
                <span className="truncate">{appliedRange}</span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-text"
                />
              </button>
            )}
          >
            {({ close }) => (
              <div className="space-y-1">
                {(Object.keys(RANGE_LABEL_KEYS) as Array<
                  Exclude<RangePreset, "custom">
                >).map((preset) => (
                  <DropdownItem
                    key={preset}
                    onSelect={() => {
                      setPreset(preset);
                      close();
                    }}
                  >
                    <span className="flex-1">{t(RANGE_LABEL_KEYS[preset])}</span>
                    {range.preset === preset ? (
                      <Check aria-hidden="true" className="size-4 text-primary-ink" />
                    ) : null}
                  </DropdownItem>
                ))}
                <div className="my-1 border-t border-border" />
                <div
                  role="group"
                  aria-labelledby="custom-range-label"
                  className="space-y-2 px-3 py-2"
                >
                  <span
                    id="custom-range-label"
                    className="block text-label-sm font-semibold text-secondary"
                  >
                    {t("common.custom")}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      id="custom-range-start"
                      type="date"
                      value={customStart}
                      max={customEnd}
                      onChange={(event) => {
                        setCustomStart(event.target.value);
                        setRangeError(null);
                      }}
                      className="h-9 w-full rounded-md border border-border px-2 text-body-sm"
                      aria-label={t("shell.rangeStart")}
                    />
                    <span aria-hidden="true" className="text-muted-text">
                      –
                    </span>
                    <input
                      id="custom-range-end"
                      type="date"
                      value={customEnd}
                      min={customStart}
                      onChange={(event) => {
                        setCustomEnd(event.target.value);
                        setRangeError(null);
                      }}
                      className="h-9 w-full rounded-md border border-border px-2 text-body-sm"
                      aria-label={t("shell.rangeEnd")}
                    />
                  </div>
                  {rangeError ? (
                    <p role="alert" className="text-body-sm text-error-ink">
                      {rangeError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="w-full rounded-md bg-primary px-3 py-2 text-label-md font-semibold text-tertiary hover:bg-primary-60"
                    onClick={() => {
                      // `setCustomRange` only rewrites the URL, so an
                      // impossible window would be dropped silently by the
                      // server. Refuse it here and say why.
                      if (
                        !customStart ||
                        !customEnd ||
                        customEnd < customStart
                      ) {
                        setRangeError(t("shell.rangeInvalid"));
                        return;
                      }
                      setRangeError(null);
                      setCustomRange(customStart, customEnd);
                      close();
                    }}
                  >
                    {t("common.apply")}
                  </button>
                </div>
              </div>
            )}
          </Dropdown>

          {/* Language */}
          <Dropdown
            label={t("shell.language")}
            buttonClassName="w-11 justify-center px-0"
            trigger={({ toggle, open, id, panelId, triggerRef }) => (
              <button
                ref={triggerRef}
                type="button"
                id={id}
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                aria-label={t("shell.language")}
                className={ICON_BUTTON}
              >
                <Globe aria-hidden="true" className="size-4" />
              </button>
            )}
          >
            {({ close }) => (
              <div>
                {LOCALES.map((code) => (
                  <DropdownItem
                    key={code}
                    onSelect={() => {
                      changeLocale(code);
                      close();
                    }}
                  >
                    <span className="flex-1 text-start">{LOCALE_LABELS[code]}</span>
                    {locale === code ? (
                      <Check aria-hidden="true" className="size-4 text-primary-ink" />
                    ) : null}
                  </DropdownItem>
                ))}
              </div>
            )}
          </Dropdown>

          {/* Notifications. A person who may not read alerts gets no bell:
              a control that always says nothing is a dead control. */}
          {canViewAlerts ? (
            <Dropdown
              label={t("shell.notifications")}
            trigger={({ toggle, open, id, panelId, triggerRef }) => (
              <button
                ref={triggerRef}
                type="button"
                id={id}
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                aria-label={t("shell.notifications")}
                className={cn(ICON_BUTTON, "relative")}
              >
                <Bell aria-hidden="true" className="size-4" />
                {alertCount !== null && alertCount > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -end-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-error px-1 text-label-sm font-bold text-tertiary"
                  >
                    {alertCount > 9 ? "9+" : alertCount}
                  </span>
                ) : null}
              </button>
            )}
          >
            {({ close }) => (
              <div className="w-72 p-2">
                <p className="px-2 py-3 text-body-sm text-muted-text">
                  {alertCount === null
                    ? t("shell.notificationsUnavailable")
                    : alertCount > 0
                      ? `${alertCount} open`
                      : t("shell.notificationsEmpty")}
                </p>
                <Link
                  href="/alerts"
                  role="menuitem"
                  onClick={close}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-body-sm text-secondary",
                    "transition-colors hover:bg-surface-muted",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink",
                  )}
                >
                  {t("shell.notificationsViewAll")}
                </Link>
              </div>
            )}
            </Dropdown>
          ) : null}

          {/* Account */}
          <Dropdown
            label={t("shell.userMenu")}
            trigger={({ toggle, open, id, panelId, triggerRef }) => (
              <button
                ref={triggerRef}
                type="button"
                id={id}
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                aria-label={t("shell.userMenu")}
                className={cn(ICON_BUTTON, "rounded-full bg-primary text-tertiary hover:bg-primary-60")}
              >
                <span aria-hidden="true" className="text-label-sm font-bold">
                  {(userEmail ?? "C").charAt(0).toUpperCase()}
                </span>
              </button>
            )}
          >
            {() => (
              <div className="w-64">
                <div className="border-b border-border px-3 py-2.5">
                  <p className="truncate text-body-md font-semibold text-tertiary">
                    {userEmail ?? "—"}
                  </p>
                  <p className="truncate text-body-sm text-muted-text">
                    {workspaceName} · {roleLabel}
                  </p>
                </div>
                <div className="py-1">
                  <DropdownItem href="/audit">
                    <ShieldCheck aria-hidden="true" className="size-4 text-muted-text" />
                    {t("nav.auditSecurity")}
                  </DropdownItem>
                  <DropdownItem href="/integrations">
                    <CalendarDays aria-hidden="true" className="size-4 text-muted-text" />
                    {t("nav.integrations")}
                  </DropdownItem>
                </div>
              </div>
            )}
          </Dropdown>
        </div>
      </div>

      {/* Phone search panel — the same form the wide bar uses. */}
      {mobileSearchOpen ? (
        <div
          id="shell-mobile-search"
          className="border-t border-border px-4 py-3 md:hidden"
        >
          <SearchForm
            id="global-search-mobile"
            value={query}
            onChange={setQuery}
            onSubmit={submitSearch}
            className="w-full"
            showSubmit
            autoFocus
          />
        </div>
      ) : null}
    </header>
  );
}

/**
 * The global search form.
 *
 * The wide bar and the phone panel render the same form, so there is one
 * search implementation and one place that decides where a query goes.
 */
function SearchForm({
  id,
  value,
  onChange,
  onSubmit,
  className,
  showSubmit = false,
  autoFocus = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  className?: string;
  showSubmit?: boolean;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor={id} className="sr-only">
        {t("shell.searchLabel")}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-text"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("shell.searchPlaceholder")}
        autoFocus={autoFocus}
        className={cn(
          "h-11 w-full rounded-md border border-border bg-surface-muted/60 ps-11 text-body-md text-secondary",
          "placeholder:text-muted-text/70",
          "focus:border-primary focus:bg-surface focus:outline-2 focus:outline-offset-0 focus:outline-primary-ink/40",
          showSubmit ? "pe-24" : "pe-3",
        )}
      />
      {showSubmit ? (
        <button
          type="submit"
          className={cn(
            "absolute end-2 top-1/2 -translate-y-1/2 rounded-md bg-primary px-3 py-1.5",
            "text-label-md font-semibold text-tertiary transition-colors hover:bg-primary-60",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink",
          )}
        >
          {t("common.search")}
        </button>
      ) : null}
    </form>
  );
}
