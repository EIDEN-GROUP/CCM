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
import { getTranslator } from "@/lib/i18n-server";
import { formatMessage, type MessagePathRoot, type Translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** A message key inside the `pages.alerts` namespace. */
type AlertsPath = Extract<MessagePathRoot, `pages.alerts.${string}`>;

/**
 * The alert vocabulary.
 *
 * The database stores these as short keys; the interface shows a label, and
 * the label is translated. A key the catalogue does not know falls through
 * to the stored value, so a new status is never hidden.
 */
const SEVERITY: Record<string, AlertsPath> = {
  info: "pages.alerts.severityInfo",
  warning: "pages.alerts.severityWarning",
  critical: "pages.alerts.severityCritical",
};

const ALERT_STATUS: Record<string, AlertsPath> = {
  open: "pages.alerts.statusOpen",
  acknowledged: "pages.alerts.statusAcknowledged",
  snoozed: "pages.alerts.statusSnoozed",
  resolved: "pages.alerts.statusResolved",
};

const TASK_STATUS: Record<string, AlertsPath> = {
  open: "pages.alerts.statusOpen",
  in_progress: "pages.alerts.taskStatusInProgress",
  done: "pages.alerts.taskStatusDone",
  cancelled: "pages.alerts.taskStatusCancelled",
};

const TASK_PRIORITY: Record<string, AlertsPath> = {
  high: "pages.alerts.priorityHigh",
  normal: "pages.alerts.priorityNormal",
  low: "pages.alerts.priorityLow",
};

const TASK_SOURCE: Record<string, AlertsPath> = {
  manual: "pages.alerts.sourceManual",
  rule: "pages.alerts.sourceRule",
  analyst: "pages.alerts.sourceAnalyst",
};

const RULE_DIRECTION: Record<string, AlertsPath> = {
  increase: "pages.alerts.directionIncrease",
  decrease: "pages.alerts.directionDecrease",
};

function labelFor(
  t: Translator,
  map: Record<string, AlertsPath>,
  value: string,
): string {
  const key = map[value];
  return key ? t(key) : value;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("pages.alerts.title") };
}

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

  const t = await getTranslator();

  const supabase = await createClient();
  const workspaceId = session.workspaceId!;

  const [alerts, items, rules] = await Promise.all([
    listAlerts(supabase, workspaceId).catch(() => []),
    listActionItems(supabase, workspaceId).catch(() => []),
    listAlertRules(supabase, workspaceId).catch(() => []),
  ]);

  const now = new Date();
  const openAlerts = alerts.filter((alert) => alert.status !== "resolved");

  const openAlertsLabel =
    openAlerts.length === 1
      ? t("pages.alerts.openAlertsOne")
      : formatMessage(t("pages.alerts.openAlertsOther"), {
          count: openAlerts.length,
        });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.alerts.title")}
        subtitle={t("pages.alerts.subtitle")}
      />

      <Notice tone="info" title={t("pages.alerts.whyQuietTitle")}>
        {t("pages.alerts.whyQuietBody")}
      </Notice>

      <Card>
        <CardHeader
          title={t("pages.alerts.queue")}
          subtitle={openAlertsLabel}
        />
        <CardBody className="p-0">
          <DataTable
            label={t("pages.alerts.alertsTable")}
            rows={alerts}
            empty={
              <EmptyState
                title={t("pages.alerts.emptyTitle")}
                description={t("pages.alerts.emptyBody")}
                icon={<Bell className="size-5" />}
                className="border-0"
              />
            }
            rowKey={(row) => row.id}
            columns={[
              {
                key: "title",
                header: t("pages.alerts.columnAlert"),
                mobile: "primary",
                render: (row) => (
                  <span className="font-semibold text-tertiary">{row.title}</span>
                ),
              },
              {
                key: "severity",
                header: t("pages.alerts.severity"),
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
                    {labelFor(t, SEVERITY, row.severity)}
                  </Chip>
                ),
              },
              {
                key: "reason",
                header: t("pages.alerts.columnReason"),
                mobile: "secondary",
                render: (row) => row.reason,
              },
              {
                key: "observed",
                header: t("pages.alerts.observed"),
                numeric: true,
                mobile: "secondary",
                render: (row) => row.observed ?? "—",
              },
              {
                key: "baseline",
                header: t("pages.alerts.baseline"),
                numeric: true,
                mobile: "secondary",
                render: (row) => row.baseline ?? "—",
              },
              {
                key: "status",
                header: t("pages.alerts.status"),
                mobile: "secondary",
                render: (row) => (
                  <Chip tone={row.status === "resolved" ? "success" : "neutral"}>
                    {labelFor(t, ALERT_STATUS, row.status)}
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
                header: t("pages.alerts.columnOpened"),
                mobile: "secondary",
                render: (row) =>
                  formatAge((now.getTime() - Date.parse(row.opened_at)) / 1000),
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.alerts.tasksTitle")}
          subtitle={t("pages.alerts.tasksSubtitle")}
        />
        <CardBody className="p-0">
          <DataTable
            label={t("pages.alerts.tasksTable")}
            rows={items}
            empty={
              <EmptyState
                title={t("pages.alerts.tasksEmptyTitle")}
                description={t("pages.alerts.tasksEmptyBody")}
                className="border-0"
              />
            }
            rowKey={(row) => row.id}
            columns={[
              {
                key: "title",
                header: t("pages.alerts.columnTask"),
                mobile: "primary",
                render: (row) => (
                  <span className="font-semibold text-tertiary">{row.title}</span>
                ),
              },
              {
                key: "priority",
                header: t("pages.alerts.columnPriority"),
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
                    {labelFor(t, TASK_PRIORITY, row.priority)}
                  </Chip>
                ),
              },
              {
                key: "status",
                header: t("pages.alerts.status"),
                mobile: "secondary",
                render: (row) => labelFor(t, TASK_STATUS, row.status),
              },
              {
                key: "source",
                header: t("common.source"),
                mobile: "secondary",
                render: (row) => labelFor(t, TASK_SOURCE, row.source),
              },
              {
                key: "due",
                header: t("pages.alerts.due"),
                mobile: "secondary",
                render: (row) => row.due_at?.slice(0, 10) ?? "—",
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.alerts.rules")}
          subtitle={t("pages.alerts.rulesSubtitle")}
        />
        <CardBody className="p-0">
          <DataTable
            label={t("pages.alerts.rulesTable")}
            rows={rules}
            empty={
              <EmptyState
                title={t("pages.alerts.rulesEmptyTitle")}
                description={t("pages.alerts.rulesEmptyBody")}
                className="border-0"
              />
            }
            rowKey={(row) => row.id}
            columns={[
              {
                key: "metric",
                header: t("common.metric"),
                mobile: "primary",
                render: (row) => (
                  <span className="font-semibold text-tertiary">{row.metric}</span>
                ),
              },
              {
                key: "direction",
                header: t("pages.alerts.columnDirection"),
                mobile: "secondary",
                render: (row) => labelFor(t, RULE_DIRECTION, row.direction),
              },
              {
                key: "threshold",
                header: t("pages.alerts.threshold"),
                numeric: true,
                mobile: "secondary",
                render: (row) => `${Math.round(row.threshold * 100)}%`,
              },
              {
                key: "minVolume",
                header: t("pages.alerts.minVolume"),
                numeric: true,
                mobile: "secondary",
                render: (row) => row.min_volume,
              },
              {
                key: "hysteresis",
                header: t("pages.alerts.hysteresis"),
                numeric: true,
                mobile: "secondary",
                render: (row) =>
                  formatMessage(t("pages.alerts.hysteresisWindows"), {
                    count: row.hysteresis_windows,
                  }),
              },
              {
                key: "enabled",
                header: t("pages.alerts.columnEnabled"),
                mobile: "secondary",
                render: (row) =>
                  row.enabled ? (
                    <Chip tone="success">{t("pages.alerts.on")}</Chip>
                  ) : (
                    <Chip tone="neutral">{t("pages.alerts.off")}</Chip>
                  ),
              },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}
