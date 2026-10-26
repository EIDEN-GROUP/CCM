import type { Db } from "@/lib/repositories/types";
import {
  getProvider,
  type AccountIdentifiers,
  type ProviderKey,
} from "@/providers/registry";
import { buildLaunchTarget } from "@/lib/launch/urls";
import type { LaunchableAccount } from "@/lib/launch/service";
import { CREDENTIAL_LOGIN_URLS } from "@/lib/launch/credential-hosts";
import { assertAllowedLaunchUrl } from "@/lib/launch/urls";

/**
 * Read the accounts a user may launch.
 *
 * The query runs through the request's RLS-scoped client, so a user who lacks
 * the `integrations.read` permission or an account grant simply does not see
 * the row. Nothing is filtered in application code.
 */
export async function listLaunchableAccounts(
  db: Db,
  workspaceId: string,
): Promise<LaunchableAccount[]> {
  const { data, error } = await db
    .from("external_accounts")
    .select(
      `
        id,
        workspace_id,
        connection_id,
        provider_key,
        external_account_id,
        display_label,
        identifiers,
        is_active,
        provider_connections!external_accounts_connection_id_fkey (
          id,
          status
        ),
        account_launch_profiles (
          launch_mode,
          status,
          browser_profile_label,
          browser_profile_directory,
          helper_endpoint,
          extension_instance_id,
          last_opened_at,
          last_launch_result
        )
      `,
    )
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("provider_key", { ascending: true })
    .order("display_label", { ascending: true });

  if (error) {
    throw new Error(`Could not list accounts: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as LauncherRow[];

  return rows.map((row) => {
    const providerKey = row.provider_key as ProviderKey;
    const provider = getProvider(providerKey);
    const identifiers = (row.identifiers ?? {}) as AccountIdentifiers;

    const accountTarget = buildLaunchTarget(
      providerKey,
      identifiers,
      "account",
    );
    const managementTarget = buildLaunchTarget(
      providerKey,
      identifiers,
      "management",
    );

    const profile = firstOf(row.account_launch_profiles);
    const connection = firstOf(row.provider_connections);
    const loginOnly = row.connection_id === null && row.external_account_id === null;
    const credentialLaunchUrl = loginOnly
      ? CREDENTIAL_LOGIN_URLS[providerKey] ?? null
      : null;
    const accountUrl =
      accountTarget.url ??
      (credentialLaunchUrl
        ? assertAllowedLaunchUrl(providerKey, credentialLaunchUrl).toString()
        : null);

    const missing = loginOnly
      ? []
      : [...(accountTarget.missing ?? []), ...(managementTarget.missing ?? [])];

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      providerKey,
      providerName: provider.displayName,
      displayLabel: row.display_label,
      externalAccountId: row.external_account_id,
      identifiers,
      accountUrl,
      managementUrl: managementTarget.url,
      missing,
      launchMode: profile?.launch_mode ?? "direct",
      browserProfileLabel: profile?.browser_profile_label ?? null,
      browserProfileDirectory: profile?.browser_profile_directory ?? null,
      extensionInstanceId: profile?.extension_instance_id ?? null,
      helperEndpoint: profile?.helper_endpoint ?? null,
      status: profile?.status ?? "profile_unmapped",
      apiStatus: loginOnly
        ? "browser_only"
        : connection?.status ?? (row.connection_id ? "not_visible" : "needs_setup"),
      loginOnly,
      lastOpenedAt: profile?.last_opened_at ?? null,
      lastLaunchResult: profile?.last_launch_result ?? null,
    };
  });
}

interface LauncherRow {
  id: string;
  workspace_id: string;
  connection_id: string | null;
  provider_key: string;
  external_account_id: string | null;
  display_label: string;
  identifiers: unknown;
  is_active: boolean;
  provider_connections?: LauncherConnection[] | LauncherConnection | null;
  account_launch_profiles?: LauncherProfile[] | LauncherProfile | null;
}

interface LauncherConnection {
  id: string;
  status: string;
}

interface LauncherProfile {
  launch_mode: "direct" | "extension" | "helper";
  status: string;
  browser_profile_label: string | null;
  browser_profile_directory: string | null;
  helper_endpoint: string | null;
  extension_instance_id: string | null;
  last_opened_at: string | null;
  last_launch_result: string | null;
}

/**
 * PostgREST returns a to-one relation as an object and a to-many relation as
 * an array. This normalises both shapes.
 */
function firstOf<T>(value: T[] | T | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Load a single account with its identifiers, for the launch flow.
 *
 * The read is RLS-scoped, so an account the user may not see simply is not
 * found — the launcher cannot be used to probe for account ids.
 */
export async function getLaunchableAccount(
  db: Db,
  accountId: string,
): Promise<{
  id: string;
  workspaceId: string;
  connectionId: string | null;
  externalAccountId: string | null;
  providerKey: ProviderKey;
  displayLabel: string;
  identifiers: AccountIdentifiers;
} | null> {
  const { data, error } = await db
    .from("external_accounts")
    .select(
      "id, workspace_id, connection_id, external_account_id, provider_key, display_label, identifiers, is_active",
    )
    .eq("id", accountId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load the account: ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id,
    workspaceId: data.workspace_id,
    connectionId: data.connection_id,
    externalAccountId: data.external_account_id,
    providerKey: data.provider_key as ProviderKey,
    displayLabel: data.display_label,
    identifiers: (data.identifiers ?? {}) as AccountIdentifiers,
  };
}

/**
 * Persist a launch attempt.
 *
 * The outcome vocabulary is deliberately explicit. `opened` means a tab was
 * opened; it never means the provider session was authenticated.
 */
export async function recordLaunchEvent(
  db: Db,
  event: {
    workspaceId: string;
    accountId: string | null;
    userId: string | null;
    ticketJti: string | null;
    mode: "direct" | "extension" | "helper";
    outcome: string;
    host: string | null;
    reason: string | null;
    viaExtension: boolean;
  },
): Promise<void> {
  const { error } = await db.from("launch_events").insert({
    workspace_id: event.workspaceId,
    account_id: event.accountId,
    user_id: event.userId,
    ticket_jti: event.ticketJti,
    mode: event.mode,
    outcome: event.outcome,
    host: event.host,
    reason: event.reason,
    via_extension: event.viaExtension,
  });
  if (error) {
    // A failed audit write must not block the launch itself, but it must be
    // visible in the server log rather than silently dropped.
    console.error("launch event audit failed", error.message);
  }
}

/**
 * Mark a launch ticket as consumed, returning false when it was already
 * consumed. This is the server-side replay guard: the extension has its own
 * local replay set, and the database has the durable one.
 */
export async function consumeLaunchTicket(
  db: Db,
  jti: string,
): Promise<boolean> {
  const { data, error } = await db
    .from("launch_tickets")
    .update({ consumed_at: new Date().toISOString() })
    .eq("jti", jti)
    .is("consumed_at", null)
    .select("jti")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not consume the launch ticket: ${error.message}`);
  }
  return Boolean(data);
}
