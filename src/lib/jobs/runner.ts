import type { Db } from "@/lib/repositories/types";
import {
  getAccount,
  getConnection,
  providerKeyOf,
  updateConnectionStatus,
  type AccountRecord,
  type ConnectionRecord,
} from "@/lib/repositories/connections";
import {
  isTokenFresh,
  readCredential,
  writeCredential,
} from "@/lib/providers/credentials";
import { refreshAccessToken } from "@/lib/oauth/google";
import { serverEnv } from "@/lib/env";
import { ConnectorError } from "@/providers/connector";
import { readCursor, writeCursor } from "@/lib/repositories/sync";
import { getJobHandlers } from "@/lib/jobs/handlers";
import type { SyncJob } from "@/lib/jobs/queue";

/**
 * The job execution engine.
 *
 * One job at a time:
 *   1. load the connection and the account,
 *   2. decrypt the provider credential,
 *   3. refresh the access token if it is close to expiry,
 *   4. run the handler for the job kind,
 *   5. write the facts, the cursor and the connection status.
 *
 * The same engine backs both the Vercel cron dispatcher and the container
 * worker, so there is one implementation of "run a sync".
 */

export interface JobContext {
  db: Db;
  job: SyncJob;
  connection: ConnectionRecord;
  account: AccountRecord;
  accessToken: string;
}

export interface JobResult {
  rowsWritten: number;
  notes?: string[];
  /**
   * How many provider API calls this run made.
   *
   * It is recorded against the connection's quota, so the next run knows
   * whether there is room left before the provider rejects a call.
   */
  providerCalls?: number;
}

export type JobHandler = (context: JobContext) => Promise<JobResult>;

export interface JobOutcome {
  status: "succeeded" | "failed";
  rowsWritten: number;
  errorCode?: string;
  errorMessage?: string;
  retryable: boolean;
  /**
   * When the job should be tried again. A spent quota is not a failure —
   * the work is still wanted, just not now.
   */
  deferUntil?: string;
}

/**
 * Run one job to completion.
 */
export async function runJob(
  db: Db,
  job: SyncJob,
): Promise<JobOutcome> {
  const handlers = getJobHandlers();

  const handler = handlers[job.kind];
  if (!handler) {
    // A job kind with no handler is a configuration error, not a transient
    // failure. It must not sit in the queue retrying forever.
    return {
      status: "failed",
      rowsWritten: 0,
      errorCode: "no_handler",
      errorMessage: `No handler is bound to the job kind "${job.kind}".`,
      retryable: false,
    };
  }

  if (!job.connection_id) {
    return {
      status: "failed",
      rowsWritten: 0,
      errorCode: "no_connection",
      errorMessage: "The job has no connection.",
      retryable: false,
    };
  }

  const connection = await getConnection(db, job.connection_id);
  if (!connection) {
    return {
      status: "failed",
      rowsWritten: 0,
      errorCode: "connection_missing",
      errorMessage: "The connection this job refers to no longer exists.",
      retryable: false,
    };
  }

  if (!job.account_id) {
    return {
      status: "failed",
      rowsWritten: 0,
      errorCode: "no_account",
      errorMessage: "The job has no account.",
      retryable: false,
    };
  }

  const account = await getAccount(db, job.account_id);
  if (!account) {
    return {
      status: "failed",
      rowsWritten: 0,
      errorCode: "account_missing",
      errorMessage: "The account this job refers to no longer exists.",
      retryable: false,
    };
  }

  // --- The credential ------------------------------------------------------
  const credential = await readCredential(db, connection.id);
  if (!credential) {
    await updateConnectionStatus(db, connection.id, {
      status: "needs_setup",
      errorCode: "no_credential",
      errorMessage:
        "The connection has no stored credential. Re-authorise the account.",
    });
    return {
      status: "failed",
      rowsWritten: 0,
      errorCode: "no_credential",
      errorMessage: "The connection has no stored credential.",
      retryable: false,
    };
  }

  let accessToken = credential.secrets.accessToken ?? "";

  if (!isTokenFresh(credential.secrets)) {
    const refreshed = await refreshCredential(
      db,
      connection,
      credential.secrets,
    );
    if (!refreshed) {
      await updateConnectionStatus(db, connection.id, {
        status: "permission_revoked",
        errorCode: "token_refresh_failed",
        errorMessage:
          "The provider rejected the refresh token. The account has to be re-authorised.",
      });
      return {
        status: "failed",
        rowsWritten: 0,
        errorCode: "token_refresh_failed",
        errorMessage:
          "The provider rejected the refresh token. The account has to be re-authorised.",
        retryable: false,
      };
    }
    accessToken = refreshed;
  }

  if (!accessToken) {
    return {
      status: "failed",
      rowsWritten: 0,
      errorCode: "no_access_token",
      errorMessage: "The connection has no access token.",
      retryable: false,
    };
  }

  // --- Quota ----------------------------------------------------------------
  //
  // A provider that has an operations quota is checked *before* the call, not
  // after the provider rejects it. A connection whose quota is spent is
  // deferred, not failed: the work is still wanted, just not now.
  if (
    connection.quota_limit !== null &&
    connection.quota_used >= connection.quota_limit
  ) {
    await updateConnectionStatus(db, connection.id, {
      status: "rate_limited",
      errorCode: "quota_exhausted",
      errorMessage:
        "The provider's quota for this account is spent. The sync will resume when it resets.",
    });

    return {
      status: "failed",
      rowsWritten: 0,
      errorCode: "quota_exhausted",
      errorMessage:
        "The provider's quota for this account is spent. The sync will resume when it resets.",
      retryable: true,
      deferUntil: new Date(
        Date.now() + 6 * 3600 * 1000,
      ).toISOString(),
    };
  }

  // --- Run -----------------------------------------------------------------
  try {
    const result = await handler({
      db,
      job,
      connection,
      account,
      accessToken,
    });

    await updateConnectionStatus(db, connection.id, { status: "connected" });

    // The provider call count is recorded against the connection's quota.
    if (result.providerCalls && result.providerCalls > 0) {
      await addQuotaUsage(db, connection.id, result.providerCalls);
    }

    return { status: "succeeded", rowsWritten: result.rowsWritten, retryable: false };
  } catch (error) {
    const connectorError =
      error instanceof ConnectorError
        ? error
        : new ConnectorError(
            error instanceof Error ? error.message : String(error),
            "unknown_error",
            true,
          );

    const status =
      connectorError.code === "auth_failed" || connectorError.code === "permission_denied"
        ? "permission_revoked"
        : connectorError.code === "rate_limited"
          ? "rate_limited"
          : connectorError.code === "provider_unavailable"
            ? "provider_outage"
            : "sync_stale";

    await updateConnectionStatus(db, connection.id, {
      status,
      errorCode: connectorError.code,
      errorMessage: connectorError.message,
    });

    // A rate-limited call still consumed quota, so it is counted.
    if (connectorError.code === "rate_limited") {
      await addQuotaUsage(db, connection.id, 1);
    }

    return {
      status: "failed",
      rowsWritten: 0,
      errorCode: connectorError.code,
      errorMessage: connectorError.message,
      retryable: connectorError.retryable,
    };
  }
}

