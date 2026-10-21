import type { Db } from "@/lib/repositories/types";
import type { ProviderKey } from "@/providers/registry";

/**
 * Reading and updating a provider connection and its accounts.
 *
 * Writes go through the service-role client when the caller is the sync
 * worker. The `updateConnectionStatus` function is the single place that
 * records success, failure and the reason, so the Integrations screen and
 * the freshness calculations can never disagree.
 */

export interface ConnectionRecord {
  id: string;
  workspace_id: string;
  provider_key: string;
  display_label: string;
  status: string;
  auth_mode: string;
  scopes: string[];
  account_timezone: string | null;
  account_currency: string | null;
  api_access_level: string | null;
  quota_limit: number | null;
  quota_used: number;
  last_success_at: string | null;
  last_attempt_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
}

export interface AccountRecord {
  id: string;
  workspace_id: string;
  connection_id: string | null;
  provider_key: string;
  external_account_id: string | null;
  display_label: string;
  identifiers: Record<string, unknown>;
}

export async function getConnection(
  db: Db,
  connectionId: string,
): Promise<ConnectionRecord | null> {  const { data, error } = await db
    .from("provider_connections")
    .select(
      "id, workspace_id, provider_key, display_label, status, auth_mode, scopes, account_timezone, account_currency, api_access_level, quota_limit, quota_used, last_success_at, last_attempt_at, last_error_code, last_error_message",
    )
    .eq("id", connectionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read the connection: ${error.message}`);
  }
  return (data as ConnectionRecord | null) ?? null;
}

export async function getAccount(
  db: Db,
  accountId: string,
): Promise<AccountRecord | null> {
  const { data, error } = await db
    .from("external_accounts")
    .select(
      "id, workspace_id, connection_id, provider_key, external_account_id, display_label, identifiers",
    )
    .eq("id", accountId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read the account: ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id,
    workspace_id: data.workspace_id,
    connection_id: data.connection_id,
    provider_key: data.provider_key,
    external_account_id: data.external_account_id,
    display_label: data.display_label,
    identifiers: (data.identifiers ?? {}) as Record<string, unknown>,
  };
}

export type ConnectionStatus =
  | "connected"
  | "needs_setup"
  | "token_refresh_failed"
  | "permission_revoked"
  | "provider_outage"
  | "rate_limited"
  | "sync_stale";

/**
 * Record the outcome of a sync attempt.
 *
 * `last_attempt_at` always moves; `last_success_at` only moves on success.
 * A failure never clears the last good timestamp, so the UI can keep showing
 * the last known good data while marking it as stale.
 */
export async function updateConnectionStatus(
  db: Db,
  connectionId: string,
  outcome: {
    status: ConnectionStatus;
    errorCode?: string | null;
    errorMessage?: string | null;
    quotaUsed?: number;
  },
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await db
    .from("provider_connections")
    .update({
      status: outcome.status,
      last_attempt_at: now,
      ...(outcome.status === "connected"
        ? { last_success_at: now, last_error_code: null, last_error_message: null }
        : {
            last_error_code: outcome.errorCode ?? null,
            last_error_message: outcome.errorMessage ?? null,
          }),
      ...(outcome.quotaUsed !== undefined
        ? { quota_used: outcome.quotaUsed }
        : {}),
      updated_at: now,
    })
    .eq("id", connectionId);

  if (error) {
    console.error("could not update the connection status", error.message);
  }
}

/**
 * The provider key a connection belongs to, narrowed to the known set.
 */
export function providerKeyOf(connection: ConnectionRecord): ProviderKey {
  return connection.provider_key as ProviderKey;
}

/**
 * Every connection in a workspace.
 *
 * RLS restricts this to members with `integrations.read`. The service-role
 * client is never used here: the catalogue must reflect what *this* user is
 * allowed to see.
 */
export async function listConnections(
  db: Db,
  workspaceId: string,
): Promise<ConnectionRecord[]> {
  const { data, error } = await db
    .from("provider_connections")
    .select(
      "id, workspace_id, provider_key, display_label, status, auth_mode, scopes, account_timezone, account_currency, api_access_level, quota_limit, quota_used, last_success_at, last_attempt_at, last_error_code, last_error_message",
    )
    .eq("workspace_id", workspaceId)
    .order("provider_key", { ascending: true })
    .order("display_label", { ascending: true });

  if (error) throw new Error(`Could not list connections: ${error.message}`);
  return (data ?? []) as ConnectionRecord[];
}
