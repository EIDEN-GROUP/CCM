import type { Db } from "@/lib/repositories/types";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

/**
 * Provider credential storage.
 *
 * Refresh tokens are encrypted with AES-256-GCM before they touch Postgres,
 * and the additional authenticated data binds the ciphertext to the
 * connection id — a token cannot be moved between rows by anyone with write
 * access to the table.
 *
 * The `provider_connection_credentials` table has Row Level Security enabled
 * with **no** policy for the `authenticated` role, so this must be called
 * with the service-role client. That is correct: the sync worker is the only
 * component that should ever hold a decrypted token.
 */

/** The additional authenticated data for a connection's credentials. */
export function credentialContext(connectionId: string): string {
  return `provider_connection_credentials:${connectionId}`;
}

export interface StoredCredential {
  /** The decrypted JSON payload. */
  secrets: {
    accessToken?: string;
    refreshToken?: string;
    /** Unix seconds. */
    expiresAt?: number;
    /** Provider-specific extras (account ids, scopes). */
    [key: string]: unknown;
  };
  /** A non-reversible fingerprint, so a rotated credential is detectable. */
  fingerprint: string | null;
}

export async function readCredential(
  db: Db,
  connectionId: string,
): Promise<StoredCredential | null> {
  const { data, error } = await db
    .from("provider_connection_credentials")
    .select("encrypted_secrets, key_fingerprint")
    .eq("connection_id", connectionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read the provider credential: ${error.message}`);
  }
  if (!data) return null;

  const envelope = (data as { encrypted_secrets: string }).encrypted_secrets;
  const secrets = JSON.parse(
    decryptSecret(envelope, credentialContext(connectionId)),
  ) as StoredCredential["secrets"];

  return {
    secrets,
    fingerprint: (data as { key_fingerprint: string | null }).key_fingerprint,
  };
}

export async function writeCredential(
  db: Db,
  connectionId: string,
  secrets: StoredCredential["secrets"],
): Promise<void> {
  const envelope = encryptSecret(
    JSON.stringify(secrets),
    credentialContext(connectionId),
  );

  const { error } = await db.from("provider_connection_credentials").upsert(
    {
      connection_id: connectionId,
      encrypted_secrets: envelope,
      key_fingerprint: fingerprintOf(secrets),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "connection_id" },
  );

  if (error) {
    throw new Error(`Could not store the provider credential: ${error.message}`);
  }
}

/** Delete the credential when a connection is disconnected. */
export async function deleteCredential(
  db: Db,
  connectionId: string,
): Promise<void> {
  const { error } = await db
    .from("provider_connection_credentials")
    .delete()
    .eq("connection_id", connectionId);
  if (error) {
    console.error("could not delete the provider credential", error.message);
  }
}

/**
 * A stable, non-reversible fingerprint of a credential.
 *
 * It is not a secret and not a hash of the whole envelope — it exists so
 * CCM can tell "the same token is still installed" from "the owner
 * re-authorised the account", without ever decrypting to compare.
 */
function fingerprintOf(secrets: StoredCredential["secrets"]): string {
  const material = [
    secrets.refreshToken ?? "",
    secrets.accessToken ?? "",
    String(secrets.expiresAt ?? ""),
  ].join("|");

  // A short, non-cryptographic digest is enough: the value is only ever
  // compared with itself.
  let hash = 2166136261;
  for (let i = 0; i < material.length; i += 1) {
    hash ^= material.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Whether an access token is still fresh.
 *
 * A short margin means a token is refreshed before it actually expires,
 * rather than failing a request and retrying.
 */
export function isTokenFresh(
  secrets: StoredCredential["secrets"],
  marginSeconds = 120,
): boolean {
  if (!secrets.accessToken) return false;
  if (!secrets.expiresAt) return true;
  return secrets.expiresAt - marginSeconds > Math.floor(Date.now() / 1000);
}
