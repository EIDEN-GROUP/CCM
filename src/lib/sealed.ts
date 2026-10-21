import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * A sealed, single-purpose token.
 *
 * The payload is encrypted with AES-256-GCM under the application encryption
 * key, with the purpose string as additional authenticated data. That means
 * a token minted for one purpose cannot be replayed at another, and the
 * payload cannot be read or altered without the key.
 *
 * The token is **not** a capability on its own: every route that accepts one
 * also re-checks the session, the permission and the resource ownership. The
 * seal only stops the payload from being forged or edited.
 */

function key(): Buffer {
  const configured = serverEnv.appEncryptionKey();
  if (!configured) {
    throw new Error("APP_ENCRYPTION_KEY is not configured");
  }
  const material = Buffer.from(configured, "base64");
  if (material.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return material;
}

/** Seal a payload for a named purpose. */
export function seal<T extends Record<string, unknown>>(
  purpose: string,
  payload: T,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(purpose, "utf8"));

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext])
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Open a sealed payload.
 *
 * Returns null when the token is absent, malformed, tampered with, minted
 * for another purpose, or past its expiry.
 */
export function open<T extends Record<string, unknown>>(
  purpose: string,
  token: string | undefined | null,
  maxAgeSeconds: number,
): T | null {
  if (!token) return null;

  try {
    const raw = Buffer.from(
      token.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    );
    if (raw.length < 29) return null;

    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(purpose, "utf8"));
    decipher.setAuthTag(raw.subarray(12, 28));

    const payload = JSON.parse(
      Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString(
        "utf8",
      ),
    ) as T & { issuedAt?: number };

    if (
      typeof payload.issuedAt === "number" &&
      Date.now() / 1000 - payload.issuedAt > maxAgeSeconds
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
