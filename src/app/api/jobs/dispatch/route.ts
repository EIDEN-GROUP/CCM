import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import {
  claimJobs,
  completeJob,
  outcomeForFailure,
} from "@/lib/jobs/queue";
import { runJob } from "@/lib/jobs/runner";
import { enqueueDueDigests } from "@/lib/reports/scheduler";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";
// Vercel Cron and the container worker both call this endpoint.
export const maxDuration = 60;

/**
 * The job dispatcher.
 *
 * Claims a **bounded** batch of jobs and processes them. It never fetches
 * "every account in one go" — each job names its own slice.
 *
 * Authorised with the `CRON_SECRET` bearer token. The same route backs the
 * Vercel cron, the Supabase cron and a manual trigger.
 */
export async function POST(request: Request) {
  const secret = serverEnv.cronSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "The job dispatcher is not configured" },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const db = createAdminClient();
  const leaseOwner = `dispatcher-${randomUUID().slice(0, 8)}`;
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 10);
  const workspaceId = url.searchParams.get("workspaceId");

  /**
   * How many jobs are still waiting.
   *
   * On a daily schedule the dispatcher claims one bounded batch and stops,
   * so the backlog is the number that says whether the cadence is keeping
   * up. Without it a daily run looks exactly like a successful run on a
   * quiet day.
   */
  const countQueued = async () => {
    let query = db
      .from("sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued")
      .lte("run_after", new Date().toISOString());

    if (workspaceId) query = query.eq("workspace_id", workspaceId);

    const { count } = await query;
    return count ?? 0;
  };

  const queuedBefore = await countQueued();

  // The digests that are due are queued first, so a scheduled report is not
  // held behind a long sync batch.
  const scheduled = await enqueueDueDigests(db, {
    workspaceId: workspaceId ?? null,
  });

  const jobs = await claimJobs(db, {
    workspaceId: workspaceId ?? null,
    limit: Math.max(1, Math.min(limit, 25)),
    leaseOwner,
    leaseSeconds: Number(process.env.WORKER_LEASE_SECONDS ?? 300),
  });

  const results: Array<{
    jobId: string;
    kind: string;
    status: string;
    rowsWritten?: number;
    error?: string;
  }> = [];

  for (const job of jobs) {
    const startedAt = Date.now();
    try {
      const outcome = await runJob(db, job);
      await completeJob(db, job.id, {
        status: outcome.status === "succeeded" ? "succeeded" : "failed",
        rowsWritten: outcome.rowsWritten,
        durationMs: Date.now() - startedAt,
        errorCode: outcome.errorCode ?? null,
        errorMessage: outcome.errorMessage ?? null,
        // A deferred job is rescheduled rather than retried on the backoff
        // curve: the provider's quota window decides when it runs next.
        runAfter: outcome.deferUntil ?? null,
        deadLetter: false,
      });
      results.push({
        jobId: job.id,
        kind: job.kind,
        status: outcome.status,
        rowsWritten: outcome.rowsWritten,
        ...(outcome.errorMessage ? { error: outcome.errorMessage } : {}),
      });
    } catch (error) {
      const outcome = outcomeForFailure(job, error);
      await completeJob(db, job.id, {
        status: outcome.status,
        rowsWritten: 0,
        durationMs: Date.now() - startedAt,
        errorCode: outcome.errorCode,
        errorMessage: outcome.errorMessage,
        runAfter: outcome.runAfter,
        deadLetter: outcome.deadLetter,
      });
      results.push({
        jobId: job.id,
        kind: job.kind,
        status: outcome.status,
        error: outcome.errorMessage,
      });
    }
  }

  return NextResponse.json({
    claimed: jobs.length,
    processed: results.length,
    leaseOwner,
    scheduledDigests: scheduled.queued,
    /**
     * The jobs that were still waiting when this run finished. A backlog
     * that keeps growing means the schedule is too slow for the work.
     */
    queuedBefore,
    queuedRemaining: Math.max(0, queuedBefore - jobs.length),
    results,
  });
}
