import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { AlertActions } from "@/components/alerts/alert-actions";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import {
  listActionItems,
  listAlertRules,
  listAlerts,
} from "@/lib/repositories/alerts";
import { formatAge } from "@/domain/freshness";

export const metadata: Metadata = { title: "Alerts & Actions" };
export const dynamic = "force-dynamic";

/**
 * The unified action queue.
 *
 * Every alert states the evidence that produced it: the observed value, the
 * baseline it was compared against, and the rule that fired.
 */
export default async function AlertsPage() {
  const session = await getSession();
  const guard = await requirePermission(session, "alerts.read");
  if (!guard.allowed) return guard.response;

  const supabase = await createClient();
  const workspaceId = session.workspaceId!;

  const [alerts, items, rules] = await Promise.all([
    listAlerts(supabase, workspaceId).catch(() => []),
    listActionItems(supabase, workspaceId).catch(() => []),
    listAlertRules(supabase, workspaceId).catch(() => []),
  ]);

  const now = new Date();
  const openAlerts = alerts.filter((alert) => alert.status !== "resolved");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts & Actions"
        subtitle="Evidence, impact, owner and resolution history."
      />

      <Notice tone="info" title="Why alerts stay quiet">
        A rule needs a minimum volume, a grace period while it learns its
        baseline, a hysteresis window before it auto-resolves, and a repeat
        interval before it fires again. Low-volume metrics and weekend dips
        therefore do not fill the queue with noise.
      </Notice>

      <Card>
        <CardHeader
          title="Action queue"
          subtitle={`${openAlerts.length} open alert${openAlerts.length === 1 ? "" : "s"}`}
        />
        <CardBody className="p-0">
          {alerts.length === 0 ? (
            <EmptyState
              title="No alerts"
              description="Alerts appear when a rule breaches its threshold. Create rules from the Rules tab once a source is connected."
              icon={<Bell className="size-5" />}
              className="border-0"
            />
          ) : (
            <DataTable
              label="Alerts"
              rows={alerts}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "title",
                  header: "Alert",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">{row.title}</span>
                  ),
                },
                {
                  key: "severity",
                  header: "Severity",
                  mobile: "secondary",
                  render: (row) => (
                    <Chip
                      tone={
                        row.severity === "critical"
                          ? "danger"
                          : row.severity === "warning"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {row.severity}
                    </Chip>
                  ),
                },
                {
                  key: "reason",
                  header: "Reason",
                  mobile: "hidden",
                  render: (row) => row.reason,
                },
                {
                  key: "observed",
                  header: "Observed",
                  numeric: true,
                  mobile: "secondary",
                  render: (row) => row.observed ?? "—",
                },
                {
                  key: "baseline",
                  header: "Baseline",
                  numeric: true,
                  mobile: "hidden",
                  render: (row) => row.baseline ?? "—",
                },
                {
                  key: "status",
                  header: "Status",
                  mobile: "secondary",
                  render: (row) => (
                    <Chip tone={row.status === "resolved" ? "success" : "neutral"}>
                      {row.status}
                    </Chip>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  mobile: "secondary",
                  render: (row) => (
                    <AlertActions
                      alertId={row.id}
                      status={row.status}
                      canManage={session.permissions.has("alerts.manage")}
                    />
                  ),
                },
                {
                  key: "opened",
                  header: "Opened",
                  mobile: "hidden",
                  render: (row) =>
                    formatAge((now.getTime() - Date.parse(row.opened_at)) / 1000),
                },
              ]}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Tasks"
          subtitle="Work items raised by rules, by the AI analyst, or by a person"
        />
        <CardBody className="p-0">
          {items.length === 0 ? (
            <EmptyState
              title="No tasks"
              description="Tasks are created from an alert, or proposed by the AI analyst for you to approve."
              className="border-0"
            />
          ) : (
            <DataTable
              label="Action items"
              rows={items}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "title",
                  header: "Task",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">{row.title}</span>
                  ),
                },
                {
                  key: "priority",
                  header: "Priority",
                  mobile: "secondary",
                  render: (row) => (
                    <Chip
                      tone={
                        row.priority === "high"
                          ? "danger"
                          : row.priority === "low"
                            ? "neutral"
                            : "warning"
                      }
                    >
                      {row.priority}
                    </Chip>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  mobile: "secondary",
                  render: (row) => row.status.replace(/_/g, " "),
                },
                {
                  key: "source",
                  header: "Source",
                  mobile: "hidden",
                  render: (row) => row.source,
                },
                {
                  key: "due",
                  header: "Due",
                  mobile: "hidden",
                  render: (row) => row.due_at?.slice(0, 10) ?? "—",
                },
              ]}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Alert rules"
          subtitle="Thresholds, minimum volume, hysteresis and quiet periods"
        />
        <CardBody className="p-0">
          {rules.length === 0 ? (
            <EmptyState
              title="No rules configured"
              description="A rule needs a metric, a direction, a threshold and a minimum volume before it can fire."
              className="border-0"
            />
          ) : (
            <DataTable
              label="Alert rules"
              rows={rules}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "metric",
                  header: "Metric",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">{row.metric}</span>
                  ),
                },
                {
                  key: "direction",
                  header: "Direction",
                  mobile: "secondary",
                  render: (row) => row.direction,
                },
                {
                  key: "threshold",
                  header: "Threshold",
                  numeric: true,
                  mobile: "secondary",
                  render: (row) => `${Math.round(row.threshold * 100)}%`,
                },
                {
                  key: "minVolume",
                  header: "Min. volume",
                  numeric: true,
                  mobile: "hidden",
                  render: (row) => row.min_volume,
                },
                {
                  key: "hysteresis",
                  header: "Hysteresis",
                  numeric: true,
                  mobile: "hidden",
                  render: (row) => `${row.hysteresis_windows} windows`,
                },
                {
                  key: "enabled",
                  header: "Enabled",
                  mobile: "secondary",
                  render: (row) =>
                    row.enabled ? (
                      <Chip tone="success">On</Chip>
                    ) : (
                      <Chip tone="neutral">Off</Chip>
                    ),
                },
              ]}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
