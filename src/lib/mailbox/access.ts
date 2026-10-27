import type { Db } from "@/lib/repositories/types";
import { GmailConnector } from "@/providers/google/gmail";
import { readCredential } from "@/lib/providers/credentials";
import { refreshAccessToken } from "@/lib/oauth/google";
import { serverEnv } from "@/lib/env";
import { ConnectorError } from "@/providers/connector";
import type { CustomMailSettings } from "@/lib/mailbox/custom-mail";

/**
 * Resolving access to a mailbox.
 *
 * The authorisation rule lives in the database, not here: the request-scoped
 * Supabase client applies Row Level Security, so a `mailbox_user` who has not
 * been granted a mailbox simply does not receive the row. This module never
 * widens that — it reads through the user's own client and fails closed.
 *
 * The credential is the one exception: it is read with the service-role
 * client, because the table deliberately denies every authenticated role.
 * Only the sync worker and this module ever hold a decrypted token.
 */

export interface MailboxRecord {
  id: string;
  workspace_id: string;
  account_id: string;
  provider_key: string;
  mailbox_email: string;
  display_label: string;
  auth_method: string;
  status: string;
  scopes: string[];
  ai_processing_enabled: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  host?: string | null;
  port?: number | null;
  username?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
}

export interface GmailMailboxAccess {
  kind: "gmail";
  mailbox: MailboxRecord;
  connector: GmailConnector;
  accessToken: string;
}

export interface CustomMailboxAccess {
  kind: "imap";
  mailbox: MailboxRecord;
  settings: CustomMailSettings;
}

export type MailboxAccess = GmailMailboxAccess | CustomMailboxAccess;

export type MailboxResolution =
  | { ok: true; access: MailboxAccess }
  | { ok: false; status: number; error: string };

/**
 * Resolve a mailbox the user is allowed to read, and a usable token.
 *
 * The token is refreshed when it is close to expiry. When the provider
 * refuses the refresh token, the mailbox is marked `permission_revoked` and
 * the caller is told to re-authorise — it is never retried.
 */
export async function resolveMailbox(
  userDb: Db,
  adminDb: Db,
  mailboxId: string,
  workspaceId: string,
): Promise<MailboxResolution> {
  const { data, error } = await userDb
    .from("mailbox_connections")
    .select(
      "id, workspace_id, account_id, provider_key, mailbox_email, display_label, auth_method, status, scopes, ai_processing_enabled, last_sync_at, last_error, host, port, username, smtp_host, smtp_port",
    )
    .eq("id", mailboxId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 400,
      error: `The mailbox could not be read: ${error.message}`,
    };
  }

  if (!data) {
    // The same answer as "not permitted", so the endpoint cannot be used to
    // discover which mailbox ids exist.
    return {
      ok: false,
      status: 404,
      error: "That mailbox is not available to you.",
    };
  }

  const mailbox = data as MailboxRecord;

  if (mailbox.provider_key !== "gmail") {
    return {
      ok: false,
      status: 400,
      error: `The ${mailbox.provider_key} mailbox provider is not implemented yet.`,
    };
  }

  // The connection that holds the credential.
  const { data: account, error: accountError } = await adminDb
    .from("external_accounts")
    .select("id, connection_id")
    .eq("id", mailbox.account_id)
    .maybeSingle();

  if (accountError || !account?.connection_id) {
    return {
      ok: false,
      status: 409,
      error: "This mailbox is not connected to a provider account.",
    };
  }

  const credential = await readCredential(adminDb, account.connection_id);
  if (!credential) {
    await adminDb
      .from("mailbox_connections")
      .update({
        status: "needs_setup",
        last_error: "The mailbox has no stored credential.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", mailbox.id);

    return {
      ok: false,
      status: 409,
      error:
        "This mailbox has no stored credential. Re-authorise the Google account in Integrations.",
    };
  }

  if (mailbox.auth_method === "imap") {
    const secrets = credential.secrets;
    const imapPassword = typeof secrets.imapPassword === "string" ? secrets.imapPassword : "";
    const smtpPassword = typeof secrets.smtpPassword === "string" ? secrets.smtpPassword : "";
    if (!mailbox.host || !mailbox.port || !mailbox.username || !mailbox.smtp_host || !mailbox.smtp_port || !imapPassword || !smtpPassword) {
      return { ok: false, status: 409, error: "Custom mail setup is incomplete. Update the IMAP and SMTP settings." };
    }
    return {
      ok: true,
      access: {
        kind: "imap",
        mailbox,
        settings: {
          email: mailbox.mailbox_email,
          imapHost: mailbox.host,
          imapPort: mailbox.port,
          imapUsername: mailbox.username,
          imapPassword,
          smtpHost: mailbox.smtp_host,
          smtpPort: mailbox.smtp_port,
          smtpUsername: typeof secrets.smtpUsername === "string" ? secrets.smtpUsername : mailbox.username,
          smtpPassword,
        },
      },
    };
  }

  let accessToken = credential.secrets.accessToken ?? "";
  const expiresAt = credential.secrets.expiresAt;

  if (
    accessToken &&
    typeof expiresAt === "number" &&
    expiresAt - 120 <= Math.floor(Date.now() / 1000)
  ) {
    const clientId = serverEnv.googleOAuthClientId();
    const clientSecret = serverEnv.googleOAuthClientSecret();
    const refreshToken =
      typeof credential.secrets.refreshToken === "string"
        ? credential.secrets.refreshToken
        : null;

    if (!clientId || !clientSecret || !refreshToken) {
      return {
        ok: false,
        status: 409,
        error:
          "The access token has expired and there is no refresh token. Re-authorise the Google account in Integrations.",
      };
    }

    const refreshed = await refreshAccessToken({
      clientId,
      clientSecret,
      refreshToken,
    });

    if (!refreshed) {
      await adminDb
        .from("mailbox_connections")
        .update({
          status: "permission_revoked",
          last_error:
            "The provider rejected the refresh token. Re-authorise the account.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", mailbox.id);

      return {
        ok: false,
        status: 409,
        error:
          "The provider rejected the refresh token. Re-authorise the Google account in Integrations.",
      };
    }

    accessToken = refreshed.access_token;

    const { writeCredential } = await import("@/lib/providers/credentials");
    await writeCredential(adminDb, account.connection_id, {
      ...credential.secrets,
      accessToken: refreshed.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in,
      refreshToken: refreshed.refresh_token ?? refreshToken,
    });
  }

  if (!accessToken) {
    return {
      ok: false,
      status: 409,
      error: "This mailbox has no access token.",
    };
  }

  return {
    ok: true,
    access: {
      kind: "gmail",
      mailbox,
      connector: new GmailConnector({ userId: mailbox.mailbox_email }),
      accessToken,
    },
  };
}

/**
 * A provider error, turned into a message the interface can show.
 *
 * The provider's own body is not passed through — it can echo the request.
 */
export function mailboxErrorMessage(error: unknown): string {
  if (error instanceof ConnectorError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "The mailbox request failed.";
}
