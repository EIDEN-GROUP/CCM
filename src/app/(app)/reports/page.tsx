import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { AnalystPanel } from "@/components/ai/analyst-panel";
import { ReportExportActions } from "@/components/reports/report-export-actions";
import { RunActionButton } from "@/components/integrations/connect-provider-button";
import {
  DigestCatalogue,
  type DigestRun,
} from "@/components/reports/digest-catalogue";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { formatAge } from "@/domain/freshness";
import { getTranslator } from "@/lib/i18n-server";
import { formatMessage, type MessagePathRoot, type Translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** A message key inside the `pages.reports` namespace. */
type ReportsPath = Extract<MessagePathRoot, `pages.reports.${string}`>;

/**
 * The report cadence.
 *
 * A definition says how often it runs; the label is translated, the key is
 * not.
 */
const CADENCE: Record<string, ReportsPath> = {
  daily: "pages.reports.daily",
  weekly: "pages.reports.weekly",
  monthly: "pages.reports.monthly",
  on_demand: "pages.reports.onDemand",
};

const RUN_STATUS: Record<string, ReportsPath> = {
  pending: "pages.reports.runStatusPending",
  ready: "pages.reports.runStatusReady",
  failed: "pages.reports.runStatusFailed",
};

function labelFor(
  t: Translator,
  map: Record<string, ReportsPath>,
  value: string,
): string {
  const key = map[value];
  return key ? t(key) : value;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("pages.reports.title") };
}

/**
 * Reports and exports.
 *
 * Exports carry the same reviewed values as the screen, plus the freshness
 * and source caveats, so a report can never quietly disagree with the
 * dashboard it came from.
 */
