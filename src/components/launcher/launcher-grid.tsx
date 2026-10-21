"use client";

import { useMemo, useState } from "react";
import { Rocket } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { AccountTile } from "@/components/launcher/account-tile";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import type { LaunchableAccount } from "@/lib/launch/service";

/**
 * The account launcher grid, with the filters an operator needs when several
 * providers share one workspace: by provider, by status, by browser profile.
 */
export function LauncherGrid({
  accounts,
}: {
  accounts: LaunchableAccount[];
}) {
  const { t, tp } = useI18n();
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState("");
  const [query, setQuery] = useState("");

  const providers = useMemo(
    () => [...new Set(accounts.map((a) => a.providerName))].sort(),
    [accounts],
  );

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
      if (provider && account.providerName !== provider) return false;
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

  if (accounts.length === 0) {
    return (
      <EmptyState
        title={t("common.notConnectedTitle")}
        description={t("common.notConnectedBody")}
        icon={<Rocket className="size-5" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1">
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

        <label className="flex flex-col gap-1">
          <span className="text-label-sm font-semibold uppercase tracking-[0.04em] text-muted-text">
            {t("launcher.filterProvider")}
          </span>
          <Select
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
          >
            <option value="">{t("common.all")}</option>
            {providers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1">
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
          <label className="flex flex-col gap-1">
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

      <p className="text-body-sm text-muted-text" role="status">
        {tp("launcher.results", { count: filtered.length })}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          title={t("common.noResults")}
          description={t("common.emptyBody")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((account) => (
            <AccountTile key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}
