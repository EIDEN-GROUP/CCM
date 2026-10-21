import type { Db } from "@/lib/repositories/types";
import { enqueueJob } from "@/lib/jobs/queue";
import { nextRunFor } from "@/lib/jobs/handlers/reports";

/**
 * The digest scheduler.
 *
 * Every time the dispatcher runs, it asks which report definitions are due
 * and queues them. The definition's own `next_run_at` is the source of
 * truth, so a digest that failed to generate is retried rather than skipped
 * silently: `next_run_at` only moves when the digest has actually been
 * built.
 */

/** The result of one scheduling pass. */
export interface ScheduleResult {
  /** Definitions that were queued. */
  queued: number;
  /** Definitions that were skipped and why. */
  skipped: Array<{ key: string; reason: string }>;
}

export async function enqueueDueDigests(
  db: Db,
  options: { workspaceId?: string | null; now?: Date } = {},
): Promise<ScheduleResult> {
  const now = options.now ?? new Date();

  let query = db
    .from("report_definitions")
    .select(
      "id, workspace_id, key, title, cadence, enabled, next_run_at, last_run_at",
    )
    .eq("enabled", true);

  if (options.workspaceId) {
    query = query.eq("workspace_id", options.workspaceId);
  }

  const { data, error } = await query;

  if (error) {
    // A scheduling failure must not stop the syncs.
    console.error("could not read the report definitions", error.message);
    return { queued: 0, skipped: [] };
  }

  const definitions = (data ?? []) as Array<{
    id: string;
    workspace_id: string;
    key: string;
    title: string;
    cadence: string;
    enabled: boolean;
    next_run_at: string | null;
    last_run_at: string | null;
  }>;

  let queued = 0;
  const skipped: Array<{ key: string; reason: string }> = [];

  for (const definition of definitions) {
    // A definition with no schedule is on demand only.
    if (definition.cadence === "on_demand") {
      skipped.push({ key: definition.key, reason: "on_demand" });
      continue;
    }

    // A definition that has never run is due immediately.
    const due =
      definition.next_run_at === null ||
      definition.last_run_at === null ||
      Date.parse(definition.next_run_at) <= now.getTime();

    if (!due) {
      skipped.push({ key: definition.key, reason: "not_due" });
      continue;
    }

    // The dedupe key is the definition and the period it covers, so two
    // dispatcher runs in the same minute cannot produce two digests.
    const end = now.toISOString().slice(0, 10);

    const { created } = await enqueueJob(db, {
      workspaceId: definition.workspace_id,
      kind: "reports.generate",
      dedupeKey: `reports.generate:${definition.id}:${end}`,
      payload: { definitionId: definition.id, endDate: end },
    });

    if (created) queued += 1;
    else skipped.push({ key: definition.key, reason: "already_queued" });

    // The next run is moved forward so the schedule does not fire again on
    // the next dispatcher pass. If the job fails, the retry path still
    // picks it up.
    const next = nextRunFor(definition.cadence, now);
    if (next) {
      await db
        .from("report_definitions")
        .update({ next_run_at: next, updated_at: now.toISOString() })
        .eq("id", definition.id);
    }
  }

  return { queued, skipped };
}
