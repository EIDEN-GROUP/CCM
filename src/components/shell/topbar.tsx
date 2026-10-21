"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  Globe,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { useShell } from "@/components/providers/shell-provider";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { cn } from "@/lib/cn";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n";
import { describeRange } from "@/domain/dates";
import type { RangePreset } from "@/domain/dates";

const RANGE_LABELS: Record<Exclude<RangePreset, "custom">, string> = {
  "7d": "Last 7 days",
  "28d": "Last 28 days",
  "90d": "Last 90 days",
};

const ICON_BUTTON =
  "inline-flex size-11 items-center justify-center rounded-md border border-border bg-surface text-secondary transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * The top utility bar: brand, global search, period selector, language,
 * notifications and the account menu.
 */
export function Topbar({
  userEmail,
  workspaceName,
  roleLabel,
  alertCount = 0,
}: {
  userEmail: string | null;
  workspaceName: string;
  roleLabel: string;
  alertCount?: number;
}) {
  const { t, locale } = useI18n();
  const { range, setPreset, setCustomRange } = useShell();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [customStart, setCustomStart] = useState(range.start);
  const [customEnd, setCustomEnd] = useState(range.end);
  const [query, setQuery] = useState("");

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

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-border bg-surface px-4 md:gap-4 md:px-6">
      {/* Brand */}
      <div className="flex shrink-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-lg bg-primary text-white"
        >
          <span className="text-label-md font-bold tracking-tight">CCM</span>
        </span>
        <span className="hidden leading-tight lg:block">
          <span className="block text-headline-sm font-bold text-tertiary">
            {t("app.name")}
          </span>
          <span className="block text-label-sm text-muted-text">
            {t("app.tagline")}
          </span>
        </span>
      </div>

      {/* Global search */}
      <form
        role="search"
        className="relative hidden max-w-md flex-1 md:block"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(`/search?q=${encodeURIComponent(query)}`);
        }}
      >
        <label htmlFor="global-search" className="sr-only">
          {t("shell.searchLabel")}
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-text"
        />
        <input
          id="global-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("shell.searchPlaceholder")}
          className={cn(
            "h-11 w-full rounded-md border border-border bg-surface-muted/60 ps-11 pe-3 text-body-md text-secondary",
            "placeholder:text-muted-text/70",
            "focus:border-primary focus:bg-surface focus:outline-2 focus:outline-offset-0 focus:outline-primary/40",
          )}
        />
      </form>

      <div className="ms-auto flex items-center gap-2">
        {/* Period selector */}
        <Dropdown label={t("shell.dateRange")}>
          {({ close }) => (
            <div className="space-y-1">
              {(Object.keys(RANGE_LABELS) as Array<
                Exclude<RangePreset, "custom">
              >).map((preset) => (
                <DropdownItem
                  key={preset}
                  onSelect={() => {
                    setPreset(preset);
                    close();
                  }}
                >
                  <span className="flex-1">{RANGE_LABELS[preset]}</span>
                  {range.preset === preset ? (
                    <Check aria-hidden="true" className="size-4 text-primary" />
                  ) : null}
                </DropdownItem>
              ))}
              <div className="my-1 border-t border-border" />
              <div className="space-y-2 px-3 py-2">
                <label
                  htmlFor="custom-range-start"
                  className="block text-label-sm font-semibold text-secondary"
                >
                  {t("common.custom")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="custom-range-start"
                    type="date"
                    value={customStart}
                    max={customEnd}
                    onChange={(event) => setCustomStart(event.target.value)}
                    className="h-9 w-full rounded-md border border-border px-2 text-body-sm"
                    aria-label="Start date"
                  />
                  <span aria-hidden="true" className="text-muted-text">
                    –
                  </span>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    onChange={(event) => setCustomEnd(event.target.value)}
                    className="h-9 w-full rounded-md border border-border px-2 text-body-sm"
                    aria-label="End date"
                  />
                </div>
                <button
                  type="button"
                  className="w-full rounded-md bg-primary px-3 py-2 text-label-md font-semibold text-white hover:bg-primary-60"
                  onClick={() => {
                    try {
                      setCustomRange(customStart, customEnd);
                      close();
                    } catch {
                      // Invalid range: keep the current range rather than
                      // silently switching to a nonsense window.
                    }
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
          trigger={({ toggle, open, id }) => (
            <button
              type="button"
              id={id}
              onClick={toggle}
              aria-haspopup="menu"
              aria-expanded={open}
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
                    <Check aria-hidden="true" className="size-4 text-primary" />
                  ) : null}
                </DropdownItem>
              ))}
            </div>
          )}
        </Dropdown>

        {/* Notifications */}
        <Dropdown
          label={t("shell.notifications")}
          trigger={({ toggle, open, id }) => (
            <button
              type="button"
              id={id}
              onClick={toggle}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label={t("shell.notifications")}
              className={cn(ICON_BUTTON, "relative")}
            >
              <Bell aria-hidden="true" className="size-4" />
              {alertCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -end-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white"
                >
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              ) : null}
            </button>
          )}
        >
          {() => (
            <div className="w-72 p-2">
              <p className="px-2 py-3 text-body-sm text-muted-text">
                {alertCount > 0
                  ? `${alertCount} open`
                  : t("shell.notificationsEmpty")}
              </p>
            </div>
          )}
        </Dropdown>

        {/* Account */}
        <Dropdown
          label={t("shell.userMenu")}
          trigger={({ toggle, open, id }) => (
            <button
              type="button"
              id={id}
              onClick={toggle}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label={t("shell.userMenu")}
              className={cn(ICON_BUTTON, "rounded-full bg-primary text-white hover:bg-primary-60")}
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
    </header>
  );
}

/**
 * A compact period indicator used inside page headers.
 */
export function PeriodBadge() {
  const { range } = useShell();
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-label-md font-semibold text-secondary">
      <CalendarDays aria-hidden="true" className="size-4 text-muted-text" />
      {describeRange(range)}
    </span>
  );
}
