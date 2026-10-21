import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { ShellProvider } from "@/components/providers/shell-provider";
import { DemoBanner } from "@/components/demo/demo-banner";
import { ROLE_LABELS } from "@/domain/permissions";
import { getSession } from "@/lib/auth/session";
import { getTodayInTimezone } from "@/domain/timezone";

export const metadata: Metadata = {
  title: "Command Center",
};

/**
 * The authenticated application shell.
 *
 * The layout resolves the session once and hands the derived permissions to
 * the navigation. Route guards and the database policies enforce the same
 * permissions independently — the navigation only decides what to *show*.
 *
 * The date range lives in the URL. Each page reads it from its own
 * `searchParams` so the server queries exactly the window the user is
 * looking at, and the shell's period selector reads the same URL on the
 * client. Both use `resolveRangeFromParams`, so they cannot disagree.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session.configured) {
    redirect("/setup");
  }

  if (!session.userId) {
    redirect("/login");
  }

  const today = getTodayInTimezone(session.workspaceTimezone);

  return (
    <ShellProvider today={today} timezone={session.workspaceTimezone}>
      <div className="flex h-dvh flex-col overflow-hidden bg-surface">
        <DemoBanner />
        <div className="flex min-h-0 flex-1">
          <Sidebar permissions={session.permissions} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar
              userEmail={session.userEmail}
              workspaceName={session.workspaceName}
              roleLabel={session.role ? ROLE_LABELS[session.role] : "—"}
            />
            <main
              id="main-content"
              className="scrollbar-calm flex-1 overflow-y-auto bg-surface-muted/40"
            >
              <div className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6 md:py-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </ShellProvider>
  );
}
