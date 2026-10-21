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

export const metadata: Metadata = { title: "Account Launcher" };
export const dynamic = "force-dynamic";

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
  let accounts: Awaited<ReturnType<typeof listLaunchableAccounts>> = [];

  try {
    accounts = await listLaunchableAccounts(supabase, session.workspaceId!);
  } catch (error) {
    console.error("launcher accounts query failed", error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Launcher"
        subtitle="Open your connected accounts in a real browser session."
        actions={
          <a
            href="/launcher/setup"
            className="inline-flex h-[47px] items-center justify-center gap-2 rounded-md border border-primary/35 bg-surface px-[25px] text-button-text font-semibold text-primary transition-colors hover:bg-pale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Rocket aria-hidden="true" className="size-4" />
            Set up account launching
          </a>
        }
      />

      <Notice tone="info" title="How this works">
        A valid API connection does not prove a browser session exists. CCM
        opens the exact destination for each account; the provider decides
        whether your session is still signed in, and may ask you to complete
        sign-in, MFA or a CAPTCHA. CCM never reads cookies or passwords and
        never claims a session is permanent.
      </Notice>

      <Card>
        <CardHeader
          title="Connected accounts"
          subtitle="Every account CCM can open, with its API and browser state."
        />
        <CardBody>
          <LauncherGrid accounts={accounts} />
        </CardBody>
      </Card>
    </div>
  );
}
