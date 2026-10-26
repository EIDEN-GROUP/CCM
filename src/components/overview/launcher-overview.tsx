"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ExternalLink, LoaderCircle, Rocket } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { ProviderIcon } from "@/components/providers/provider-icon";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { launchAccount, type LaunchResult, type LaunchPath } from "@/lib/launch/client";

export interface LauncherOverviewAccount {
  id: string;
  providerKey: string;
  providerName: string;
  displayLabel: string;
  launchMode: LaunchPath;
  browserProfileDirectory: string | null;
}

export function LauncherOverview({
  accounts,
  canLaunch,
  loadError = false,
}: {
  accounts: LauncherOverviewAccount[];
  canLaunch: boolean;
  loadError?: boolean;
}) {
  const { t } = useI18n();

  return (
    <Card className="overflow-hidden border-border/80">
      <CardHeader
        title={t("pages.overview.accountLauncher")}
        subtitle={t("pages.overview.accountLauncherSubtitle")}
        actions={
          <Link
            href="/launcher"
            className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-label-md font-semibold text-primary-ink transition-colors hover:bg-pale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
          >
            {t("pages.overview.openLauncher")}
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        }
      />
      <CardBody>
        {loadError ? (
          <p role="status" className="mb-3 rounded-md border border-warning/25 bg-warning-surface/60 px-3 py-2 text-body-sm text-warning-ink">
            {t("pages.overview.launcherLoadError")}
          </p>
        ) : accounts.length ? (
          <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account, index) => (
              <li key={account.id}>
                <LauncherAccountCard account={account} canLaunch={canLaunch} animationIndex={index} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-5 py-8 text-center">
            <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-pale text-primary-ink">
              <Rocket aria-hidden="true" className="size-5" />
            </span>
            <p className="font-semibold text-tertiary">{t("pages.overview.noConnectedLauncherAccounts")}</p>
            <p className="mt-1 max-w-md text-body-sm text-muted-text">{t("pages.overview.noConnectedLauncherAccountsHint")}</p>
            <Link
              href="/launcher"
              className="mt-4 inline-flex min-h-10 items-center rounded-md border border-primary/35 px-4 text-label-md font-semibold text-primary-ink transition-colors hover:bg-pale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
            >
              {t("pages.overview.openLauncher")}
            </Link>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function LauncherAccountCard({
  account,
  canLaunch,
  animationIndex,
}: {
  account: LauncherOverviewAccount;
  canLaunch: boolean;
  animationIndex: number;
}) {
  const { t, tp } = useI18n();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LaunchResult | null>(null);

  async function quickLaunch() {
    if (!canLaunch || busy) return;
    setBusy(true);
    setResult(null);
    try {
      setResult(await launchAccount(account.id, "account", {
        path: account.launchMode,
        profile: account.browserProfileDirectory ?? undefined,
      }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      style={{ animationDelay: `${animationIndex * 35}ms` }}
      className="provider-launch-link flex h-full flex-col gap-3 rounded-lg border border-border/80 bg-surface p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-raised motion-reduce:transform-none motion-reduce:transition-none"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-pale">
          <ProviderIcon providerKey={account.providerKey} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-label-md font-semibold text-tertiary">{account.displayLabel}</p>
          <p className="truncate text-body-xs text-muted-text">{account.providerName}</p>
        </div>
      </div>
      <Button
        size="sm"
        fullWidth
        onClick={quickLaunch}
        disabled={!canLaunch || busy}
        aria-label={tp("pages.overview.quickLaunchAccount", { account: account.displayLabel })}
        className="mt-auto"
      >
        {busy ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <ExternalLink aria-hidden="true" className="size-4" />
        )}
        {busy ? t("pages.overview.launchingAccount") : t("pages.overview.quickLaunch")}
      </Button>
      {!canLaunch ? <p className="text-center text-body-xs text-muted-text">{t("pages.overview.launchPermissionRequired")}</p> : null}
      {result ? (
        <p role={result.status === "rejected" || result.status === "unavailable" ? "alert" : "status"} className={`text-body-xs ${result.status === "opened" ? "text-success" : "text-warning-ink"}`}>
          {result.message}
        </p>
      ) : null}
    </article>
  );
}
