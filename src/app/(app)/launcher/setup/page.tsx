import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { LauncherSetup } from "@/components/launcher/launcher-setup";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { listLaunchableAccounts } from "@/lib/repositories/launcher";
import { getTranslator } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("launcher.setupWizard") };
}

/**
 * The account-launcher setup wizard.
 *
 * Walks the operator through registering the browser bridge, pairing it with
 * this deployment, and mapping each account to the browser profile that holds
 * its provider session.
 */
export default async function LauncherSetupPage() {
  const session = await getSession();
  const guard = await requirePermission(session, "launch.read");
  if (!guard.allowed) return guard.response;

  const supabase = await createClient();
  const t = await getTranslator();
  const accounts = await listLaunchableAccounts(
    supabase,
    session.workspaceId!,
  ).catch(() => []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("launcher.setupWizard")}
        subtitle={t("pages.launcher.setupSubtitle")}
      />

      <Notice tone="info" title={t("pages.launcher.boundariesTitle")}>
        {t("pages.launcher.boundariesBody")}
      </Notice>

      <LauncherSetup accounts={accounts} />
    </div>
  );
}