/**
 * Record provider calls against the connection's quota.
 */
async function addQuotaUsage(
  db: Db,
  connectionId: string,
  calls: number,
): Promise<void> {
  const { error } = await db.rpc("add_provider_quota_usage", {
    p_connection_id: connectionId,
    p_calls: calls,
  });

  if (error) {
    // The counter is a convenience, not a gate on correctness. A failure
    // here must not fail the sync.
    console.error("could not record the quota usage", error.message);
  }
}

/**
 * Refresh a provider access token.
 *
 * Only Google is implemented; other providers use an API key or a
 * long-lived token that does not expire, so there is nothing to refresh.
 */
async function refreshCredential(
  db: Db,
  connection: ConnectionRecord,
  secrets: Record<string, unknown>,
): Promise<string | null> {
  const providerKey = providerKeyOf(connection);

  if (providerKey === "gmail" || providerKey === "ga4" || providerKey === "gsc" || providerKey === "gtm" || providerKey === "google_ads" || providerKey === "youtube") {
    const clientId = serverEnv.googleOAuthClientId();
    const clientSecret = serverEnv.googleOAuthClientSecret();
    const refreshToken = typeof secrets.refreshToken === "string" ? secrets.refreshToken : null;

    if (!clientId || !clientSecret || !refreshToken) {
      return null;
    }

    const tokens = await refreshAccessToken({ clientId, clientSecret, refreshToken });
    if (!tokens) return null;

    await writeCredential(db, connection.id, {
      ...secrets,
      accessToken: tokens.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
      // Google only returns a refresh token on the first consent.
      refreshToken: tokens.refresh_token ?? refreshToken,
    });

    return tokens.access_token;
  }

  return null;
}

/**
 * Read the checkpoint for a stream, so a handler can resume.
 */
export async function checkpointFor(
  db: Db,
  connectionId: string,
  stream: string,
): Promise<Record<string, unknown>> {
  const cursor = await readCursor(db, connectionId, stream);
  return cursor?.checkpoint ?? {};
}

/**
 * Write the checkpoint for a stream.
 */
export async function saveCheckpoint(
  db: Db,
  options: {
    workspaceId: string;
    connectionId: string;
    accountId?: string | null;
    stream: string;
    value?: string | null;
    checkpoint?: Record<string, unknown>;
  },
): Promise<void> {
  await writeCursor(db, options);
}