export default async function ReportsPage() {
  const session = await getSession();
  const guard = await requirePermission(session, "reports.read");
  if (!guard.allowed) return guard.response;

  const t = await getTranslator();

  const supabase = await createClient();
  const workspaceId = session.workspaceId!;

  const { data: definitions } = await supabase
    .from("report_definitions")
    .select(
      "id, key, title, description, cadence, formats, enabled, last_run_at, next_run_at",
    )
    .eq("workspace_id", workspaceId)
    .order("title", { ascending: true });

  const { data: runs } = await supabase
    .from("report_runs")
    .select(
      "id, definition_id, period_start, period_end, timezone, currency, status, safe_mode, generated_at, payload",
    )
    .eq("workspace_id", workspaceId)
    .order("generated_at", { ascending: false })
    .limit(20);

  const definitionRows = (definitions ?? []) as Array<{
    id: string;
    key: string;
    title: string;
    description: string | null;
    cadence: string;
    formats: string[];
    enabled: boolean;
    last_run_at: string | null;
    next_run_at: string | null;
  }>;

  // The daily digest, for the "generate" action in the header.
  const dailyDefinition = definitionRows.find(
    (definition) => definition.cadence === "daily",
  );

  const titleFor = new Map(
    definitionRows.map((definition) => [definition.id, definition.title]),
  );

  const runRows = (runs ?? []).map((run) => {
    const payload = (run.payload ?? {}) as {
      title?: string;
      sections?: DigestRun["sections"];
      caveats?: string[];
    };

    return {
      id: run.id,
      definitionId: run.definition_id,
      title:
        payload.title ??
        (run.definition_id ? titleFor.get(run.definition_id) : null) ??
        t("pages.reports.digestFallback"),
      periodStart: run.period_start,
      periodEnd: run.period_end,
      status: run.status,
      generatedAt: run.generated_at,
      sections: payload.sections ?? [],
      caveats: payload.caveats ?? [],
    } satisfies DigestRun;
  });

  const now = new Date();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.reports.title")}
        subtitle={t("pages.reports.subtitle")}
        actions={
          dailyDefinition ? (
            <RunActionButton
              label={t("pages.reports.generateDigest")}
              action="/api/reports/run"
              payload={{ definitionId: dailyDefinition.id }}
            />
          ) : null
        }
      />

      <Notice tone="info" title={t("pages.reports.exportContainsTitle")}>
        {t("pages.reports.exportContainsBody")}
      </Notice>

      <Card>
        <CardHeader
          title={t("pages.reports.scheduledDigestsTitle")}
          subtitle={t("pages.reports.scheduledDigestsSubtitle")}
        />
        <CardBody>
          <DigestCatalogue
            definitions={definitionRows.map((definition) => ({
              id: definition.id,
              key: definition.key,
              title: definition.title,
              description: definition.description,
              cadence: definition.cadence,
              enabled: definition.enabled,
              lastRunAt: definition.last_run_at,
              nextRunAt: definition.next_run_at,
            }))}
            runs={runRows}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.reports.reportCatalogueTitle")}
          subtitle={t("pages.reports.reportCatalogueSubtitle")}
          actions={<ReportExportActions />}
        />
        <CardBody className="p-0">
          <DataTable
            label={t("pages.reports.reportDefinitionsTable")}
            rows={definitions ?? []}
            empty={
              <EmptyState
                title={t("pages.reports.noDefinitionsTitle")}
                description={t("pages.reports.noDefinitionsBody")}
                icon={<FileText className="size-5" />}
                className="border-0"
              />
            }
            rowKey={(row) => (row as { id: string }).id}
            columns={[
              {
                key: "title",
                header: t("pages.reports.columnReport"),
                mobile: "primary",
                render: (row) => (
                  <span className="font-semibold text-tertiary">
                    {(row as { title: string }).title}
                  </span>
                ),
              },
              {
                key: "cadence",
                header: t("pages.reports.columnCadence"),
                mobile: "secondary",
                render: (row) =>
                  labelFor(t, CADENCE, (row as { cadence: string }).cadence),
              },
              {
                key: "formats",
                header: t("pages.reports.columnFormats"),
                mobile: "secondary",
                render: (row) =>
                  (row as { formats: string[] }).formats.join(", "),
              },
              {
                key: "lastRun",
                header: t("pages.reports.columnLastRun"),
                mobile: "secondary",
                render: (row) => {
                  const value = (row as { last_run_at: string | null }).last_run_at;
                  return value
                    ? formatAge((now.getTime() - Date.parse(value)) / 1000)
                    : "—";
                },
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.reports.recentRunsTitle")}
          subtitle={t("pages.reports.recentRunsSubtitle")}
        />
        <CardBody className="p-0">
          <DataTable
            label={t("pages.reports.reportRunsTable")}
            rows={runs ?? []}
            empty={
              <EmptyState
                title={t("pages.reports.noRunsTitle")}
                description={t("pages.reports.noRunsBody")}
                className="border-0"
              />
            }
            rowKey={(row) => (row as { id: string }).id}
            columns={[
              {
                key: "period",
                header: t("pages.reports.columnPeriod"),
                mobile: "primary",
                render: (row) => {
                  const start = (row as { period_start: string | null }).period_start;
                  const end = (row as { period_end: string | null }).period_end;
                  return start && end
                    ? formatMessage(t("pages.reports.periodTo"), { start, end })
                    : "—";
                },
              },
              {
                key: "status",
                header: t("common.status"),
                mobile: "secondary",
                render: (row) =>
                  labelFor(t, RUN_STATUS, (row as { status: string }).status),
              },
              {
                key: "safeMode",
                header: t("pages.reports.columnSafeMode"),
                mobile: "secondary",
                render: (row) =>
                  (row as { safe_mode: boolean }).safe_mode
                    ? t("pages.reports.on")
                    : t("pages.reports.off"),
              },
              {
                key: "generated",
                header: t("pages.reports.columnGenerated"),
                mobile: "secondary",
                render: (row) => {
                  const value = (row as { generated_at: string }).generated_at;
                  return formatAge(
                    (now.getTime() - Date.parse(value)) / 1000,
                  );
                },
              },
            ]}
          />
        </CardBody>
      </Card>

      <AnalystPanel enabled={Boolean(process.env.GEMINI_API_KEY)} />

      {/*
        The analyst card.

        The analyst panel above already says whether the analyst is
        available, so this card does not repeat that notice. It states
        what the reports contain and where the answers come from, in the
        product's own vocabulary: a marketer is not the person who sets an
        environment variable.
      */}
      <Card>
        <CardHeader
          title={t("pages.reports.analystCardTitle")}
          subtitle={t("pages.reports.analystCardSubtitle")}
        />
        <CardBody>
          <p className="text-body-sm text-muted-text">
            {formatMessage(t("pages.reports.analystUnavailableBody"), {
              link: t("pages.integrations.providerAppsLink"),
            })}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
