import type { Db } from "@/lib/repositories/types";
import {
  decryptSecret,
  encryptSecret,
  fingerprintSecret,
} from "@/lib/crypto";

/**
 * Provider application credentials.
 *
 * These are the client id and the client secret of a provider's app. They
 * are deployment configuration, and until now they could only be set by
 * editing `.env` and redeploying. Storing them in the database lets the
 * owner connect a provider from the Integrations screen.
 *
 * The secret is encrypted with AES-256-GCM under the application encryption
 * key, with the row's id as additional authenticated data, so a secret
 * cannot be moved from one provider to another.
 *
 * The table is read with the service-role client, because the OAuth routes
 * need the secret and the people who may *manage* a connection are not
 * necessarily the people who may *manage settings*.
 */

/** A stored credential, decrypted. */
export interface AppCredential {
  providerKey: string;
  clientId: string;
  /** The decrypted secret, or null for a key-only provider. */
  secret: string | null;
  redirectUri: string | null;
  scopes: string[];
  notes: string | null;
  /** Whether the stored secret is still the one that was entered. */
  fingerprint: string | null;
}

/** A stored credential, without the secret. Safe to return to the interface. */
export interface AppCredentialSummary {
  providerKey: string;
  clientId: string;
  /** Whether a secret is stored. Never the secret itself. */
  hasSecret: boolean;
  redirectUri: string | null;
  scopes: string[];
  notes: string | null;
  updatedAt: string;
}

/** The additional authenticated data for a credential row. */
function contextFor(id: string): string {
  return `provider_app_credentials:${id}`;
}

interface CredentialRow {
  id: string;
  provider_key: string;
  client_id: string;
  encrypted_secret: string | null;
  key_fingerprint: string | null;
  redirect_uri: string | null;
  scopes: string[] | null;
  notes: string | null;
  updated_at: string;
}

/**
 * Read one provider's app credential.
 *
 * The environment is the fallback: a deployment that sets the variable in
 * `.env` keeps working, and the in-site value wins when both are present.
 */
export async function readAppCredential(
  db: Db,
  workspaceId: string,
  providerKey: string,
): Promise<AppCredential | null> {
  const { data, error } = await db
    .from("provider_app_credentials")
    .select(
      "id, provider_key, client_id, encrypted_secret, key_fingerprint, redirect_uri, scopes, notes, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("provider_key", providerKey)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not read the ${providerKey} app credential: ${error.message}`,
    );
  }

  if (!data) return null;

  const row = data as CredentialRow;

  let secret: string | null = null;
  if (row.encrypted_secret) {
    try {
      secret = decryptSecret(
        row.encrypted_secret,
        contextFor(row.id),
      );
    } catch (error) {
      // A secret that cannot be decrypted is a configuration problem, and
      // it is reported rather than silently treated as absent.
      throw new Error(
        `The ${providerKey} app secret could not be decrypted. Re-enter it in Settings — Integrations. (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
    }
  }

  return {
    providerKey: row.provider_key,
    clientId: row.client_id,
    secret,
    redirectUri: row.redirect_uri,
    scopes: row.scopes ?? [],
    notes: row.notes,
    fingerprint: row.key_fingerprint,
  };
}

/**
 * Store a provider's app credential.
 *
 * The secret is replaced only when a new one is given, so a provider that
 * needs no secret can be configured with just a key.
 */
export async function writeAppCredential(
  db: Db,
  options: {
    workspaceId: string;
    providerKey: string;
    clientId: string;
    secret?: string | null;
    redirectUri?: string | null;
    scopes?: string[];
    notes?: string | null;
    actorUserId?: string | null;
  },
): Promise<void> {
  const existing = await db
    .from("provider_app_credentials")
    .select("id")
    .eq("workspace_id", options.workspaceId)
    .eq("provider_key", options.providerKey)
    .maybeSingle();

  const rowId = (existing?.data as { id: string } | undefined)?.id;

  // The additional authenticated data binds the ciphertext to the row, so
  // the row has to exist before it is encrypted. An insert and an update
  // therefore need different handling.
  if (!rowId) {
    const { data, error } = await db
      .from("provider_app_credentials")
      .insert({
        workspace_id: options.workspaceId,
        provider_key: options.providerKey,
        client_id: options.clientId,
        encrypted_secret: null,
        key_fingerprint: null,
        redirect_uri: options.redirectUri ?? null,
        scopes: options.scopes ?? [],
        notes: options.notes ?? null,
        created_by: options.actorUserId ?? null,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(
        `Could not create the ${options.providerKey} app credential: ${error?.message ?? "unknown"}`,
      );
    }

    const id = (data as { id: string }).id;
    await applySecret(db, id, options.secret);
    return;
  }
  const { error } = await db
    .from("provider_app_credentials")
    .update({
      client_id: options.clientId,
      redirect_uri: options.redirectUri ?? null,
      scopes: options.scopes ?? [],
      notes: options.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rowId);

  if (error) {
    throw new Error(
      `Could not update the ${options.providerKey} app credential: ${error.message}`,
    );
  }

  await applySecret(db, rowId, options.secret);
}

/**
 * Replace the stored secret, clear it, or leave it alone.
 *
 * The three cases are distinct: `undefined` means "the owner did not type
 * one, keep what is stored", `null` means "remove it", and a string means
 * "replace it with this".
 */
async function applySecret(
  db: Db,
  rowId: string,
  secret: string | null | undefined,
): Promise<void> {
  if (secret === undefined) return;

  const { error } = await db
    .from("provider_app_credentials")
    .update({
      encrypted_secret: secret
        ? encryptSecret(secret, contextFor(rowId))
        : null,
      key_fingerprint: secret ? fingerprintSecret(secret) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rowId);

  if (error) {
    throw new Error(`Could not store the app secret: ${error.message}`);
  }
}

/** Remove a provider's app credential. */
export async function deleteAppCredential(
  db: Db,
  workspaceId: string,
  providerKey: string,
): Promise<void> {
  const { error } = await db
    .from("provider_app_credentials")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("provider_key", providerKey);

  if (error) {
    throw new Error(`Could not remove the app credential: ${error.message}`);
  }
}

/**
 * Every configured credential, without the secrets.
 */
export async function listAppCredentials(
  db: Db,
  workspaceId: string,
): Promise<AppCredentialSummary[]> {
  const { data, error } = await db
    .from("provider_app_credentials")
    .select(
      "id, provider_key, client_id, encrypted_secret, redirect_uri, scopes, notes, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .order("provider_key", { ascending: true });

  if (error) {
    throw new Error(`Could not list the app credentials: ${error.message}`);
  }

  return ((data ?? []) as CredentialRow[]).map((row) => ({
    providerKey: row.provider_key,
    clientId: row.client_id,
    hasSecret: Boolean(row.encrypted_secret),
    redirectUri: row.redirect_uri,
    scopes: row.scopes ?? [],
    notes: row.notes,
    updatedAt: row.updated_at,
  }));
}
