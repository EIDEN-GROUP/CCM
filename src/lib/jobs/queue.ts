import type { Db } from "@/lib/repositories/types";
import { ConnectorError } from "@/providers/connector";

/**
 * The durable sync queue.
 *
 * The queue lives in Postgres so it survives serverless cold starts, function
 * time limits and process restarts. A dispatcher claims a *bounded* batch of
 * jobs, runs them, and records the outcome. Nothing here ever fetches "all
 * accounts in one go".
 */

export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "dead_letter"
  | "cancelled";

export interface SyncJob {
  id: string;
  workspace_id: string;
  connection_id: string | null;
  account_id: string | null;
  kind: string;
  status: JobStatus;
  dedupe_key: string;
  payload: Record<string, unknown>;
  run_after: string;
  attempts: number;
  max_attempts: number;
  locked_until: string | null;
  lease_owner: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Enqueue a job.
 *
 * The dedupe key makes the enqueue idempotent: two requests for the same
 * account, provider and date range collapse into one job.
 */
export async function enqueueJob(
  db: Db,
  job: {
    workspaceId: string;
    connectionId?: string | null;
    accountId?: string | null;
    kind: string;
    dedupeKey: string;
    payload?: Record<string, unknown>;
    runAfter?: string;
    maxAttempts?: number;
  },
): Promise<{ id: string; created: boolean }> {
  const { data, error } = await db
    .from("sync_jobs")
    .upsert(
      {
        workspace_id: job.workspaceId,
        connection_id: job.connectionId ?? null,
        account_id: job.accountId ?? null,
        kind: job.kind,
        status: "queued",
        dedupe_key: job.dedupeKey,
        payload: job.payload ?? {},
        run_after: job.runAfter ?? new Date().toISOString(),
        max_attempts: job.maxAttempts ?? 5,
      },
      { onConflict: "workspace_id,dedupe_key", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not enqueue the sync job: ${error.message}`);
  }

  return { id: data?.id ?? "", created: Boolean(data) };
}

/**
 * Claim a bounded batch of jobs.
 *
 * The claim happens inside a Postgres function that uses `FOR UPDATE SKIP
 * LOCKED`, so two dispatchers never take the same job.
 */
export async function claimJobs(
  db: Db,
  options: {
    workspaceId?: string | null;
    limit?: number;
    leaseOwner: string;
    leaseSeconds?: number;
  },
): Promise<SyncJob[]> {
  const { data, error } = await db.rpc("claim_sync_jobs", {
    p_workspace_id: options.workspaceId ?? null,
    p_limit: options.limit ?? 10,
    p_lease_owner: options.leaseOwner,
    p_lease_seconds: options.leaseSeconds ?? 300,
  });

  if (error) {
    throw new Error(`Could not claim sync jobs: ${error.message}`);
  }
  return (data ?? []) as SyncJob[];
}

/**
 * Record the outcome of a job.
 */
export async function completeJob(
  db: Db,
  jobId: string,
  outcome: {
    status: JobStatus;
    rowsWritten?: number;
    durationMs?: number;
    errorCode?: string | null;
    errorMessage?: string | null;
    runAfter?: string | null;
    deadLetter?: boolean;
  },
): Promise<void> {
  const { error } = await db.rpc("complete_sync_job", {
    p_job_id: jobId,
    p_status: outcome.status,
    p_rows_written: outcome.rowsWritten ?? null,
    p_duration_ms: outcome.durationMs ?? null,
    p_error_code: outcome.errorCode ?? null,
    p_error_message: outcome.errorMessage ?? null,
    p_run_after: outcome.runAfter ?? null,
    p_dead_letter: outcome.deadLetter ?? false,
  });

  if (error) {
    console.error("could not complete sync job", error.message);
  }
}

/**
 * Record a failure for the connection health panel.
 */
export async function recordSyncError(
  db: Db,
  error: {
    workspaceId: string;
    connectionId?: string | null;
    jobId?: string | null;
    code: string;
    message: string;
    retryable: boolean;
  },
): Promise<void> {
  const { error: rpcError } = await db.rpc("record_sync_error", {
    p_workspace_id: error.workspaceId,
    p_connection_id: error.connectionId ?? null,
    p_job_id: error.jobId ?? null,
    p_error_code: error.code,
    p_error_message: error.message.slice(0, 2000),
    p_retryable: error.retryable,
  });

  if (rpcError) {
    console.error("could not record sync error", rpcError.message);
  }
}

/**
 * Exponential backoff with jitter.
 *
 * Jitter matters: without it, a provider outage makes every job in the batch
 * retry at the same moment, which is exactly what causes the retry storm.
 */
export function computeBackoffSeconds(
  attempt: number,
  options: { baseSeconds?: number; maxSeconds?: number; jitterRatio?: number } = {},
): number {
  const base = options.baseSeconds ?? 60;
  const max = options.maxSeconds ?? 3600;
  const jitterRatio = options.jitterRatio ?? 0.25;

  const exponential = Math.min(max, base * 2 ** Math.max(0, attempt - 1));
  // Full jitter within a band around the exponential value.
  const jitter = exponential * jitterRatio * (Math.random() * 2 - 1);
  return Math.max(1, Math.round(exponential + jitter));
}

/**
 * Whether a failed job should be retried or dead-lettered.
 */
export function shouldRetry(job: SyncJob): boolean {
  if (job.attempts >= job.max_attempts) return false;
  // An auth failure will not fix itself by trying again; a human has to
  // reconnect the account.
  if (job.last_error && AUTH_ERROR_CODES.has(job.last_error)) return false;
  return true;
}

const AUTH_ERROR_CODES = new Set([
  "auth_failed",
  "permission_denied",
  "token_refresh_failed",
  "permission_revoked",
]);

/**
 * Turn a connector failure into a job outcome.
 */
export function outcomeForFailure(
  job: SyncJob,
  error: unknown,
): {
  status: JobStatus;
  deadLetter: boolean;
  runAfter: string | null;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
} {
  const connectorError =
    error instanceof ConnectorError
      ? error
      : new ConnectorError(
          error instanceof Error ? error.message : "Unknown error",
          "unknown_error",
          true,
        );

  const retryable = connectorError.retryable && shouldRetry(job);
  const backoff = computeBackoffSeconds(job.attempts);

  return {
    status: retryable ? "queued" : "failed",
    deadLetter: !retryable && job.attempts >= job.max_attempts,
    runAfter: retryable
      ? new Date(Date.now() + backoff * 1000).toISOString()
      : null,
    errorCode: connectorError.code,
    errorMessage: connectorError.message,
    retryable,
  };
}
