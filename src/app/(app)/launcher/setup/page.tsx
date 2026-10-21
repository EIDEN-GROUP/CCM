import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { LauncherSetup } from "@/components/launcher/launcher-setup";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { listLaunchableAccounts } from "@/lib/repositories/launcher";

export const metadata: Metadata = { title: "Set up account launching" };
export const dynamic = "force-dynamic";

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
  const accounts = await listLaunchableAccounts(
    supabase,
    session.workspaceId!,
  ).catch(() => []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Set up account launching"
        subtitle="Map each account to the browser profile that holds its provider session."
      />

      <Notice tone="info" title="What this does and does not do">
        A hosted page cannot read another site&apos;s cookies or force a
        different browser profile to open. What it can do — and what this
        wizard configures — is open the exact account destination in the
        browser you are using, and, with the bridge extension installed, open
        it in the profile where the extension lives. A provider session may
        still have expired; CCM shows that plainly and lets you sign in
        normally.
      </Notice>

      <LauncherSetup accounts={accounts} />
    </div>
  );
}
