import type { Metadata } from "next";
import { Rocket } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LauncherGrid } from "@/components/launcher/launcher-grid";
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

  try {
    accounts = await listLaunchableAccounts(supabase, session.workspaceId!);
  } catch (error) {
    console.error("launcher accounts query failed", error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("launcher.title")}
        subtitle={t("launcher.subtitle")}
        actions={
          <a
            href="/launcher/setup"
            className="inline-flex h-[47px] items-center justify-center gap-2 rounded-md border border-primary/35 bg-surface px-[25px] text-button-text font-semibold text-primary-ink transition-colors hover:bg-pale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
          >
            <Rocket aria-hidden="true" className="size-4" />
            {t("launcher.setupWizard")}
          </a>
        }
      />

      <Notice tone="info" title={t("pages.launcher.howItWorksTitle")}>
        {t("pages.launcher.howItWorksBody")}
      </Notice>

      <Card>
        <CardHeader
          title={t("pages.launcher.connectedAccountsTitle")}
          subtitle={t("pages.launcher.connectedAccountsSubtitle")}
        />
        <CardBody>
          <LauncherGrid accounts={accounts} />
        </CardBody>
      </Card>
    </div>
  );
}
