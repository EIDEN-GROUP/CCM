import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  claimJobs,
  completeJob,
  outcomeForFailure,
  type SyncJob,
} from "../src/lib/jobs/queue";
import { runJob } from "../src/lib/jobs/runner";

/**
 * The CCM sync worker.
 *
 * Runs the same image as the web application, with a different command. It
 * polls the durable queue, claims a bounded batch of jobs, and runs them
 * within a lease.
 *
 * The container worker polls continuously, so it is not subject to the Vercel
 * cron's once-a-day limit on the Hobby plan.
 */

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 15000);
const BATCH_SIZE = Number(process.env.WORKER_BATCH_SIZE ?? 10);
const LEASE_SECONDS = Number(process.env.WORKER_LEASE_SECONDS ?? 300);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "[worker] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const leaseOwner = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;
let stopping = false;

function log(message: string, extra: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      component: "ccm-worker",
      leaseOwner,
      message,
      ...extra,
    }),
  );
}

async function processJob(job: SyncJob) {
  const startedAt = Date.now();

  try {
    const outcome = await runJob(db, job);
    const deferred = outcome.deferUntil !== undefined;
    await completeJob(db, job.id, {
      status: outcome.status === "succeeded" ? "succeeded" : "failed",
      rowsWritten: outcome.rowsWritten,
      durationMs: Date.now() - startedAt,
      errorCode: outcome.errorCode ?? null,
      errorMessage: outcome.errorMessage ?? null,
      // A deferred job is rescheduled rather than retried on the backoff
      // curve: the provider's quota window, not a transient error, decides
      // when it runs next.
      runAfter: outcome.deferUntil ?? null,
      deadLetter: false,
    });
    log("job completed", {
      jobId: job.id,
      kind: job.kind,
      status: outcome.status,
      rowsWritten: outcome.rowsWritten,
      durationMs: Date.now() - startedAt,
      deferred,
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
    log("job failed", {
      jobId: job.id,
      kind: job.kind,
      error: outcome.errorMessage,
      retryable: outcome.retryable,
    });
  }
}

async function tick() {
  const jobs = await claimJobs(db, {
    limit: BATCH_SIZE,
    leaseOwner,
    leaseSeconds: LEASE_SECONDS,
  });

  if (jobs.length === 0) return;
  log("claimed jobs", { count: jobs.length });

  // Sequential on purpose: provider quotas are per account, and parallelism
  // here makes rate limiting much harder to reason about.
  for (const job of jobs) {
    if (stopping) break;
    await processJob(job);
  }
}

async function main() {
  log("worker started", {
    pollIntervalMs: POLL_INTERVAL_MS,
    batchSize: BATCH_SIZE,
    leaseSeconds: LEASE_SECONDS,
    databaseConfigured: Boolean(DATABASE_URL),
  });

  while (!stopping) {
    try {
      await tick();
    } catch (error) {
      log("tick failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (stopping) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  log("worker stopped");
}

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    log("stop requested", { signal });
    stopping = true;
  });
}

main().catch((error) => {
  log("worker crashed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
