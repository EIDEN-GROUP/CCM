"use client";

import { createElement, useState } from "react";
import { CircleCheck, CircleX, ExternalLink, FlaskConical, LoaderCircle } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { StatusBadge, type Tone } from "@/components/ui/chip";
import { getIcon, PROVIDER_ICONS } from "@/components/ui/icons";
import { launchAccount, type LaunchResult } from "@/lib/launch/client";
import { cn } from "@/lib/cn";
import type { LaunchableAccount } from "@/lib/launch/service";

/**
 * One account tile.
 *
 * The card shows two independent states — the API connection and the browser
 * session — because they fail for different reasons and mean different
 * things. A green API badge next to a red browser badge is normal and
 * informative, not a contradiction.
 */
export function AccountTile({
  account,
  onResult,
}: {
  account: LaunchableAccount;
  onResult?: (result: LaunchResult) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LaunchResult | null>(null);

  const iconName = PROVIDER_ICONS[account.providerKey] ?? "Plug";

  const apiTone: Tone =
    account.apiStatus === "connected"
      ? "success"
      : account.apiStatus === "needs_setup"
        ? "warning"
        : "danger";

  const browserTone: Tone =
    account.status === "ready"
      ? "success"
      : account.status === "profile_unmapped"
        ? "warning"
        : "danger";

  async function run(mode: "account" | "management") {
    setBusy(true);
    setResult(null);
    const outcome = await launchAccount(account.id, mode, {
      path: account.launchMode,
      profile: account.browserProfileDirectory ?? undefined,
    });
    setResult(outcome);
    onResult?.(outcome);
    setBusy(false);
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pale text-primary-ink"
        >
          {createElement(getIcon(iconName), { className: "size-[18px]" })}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-headline-sm font-semibold text-tertiary">
            {account.providerName}
          </h3>
          <p className="truncate text-body-sm text-muted-text">
            {account.displayLabel}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <StatusBadge
          tone={browserTone}
          label={t(
            account.status === "ready"
              ? "browser.ready"
              : account.status === "profile_unmapped"
                ? "browser.profileUnmapped"
                : account.status === "extension_not_paired"
                  ? "browser.extensionNotPaired"
                  : account.status === "helper_unavailable"
                    ? "browser.helperUnavailable"
                    : "browser.browserUnsupported",
          )}
        />
        <StatusBadge
          tone={apiTone}
          label={t(
            account.apiStatus === "connected"
              ? "api.connected"
              : account.apiStatus === "needs_setup"
                ? "api.needsSetup"
                : account.apiStatus === "token_refresh_failed"
                  ? "api.tokenRefreshFailed"
                  : account.apiStatus === "permission_revoked"
                    ? "api.permissionRevoked"
                    : account.apiStatus === "provider_outage"
                      ? "api.providerOutage"
                      : account.apiStatus === "rate_limited"
                        ? "api.rateLimited"
                        : "api.syncStale",
          )}
        />
      </div>

      <p className="text-body-sm text-muted-text">
        {t("shell.browserProfile")}:{" "}
        <span className="font-semibold text-secondary">
          {account.browserProfileLabel ?? t("launcher.noProfile")}
        </span>
      </p>

      {account.missing.length > 0 ? (
        <p className="rounded-md border border-warning/25 bg-warning-surface/60 px-3 py-2 text-body-sm text-warning-ink">
          {account.missing.join(" · ")}
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-2">
        <Button
          size="sm"
          onClick={() => run("account")}
          disabled={busy || !account.accountUrl}
          fullWidth
        >
          {busy ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <ExternalLink aria-hidden="true" className="size-4" />
          )}
          {t("launcher.openAccount")}
        </Button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => run("management")}
            disabled={busy || !account.managementUrl}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5",
              "text-label-md font-semibold text-primary-ink transition-colors hover:bg-pale",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink",
              "disabled:cursor-not-allowed disabled:text-muted-text disabled:hover:bg-transparent",
            )}
          >
            <ExternalLink aria-hidden="true" className="size-3.5" />
            {t("launcher.openManagement")}
          </button>
          <button
            type="button"
            onClick={() => run("account")}
            disabled={busy || !account.accountUrl}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5",
              "text-label-md font-semibold text-muted-text transition-colors hover:bg-surface-muted",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink",
              "disabled:cursor-not-allowed",
            )}
          >
            <FlaskConical aria-hidden="true" className="size-3.5" />
            {t("launcher.testLaunch")}
          </button>
        </div>
      </div>

      {result ? <LaunchFeedback result={result} /> : null}
    </article>
  );
}

/**
 * The result of a launch attempt.
 *
 * The wording is deliberately careful: a successful launch reports that a tab
 * was opened, never that the provider session is authenticated.
 */
function LaunchFeedback({ result }: { result: LaunchResult }) {
  const { t } = useI18n();

  if (result.status === "opened") {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-md border border-primary/25 bg-pale px-3 py-2 text-body-sm text-primary-ink"
      >
        <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="font-semibold">{t("launcher.launchSucceeded")}</span>{" "}
          — {result.message}
        </span>
      </p>
    );
  }

  if (result.status === "blocked") {
    return (
      <div
        role="status"
        className="rounded-md border border-warning/25 bg-warning-surface/60 px-3 py-2 text-body-sm text-warning-ink"
      >
        <p className="font-semibold">{t("launcher.launchBlocked")}</p>
        <p className="mt-0.5">{result.message}</p>
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-block font-semibold text-primary-ink underline"
        >
          {t("common.open")} {result.host}
        </a>
      </div>
    );
  }

  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-error/30 bg-error-surface/60 px-3 py-2 text-body-sm text-error-ink"
    >
      <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="font-semibold">{t("launcher.launchRejected")}</span>{" "}
        — {result.message}
      </span>
    </p>
  );
}
