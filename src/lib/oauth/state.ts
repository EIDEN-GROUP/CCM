import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Sealed OAuth state.
 *
 * The authorisation request needs to carry a few values across the redirect
 * to Google and back — the `state` nonce, the PKCE verifier, and which
 * products the owner asked to connect. They are stored in an encrypted,
 * short-lived, httpOnly cookie rather than in the query string, so the PKCE
 * verifier never appears in a browser history or a referrer header.
 *
 * AES-256-GCM with the application's encryption key, and the context bound to
 * the cookie's purpose so a value cannot be replayed elsewhere.
 */

const CONTEXT = "ccm:oauth-state";

export interface OAuthStatePayload {
  /** The CSRF nonce echoed back by Google. */
  state: string;
  /** The PKCE code verifier. */
  codeVerifier: string;
  /** The products the owner asked to connect. */
  products: string[];
  /** The workspace the connection belongs to. */
  workspaceId: string;
  /** When the attempt started, in epoch seconds. */
  startedAt: number;
}

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

/** Seal a payload into a compact, tamper-proof string. */
export function sealState(payload: OAuthStatePayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(CONTEXT, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext])
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Open a sealed payload. Returns null when it cannot be trusted. */
export function openState(value: string | undefined): OAuthStatePayload | null {
  if (!value) return null;

  try {
    const raw = Buffer.from(
      value.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    );
    if (raw.length < 29) return null;

    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);

    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAAD(Buffer.from(CONTEXT, "utf8"));
    decipher.setAuthTag(tag);

    const payload = JSON.parse(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
        "utf8",
      ),
    ) as OAuthStatePayload;

    // An attempt older than ten minutes is refused.
    if (Date.now() / 1000 - payload.startedAt > 600) return null;

    return payload;
  } catch {
    return null;
  }
}

/** The name of the cookie that carries the sealed state. */
export const OAUTH_STATE_COOKIE = "ccm_oauth_state";

/** How long the state cookie lives. */
export const OAUTH_STATE_MAX_AGE_SECONDS = 600;
