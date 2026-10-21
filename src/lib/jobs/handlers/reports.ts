import type { JobHandler } from "@/lib/jobs/runner";
import { buildDigest, digestPeriod } from "@/lib/reports/digest";

/**
 * The digest handler.
 *
 * It reads a report definition, builds the digest from the records that have
 * been synced, and stores the result as a `report_runs` row. A stored digest
 * is a record of what was true at that moment: it is not recomputed when it
 * is read.
 */

interface ReportDefinitionRow {
  id: string;
  workspace_id: string;
  key: string;
  title: string;
  description: string | null;
  cadence: string;
  enabled: boolean;
  formats: string[];
  recipients: string[];
}

export const reportGenerateHandler: JobHandler = async (context) => {
  const definitionId = (context.job.payload as { definitionId?: string })
    .definitionId;

  if (!definitionId) {
    throw new Error("The report job has no definition id.");
  }

  const { data, error } = await context.db
    .from("report_definitions")
    .select(
      "id, workspace_id, key, title, description, cadence, enabled, formats, recipients",
    )
    .eq("id", definitionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read the report definition: ${error.message}`);
  }

  if (!data) {
    throw new Error("The report definition no longer exists.");
  }

  const definition = data as ReportDefinitionRow;

  if (definition.workspace_id !== context.job.workspace_id) {
    throw new Error("The report definition belongs to another workspace.");
  }

  const timezone =
    (context.job.payload as { timezone?: string }).timezone ??
    "Africa/Casablanca";
  const currency =
    (context.job.payload as { currency?: string }).currency ?? "MAD";

  const end =
    (context.job.payload as { endDate?: string }).endDate ??
    new Date().toISOString().slice(0, 10);

  const period = digestPeriod(definition.cadence, end, timezone);

  const payload = await buildDigest(context.db, {
    workspaceId: context.job.workspace_id,
    key: definition.key,
    title: definition.title,
    description: definition.description,
    cadence: definition.cadence,
    period,
    timezone,
    currency,
  });

  const { data: run, error: runError } = await context.db
    .from("report_runs")
    .insert({
      workspace_id: context.job.workspace_id,
      definition_id: definition.id,
      period_start: period.start,
      period_end: period.end,
      timezone,
      currency,
      status: "ready",
      payload,
      safe_mode: true,
      generated_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (runError) {
    throw new Error(`Could not store the report run: ${runError.message}`);
  }

  // The definition now points at its newest run and its next one.
  const { error: updateError } = await context.db
    .from("report_definitions")
    .update({
      last_run_at: new Date().toISOString(),
      next_run_at: nextRunFor(definition.cadence),
      updated_at: new Date().toISOString(),
    })
    .eq("id", definition.id);

  if (updateError) {
    console.error(
      "could not update the report definition",
      updateError.message,
    );
  }

  return {
    rowsWritten: 1,
    notes: [
      `The digest covers ${period.start} to ${period.end}.`,
      `Stored as run ${run?.id ?? "unknown"}.`,
      `${payload.sections.filter((section) => !section.available).length} section(s) had no data and say so rather than showing zero.`,
    ],
  };
};

/**
 * When the next run of a definition is due.
 *
 * A daily digest is due tomorrow, a weekly one in seven days and a monthly
 * one in thirty. A definition that is not scheduled does not recur.
 */
export function nextRunFor(cadence: string, from = new Date()): string | null {
  const days =
    cadence === "daily" ? 1 : cadence === "weekly" ? 7 : cadence === "monthly" ? 30 : 0;

  if (days === 0) return null;

  return new Date(from.getTime() + days * 86_400_000).toISOString();
}
