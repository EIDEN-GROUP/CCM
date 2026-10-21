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

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

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
        "Digest",
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
        title="Reports & AI Analyst"
        subtitle="Scheduled briefings and evidence-backed explanations."
        actions={
          dailyDefinition ? (
            <RunActionButton
              label="Generate the daily digest"
              action="/api/reports/run"
              payload={{ definitionId: dailyDefinition.id }}
            />
          ) : null
        }
      />

      <Notice tone="info" title="What an export contains">
        Every export carries the same reviewed values as the screen, together
        with the data freshness, the metric definitions and the caveats that
        apply. &ldquo;Share safe&rdquo; mode masks customer, mailbox and sensitive
        account identifiers before anything leaves CCM.
      </Notice>

      <Card>
        <CardHeader
          title="Scheduled digests"
          subtitle="Built by the worker from the records that have been synced"
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
          title="Report catalogue"
          subtitle="Daily, weekly and monthly briefings"
          actions={<ReportExportActions />}
        />
        <CardBody className="p-0">
          {(definitions ?? []).length === 0 ? (
            <EmptyState
              title="No report definitions"
              description="Report definitions describe which sections a briefing contains and who receives it. They are created in Settings."
              icon={<FileText className="size-5" />}
              className="border-0"
            />
          ) : (
            <DataTable
              label="Report definitions"
              rows={definitions ?? []}
              rowKey={(row) => (row as { id: string }).id}
              columns={[
                {
                  key: "title",
                  header: "Report",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">
                      {(row as { title: string }).title}
                    </span>
                  ),
                },
                {
                  key: "cadence",
                  header: "Cadence",
                  mobile: "secondary",
                  render: (row) => (row as { cadence: string }).cadence,
                },
                {
                  key: "formats",
                  header: "Formats",
                  mobile: "secondary",
                  render: (row) =>
                    (row as { formats: string[] }).formats.join(", "),
                },
                {
                  key: "lastRun",
                  header: "Last run",
                  mobile: "hidden",
                  render: (row) => {
                    const value = (row as { last_run_at: string | null }).last_run_at;
                    return value
                      ? formatAge((now.getTime() - Date.parse(value)) / 1000)
                      : "—";
                  },
                },
              ]}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Recent runs" subtitle="Generated briefings" />
        <CardBody className="p-0">
          {(runs ?? []).length === 0 ? (
            <EmptyState
              title="No reports generated yet"
              description="A run appears here once a briefing has been generated."
              className="border-0"
            />
          ) : (
            <DataTable
              label="Report runs"
              rows={runs ?? []}
              rowKey={(row) => (row as { id: string }).id}
              columns={[
                {
                  key: "period",
                  header: "Period",
                  mobile: "primary",
                  render: (row) => {
                    const start = (row as { period_start: string | null }).period_start;
                    const end = (row as { period_end: string | null }).period_end;
                    return start && end ? `${start} → ${end}` : "—";
                  },
                },
                {
                  key: "status",
                  header: "Status",
                  mobile: "secondary",
                  render: (row) => (row as { status: string }).status,
                },
                {
                  key: "safeMode",
                  header: "Share safe",
                  mobile: "secondary",
                  render: (row) =>
                    (row as { safe_mode: boolean }).safe_mode ? "On" : "Off",
                },
                {
                  key: "generated",
                  header: "Generated",
                  mobile: "hidden",
                  render: (row) => {
                    const value = (row as { generated_at: string }).generated_at;
                    return formatAge(
                      (now.getTime() - Date.parse(value)) / 1000,
                    );
                  },
                },
              ]}
            />
          )}
        </CardBody>
      </Card>

      <AnalystPanel enabled={Boolean(process.env.GEMINI_API_KEY)} />

      <Card>
        <CardHeader
          title="AI analyst"
          subtitle="Grounded answers with an inspectable trail of sources"
        />
        <CardBody className="space-y-3">
          <Notice tone="warning" title="Not yet configured">
            The analyst answers only from data CCM has synced, cites the
            records behind each claim, and says plainly when something is not
            connected, stale or unknown. It never invents a number, and it
            cannot send mail, publish content, change budgets or publish
            containers — it can only propose a task for a person to approve.
          </Notice>
          <p className="text-body-sm text-muted-text">
            Set <code className="rounded bg-surface-muted px-1.5 py-0.5 text-[13px]">GEMINI_API_KEY</code>{" "}
            to enable the grounded question interface. Without it the surface
            reports &ldquo;not configured&rdquo; rather than answering from nothing.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
