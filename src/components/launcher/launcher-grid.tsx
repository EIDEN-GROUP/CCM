"use client";

import { useMemo, useState } from "react";
import { Rocket } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { AccountTile } from "@/components/launcher/account-tile";
import { Input, Select } from "@/components/ui/input";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import type { LaunchableAccount } from "@/lib/launch/service";
import { PROVIDER_LIST } from "@/providers/registry";

/**
 * The account launcher grid, with the filters an operator needs when several
 * providers share one workspace: by provider, by status, by browser profile.
 */
export function LauncherGrid({
  accounts,
  canManageCredentials,
  canExecute,
  initialProvider = "",
}: {
  accounts: LaunchableAccount[];
  canManageCredentials: boolean;
  canExecute: boolean;
  initialProvider?: string;
}) {
  const { t, tp } = useI18n();
  const [provider, setProvider] = useState(initialProvider);
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState("");
  const [query, setQuery] = useState("");

  const profiles = useMemo(
    () => [
      ...new Set(
        accounts
          .map((a) => a.browserProfileLabel)
          .filter((value): value is string => Boolean(value)),
      ),
    ].sort(),
    [accounts],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return accounts.filter((account) => {
      if (provider && account.providerKey !== provider) return false;
      if (status && account.status !== status) return false;
      if (profile && account.browserProfileLabel !== profile) return false;
      if (
        needle &&
        !`${account.providerName} ${account.displayLabel} ${account.externalAccountId ?? ""}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [accounts, provider, status, profile, query]);

  const filtersActive = Boolean(query.trim() || provider || status || profile);

  function clearFilters() {
    setQuery("");
    setProvider("");
    setStatus("");
    setProfile("");
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        title={t("pages.launcher.launcherEmptyTitle")}
        description={t("pages.launcher.launcherEmptyBody")}
        icon={<Rocket className="size-5" />}
        action={
          canManageCredentials ? (
            <ButtonLink href="/integrations">{t("pages.launcher.connectAccount")}</ButtonLink>
          ) : null
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="flex min-w-0 flex-col gap-1 xl:col-span-2">
          <span className="text-label-sm font-semibold uppercase tracking-[0.04em] text-muted-text">
            {t("common.search")}
          </span>
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("shell.searchPlaceholder")}
          />
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-label-sm font-semibold uppercase tracking-[0.04em] text-muted-text">
            {t("launcher.filterProvider")}
          </span>
          <Select
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
          >
            <option value="">{t("common.all")}</option>
            {PROVIDER_LIST.map((item) => (
              <option key={item.key} value={item.key}>
                {item.displayName}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-label-sm font-semibold uppercase tracking-[0.04em] text-muted-text">
            {t("launcher.filterStatus")}
          </span>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">{t("common.all")}</option>
            <option value="ready">{t("browser.ready")}</option>
            <option value="profile_unmapped">
              {t("browser.profileUnmapped")}
            </option>
            <option value="extension_not_paired">
              {t("browser.extensionNotPaired")}
            </option>
            <option value="helper_unavailable">
              {t("browser.helperUnavailable")}
            </option>
            <option value="browser_unsupported">
              {t("browser.browserUnsupported")}
            </option>
          </Select>
        </label>

        {profiles.length > 0 ? (
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-label-sm font-semibold uppercase tracking-[0.04em] text-muted-text">
              {t("launcher.filterProfile")}
            </span>
            <Select
              value={profile}
              onChange={(event) => setProfile(event.target.value)}
            >
              <option value="">{t("common.all")}</option>
              {profiles.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-sm text-muted-text" role="status" aria-live="polite">
          {tp("launcher.results", { count: filtered.length })}
        </p>
        {filtersActive ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            {t("pages.launcher.clearFilters")}
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t("common.noResults")}
          description={t("common.emptyBody")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((account) => (
            <AccountTile
              key={account.id}
              account={account}
              canManageCredentials={canManageCredentials}
              canLaunch={canExecute}
            />
          ))}
        </div>
      )}
    </div>
  );
}
