import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { DatabaseRepair } from "@/components/setup/database-repair";
import { getSession } from "@/lib/auth/session";
import { getTodayInTimezone } from "@/domain/timezone";
import { resolveRangeFromParams } from "@/lib/range-params";
import { createClient } from "@/lib/supabase/server";
import { listLaunchableAccounts } from "@/lib/repositories/launcher";
import { listWebsites } from "@/lib/repositories/websites";
import { listConnections } from "@/lib/repositories/connections";
import { listAlerts } from "@/lib/repositories/alerts";
import { computeFreshness, formatAge, SYNC_INTERVALS } from "@/domain/freshness";
import { Chip } from "@/components/ui/chip";

export const dynamic = "force-dynamic";

/**
 * The setup screen.
 *
 * It exists for one reason: to state, precisely, what is missing. A tool
 * that fails with an opaque error is worse than one that says "apply this
 * file". Every check below names the fix.
 */
export default async function SetupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const workspaceId = session.workspaceId;
  const now = new Date();

  let websites: Awaited<ReturnType<typeof listWebsites>> = [];
  let connections: Awaited<ReturnType<typeof listConnections>> = [];
  let accounts: Awaited<ReturnType<typeof listLaunchableAccounts>> = [];
  let alerts: Awaited<ReturnType<typeof listAlerts>> = [];

  if (workspaceId) {
    const supabase = await createClient();
    [websites, connections, accounts, alerts] = await Promise.all([
      listWebsites(supabase, workspaceId).catch(() => []),
      listConnections(supabase, workspaceId).catch(() => []),
      listLaunchableAccounts(supabase, workspaceId).catch(() => []),
      listAlerts(supabase, workspaceId).catch(() => []),
    ]);
  }

  const params = (await searchParams) ?? {};
  const today = getTodayInTimezone(session.workspaceTimezone);
  const { current } = resolveRangeFromParams(params, today);

  const openAlerts = alerts.filter((alert) => alert.status !== "resolved");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Setup"
        subtitle="Everything CCM needs, and exactly what is still missing."
      />

      <DatabaseRepair />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Workspace"
            subtitle="Tenancy, members and roles"
          />
          <CardBody className="space-y-3 text-body-sm text-secondary">
            <p>
              Workspace:{" "}
              <span className="font-semibold text-tertiary">
                {session.workspaceName}
              </span>{" "}
              · {session.workspaceTimezone} · {session.workspaceCurrency}
            </p>
            <p>
              Your role:{" "}
              <span className="font-semibold text-tertiary">
                {session.role ?? "none"}
              </span>
            </p>
            <p>
              Websites registered:{" "}
              <span className="font-semibold text-tertiary">
                {websites.length}
              </span>
            </p>
            <p>
              Provider connections:{" "}
              <span className="font-semibold text-tertiary">
                {connections.length}
              </span>
            </p>
            <p>
              Launchable accounts:{" "}
              <span className="font-semibold text-tertiary">
                {accounts.length}
              </span>
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Connection health"
            subtitle="Each source, its state and how old its data is"
          />
          <CardBody className="space-y-3">
            {connections.length === 0 ? (
              <p className="text-body-sm text-muted-text">
                No provider is connected yet. Connect Google Ads, GA4, Search
                Console, GTM or a mailbox from Integrations.
              </p>
            ) : (
              <ul className="space-y-2">
                {connections.map((connection) => {
                  const interval =
                    SYNC_INTERVALS[
                      connection.provider_key as keyof typeof SYNC_INTERVALS
                    ] ?? 6 * 3600;
                  const freshness = computeFreshness({
                    lastSuccessAt: connection.last_success_at,
                    lastAttemptAt: connection.last_attempt_at,
                    lastAttemptFailed: connection.status !== "connected",
                    targetIntervalSeconds: interval,
                    now,
                  });
                  return (
                    <li
                      key={connection.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-body-sm font-semibold text-tertiary">
                        {connection.display_label}
                      </span>
                      <span className="flex items-center gap-2">
                        <Chip
                          tone={
                            freshness.state === "fresh"
                              ? "success"
                              : freshness.state === "failing"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {freshness.label}
                        </Chip>
                        <span className="text-body-sm text-muted-text">
                          {connection.last_success_at
                            ? formatAge(
                                (now.getTime() -
                                  Date.parse(connection.last_success_at)) /
                                  1000,
                              )
                            : "never"}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {openAlerts.length > 0 ? (
        <Notice tone="warning" title={`${openAlerts.length} open alert(s)`}>
          Alerts and actions raised since the last sync are listed in Alerts
          &amp; Actions. The selected period is {current.start} to{" "}
          {current.end}.
        </Notice>
      ) : null}
    </div>
  );
}
