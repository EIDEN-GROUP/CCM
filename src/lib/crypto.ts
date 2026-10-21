/**
 * Application-level encryption for provider credentials.
 *
 * Provider refresh tokens are encrypted with AES-256-GCM before they reach
 * Postgres. The key lives in a managed secret (or a key file mounted on the
 * VPS), never in the database and never in git.
 *
 * Envelope format (base64 of the whole envelope):
 *   version (1 byte) | iv (12 bytes) | auth tag (16 bytes) | ciphertext
 *
 * The additional authenticated data binds the ciphertext to a context string
 * (e.g. "provider_connection:<uuid>"), so a token cannot be moved from one
 * row to another by an attacker with write access to the table.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env";

const VERSION = 0x01;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class CryptoConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoConfigurationError";
  }
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecryptionError";
  }
}

function encryptionKey(): Buffer {
  const configured = serverEnv.appEncryptionKey();
  if (!configured) {
    throw new CryptoConfigurationError(
      "APP_ENCRYPTION_KEY is not configured. Provider tokens cannot be stored.",
    );
  }
  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) {
    throw new CryptoConfigurationError(
      `APP_ENCRYPTION_KEY must decode to 32 bytes, got ${key.length}`,
    );
  }
  return key;
}

/**
 * Encrypt a secret string for storage.
 *
 * @param context additional authenticated data binding the value to a record.
 */
export function encryptSecret(plaintext: string, context: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([
    Buffer.from([VERSION]),
    iv,
    tag,
    ciphertext,
  ]).toString("base64");
}

/**
 * Decrypt a stored secret.
 *
 * Throws `DecryptionError` when the value was tampered with, was encrypted
 * under a different key, or does not belong to `context`.
 */
export function decryptSecret(envelope: string, context: string): string {
  const raw = Buffer.from(envelope, "base64");
  if (raw.length < 1 + IV_BYTES + TAG_BYTES) {
    throw new DecryptionError("Stored credential envelope is truncated");
  }
  const version = raw[0];
  if (version !== VERSION) {
    throw new DecryptionError(`Unsupported credential envelope version: ${version}`);
  }
  const iv = raw.subarray(1, 1 + IV_BYTES);
  const tag = raw.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(1 + IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    throw new DecryptionError(
      "Stored credential could not be decrypted (wrong key, wrong record, or tampering)",
    );
  }
}

/**
 * A non-reversible fingerprint of a secret, safe to store and display.
 * Used to detect "the credential changed" without exposing the value.
 */
export function fingerprintSecret(plaintext: string): string {
  return createHash("sha256")
    .update(plaintext)
    .digest("hex")
    .slice(0, 16);
}
