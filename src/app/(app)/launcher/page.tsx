import type { Metadata } from "next";
import { RefreshCw, Rocket } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { LauncherGrid } from "@/components/launcher/launcher-grid";
import { AddLoginAccount } from "@/components/launcher/add-login-account";
import { Notice } from "@/components/ui/notice";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listLaunchableAccounts } from "@/lib/repositories/launcher";
import { requirePermission } from "@/lib/auth/guard";
import { getTranslator } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("launcher.title") };
}

/**
 * The Account Launcher.
 *
 * Release-blocking feature: every provider tile must open the exact
 * configured account destination, in a browser session the user controls.
 */
export default async function LauncherPage() {
  const session = await getSession();
  const guard = await requirePermission(session, "launch.read");
  if (!guard.allowed) return guard.response;

  const supabase = await createClient();
  const t = await getTranslator();
  let accounts: Awaited<ReturnType<typeof listLaunchableAccounts>> = [];
  let accountsUnavailable = false;

  try {
    accounts = await listLaunchableAccounts(supabase, session.workspaceId!);
  } catch (error) {
    console.error("launcher accounts query failed", error);
    accountsUnavailable = true;
  }

  const readyAccounts = accounts.filter((account) => account.status === "ready").length;
  const attentionAccounts = accounts.length - readyAccounts;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("launcher.title")}
        subtitle={t("launcher.subtitle")}
        actions={
          <a
            href="/launcher/setup"
            className="inline-flex h-[47px] w-full items-center justify-center gap-2 rounded-md border border-primary/35 bg-surface px-4 text-button-text font-semibold text-primary-ink transition-colors hover:bg-pale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink sm:w-auto sm:px-[25px]"
          >
            <Rocket aria-hidden="true" className="size-4" />
            {t("launcher.setupWizard")}
          </a>
        }
      />

      <AddLoginAccount
        canManage={session.permissions.has("integrations.manage")}
        defaultOpen={accounts.length === 0 && !accountsUnavailable}
      />

      {accountsUnavailable ? (
        <Notice tone="danger" title={t("pages.launcher.accountsLoadErrorTitle")}>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>{t("pages.launcher.accountsLoadErrorBody")}</p>
            <a
              href="/launcher"
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 font-semibold text-error-ink underline decoration-error/40 underline-offset-2 hover:bg-error-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-ink"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              {t("pages.launcher.reloadAccounts")}
            </a>
          </div>
        </Notice>
      ) : (
        <>
          <section
            aria-label={t("pages.launcher.accountSummary")}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <LauncherSummaryStat
              label={t("pages.launcher.totalAccounts")}
              value={accounts.length}
              tone="neutral"
            />
            <LauncherSummaryStat
              label={t("pages.launcher.readyAccounts")}
              value={readyAccounts}
              tone="success"
            />
            <LauncherSummaryStat
              label={t("pages.launcher.attentionAccounts")}
              value={attentionAccounts}
              tone={attentionAccounts > 0 ? "warning" : "neutral"}
            />
          </section>

          <Card>
            <CardHeader
              title={t("pages.launcher.connectedAccountsTitle")}
              subtitle={t("pages.launcher.connectedAccountsSubtitle")}
            />
            <CardBody>
              <LauncherGrid
                accounts={accounts}
                canManageCredentials={session.permissions.has("integrations.manage")}
                canExecute={session.permissions.has("launch.execute")}
              />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

function LauncherSummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "warning";
}) {
  const valueColor =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning-ink"
        : "text-tertiary";

  return (
    <StatCard className="flex min-h-[104px] items-center justify-between gap-3 p-4">
      <p className="max-w-[14rem] text-body-sm font-medium text-muted-text">{label}</p>
      <p className={`text-headline-lg font-bold tabular-nums ${valueColor}`}>
        {value}
      </p>
    </StatCard>
  );
}
