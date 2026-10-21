/**
 * Short-lived, signed launch tickets.
 *
 * A launch ticket proves "CCM authorised this user to open this account in
 * this provider's site". It is a compact JWS so that the browser bridge
 * extension can verify it **without holding any secret** — the extension only
 * ever receives the public key.
 *
 * The algorithm is ES256 (ECDSA P-256 / SHA-256) rather than EdDSA: WebCrypto
 * support for Ed25519 is still uneven across Chromium builds, while P-256
 * works everywhere the extension might run. The extension therefore verifies
 * tickets with the platform crypto API and no third-party library at all.
 *
 * Claims:
 *   iss  "ccm"                        issuer
 *   aud  "ccm-launcher"               audience
 *   sub  user id                      the authenticated CCM user
 *   acc  external account id          the account being opened
 *   prv  provider key                 provider
 *   hst  destination hostname         must be in the provider host allowlist
 *   pth  destination path              relative path only
 *   jti  unique id                    one-time use identifier
 *   iat/exp                           issued-at / expiry (seconds)
 *
 * Lifetime is deliberately short (default 60 seconds). A ticket is a
 * momentary permission, not a bearer session.
 */

import { SignJWT, jwtVerify, importPKCS8, importSPKI } from "jose";
import { z } from "zod";

export const LAUNCH_TICKET_ISSUER = "ccm";
export const LAUNCH_TICKET_AUDIENCE = "ccm-launcher";
export const DEFAULT_TICKET_TTL_SECONDS = 60;

export interface LaunchTicketClaims {
  /** CCM user id. */
  sub: string;
  /** External account id being opened. */
  acc: string;
  /** Provider key. */
  prv: string;
  /** Destination hostname. */
  hst: string;
  /** Destination path (always starts with "/"). */
  pth: string;
  /** Workspace id. */
  wsp: string;
}

const claimsSchema = z.object({
  iss: z.literal(LAUNCH_TICKET_ISSUER),
  aud: z.literal(LAUNCH_TICKET_AUDIENCE),
  sub: z.string().min(1),
  acc: z.string().min(1),
  prv: z.string().min(1),
  hst: z.string().min(1),
  pth: z.string().startsWith("/"),
  wsp: z.string().min(1),
  jti: z.string().min(1),
  iat: z.number(),
  exp: z.number(),
});

export type VerifiedLaunchTicket = z.infer<typeof claimsSchema>;

export class LaunchTicketError extends Error {
  constructor(
    message: string,
    readonly code:
      | "signing_key_missing"
      | "verification_failed"
      | "invalid_claims"
      | "expired"
      | "wrong_audience"
      | "wrong_issuer",
  ) {
    super(message);
    this.name = "LaunchTicketError";
  }
}

function getEnv(name: string): string | undefined {
  // Server-only module. Never imported into a client component.
  return process.env[name];
}

let cachedPrivateKey: Promise<CryptoKey> | null = null;
let cachedPublicKey: Promise<CryptoKey> | null = null;

/**
 * Normalise a PEM value that came from an environment variable.
 *
 * A PEM pasted into a `.env` file is often mangled: it may be wrapped in
 * quotes, its newlines may be escaped as the literal two characters `\n`,
 * a stray backslash may sit where a newline should be, and the base64 body
 * may arrive with the wrong line lengths.
 *
 * Rather than trying to repair the whitespace, the value is **rebuilt from
 * its structural markers** — the BEGIN/END labels and the base64 body
 * between them. That makes the loader tolerant of every one of those
 * manglings, which matters because a launch key that fails to import is a
 * broken account launcher.
 */
export function normalisePem(raw: string): string {
  let value = raw.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  // Undo escaped newlines, then drop any backslash that remains. A
  // backslash can never legitimately appear inside a PEM body.
  if (value.includes("\\n")) {
    value = value.replace(/\\n/g, "\n");
  }
  value = value.replace(/\\/g, "");

  const pattern = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END ([A-Z0-9 ]+)-----/;
  const match = value.match(pattern);
  if (!match) {
    // Not a PEM — it may be a bare base64 DER key, which the importer
    // handles separately.
    return value;
  }

  const label = match[1]!.trim();
  const body = match[2]!.replace(/[^A-Za-z0-9+/=]/g, "");
  if (body.length === 0) return value;

  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

/**
 * Turn an environment value into PEM text.
 *
 * Accepts a raw PEM, a base64-encoded PEM, or a base64-encoded DER key.
 */
function toPem(raw: string): string {
  const value = normalisePem(raw);
  if (value.includes("BEGIN")) return value;

  const decoded = Buffer.from(value, "base64").toString("utf8");
  return decoded.includes("BEGIN") ? decoded : value;
}

async function importPrivateKey(): Promise<CryptoKey> {
  const pem = getEnv("LAUNCH_SIGNING_PRIVATE_KEY");
  if (!pem) {
    throw new LaunchTicketError(
      "LAUNCH_SIGNING_PRIVATE_KEY is not configured",
      "signing_key_missing",
    );
  }
  return importPKCS8(toPem(pem), "ES256");
}

async function importPublicKey(): Promise<CryptoKey> {
  const pem = getEnv("LAUNCH_SIGNING_PUBLIC_KEY");
  if (!pem) {
    throw new LaunchTicketError(
      "LAUNCH_SIGNING_PUBLIC_KEY is not configured",
      "signing_key_missing",
    );
  }
  return importSPKI(toPem(pem), "ES256");
}

async function privateKey(): Promise<CryptoKey> {
  cachedPrivateKey ??= importPrivateKey();
  return cachedPrivateKey;
}

async function publicKey(): Promise<CryptoKey> {
  cachedPublicKey ??= importPublicKey();
  return cachedPublicKey;
}

/** Test hook: drop the memoised keys (e.g. after a key rotation in-process). */
export function resetLaunchKeyCache(): void {
  cachedPrivateKey = null;
  cachedPublicKey = null;
}

/**
 * Sign a launch ticket.
 */
export async function issueLaunchTicket(
  claims: LaunchTicketClaims,
  options: { ttlSeconds?: number; keyId?: string } = {},
): Promise<{ token: string; jti: string; expiresAt: string }> {
  const ttl = options.ttlSeconds ?? DEFAULT_TICKET_TTL_SECONDS;
  const keyId = options.keyId ?? getEnv("LAUNCH_SIGNING_KEY_ID") ?? "ccm-launch-1";
  const key = await privateKey();
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    acc: claims.acc,
    prv: claims.prv,
    hst: claims.hst,
    pth: claims.pth,
    wsp: claims.wsp,
  })
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .setIssuer(LAUNCH_TICKET_ISSUER)
    .setAudience(LAUNCH_TICKET_AUDIENCE)
    .setSubject(claims.sub)
    .setJti(jti)
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(key);

  return {
    token,
    jti,
    expiresAt: new Date((now + ttl) * 1000).toISOString(),
  };
}

/**
 * Verify a launch ticket.
 *
 * Used by the server when re-checking a ticket, and mirrored by the browser
 * bridge extension using the public key.
 */
export async function verifyLaunchTicket(
  token: string,
  options: { now?: Date; toleranceSeconds?: number } = {},
): Promise<VerifiedLaunchTicket> {
  const key = await publicKey();
  let payload: unknown;
  try {
    const result = await jwtVerify(token, key, {
      issuer: LAUNCH_TICKET_ISSUER,
      audience: LAUNCH_TICKET_AUDIENCE,
      algorithms: ["ES256"],
      currentDate: options.now ?? new Date(),
      clockTolerance: options.toleranceSeconds ?? 0,
    });
    payload = result.payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("exp")) {
      throw new LaunchTicketError("Launch ticket has expired", "expired");
    }
    if (message.includes("aud")) {
      throw new LaunchTicketError("Launch ticket has the wrong audience", "wrong_audience");
    }
    if (message.includes("iss")) {
      throw new LaunchTicketError("Launch ticket has the wrong issuer", "wrong_issuer");
    }
    throw new LaunchTicketError(
      "Launch ticket failed verification",
      "verification_failed",
    );
  }

  const parsed = claimsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new LaunchTicketError(
      `Launch ticket claims are invalid: ${parsed.error.issues
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`,
      "invalid_claims",
    );
  }
  return parsed.data;
}

/**
 * Rebuild the destination URL from verified ticket claims.
 *
 * The URL is reconstructed from `hst` + `pth` rather than trusted from the
 * ticket body, and the host is checked against the provider allowlist again
 * on the consuming side.
 */
export function urlFromTicket(
  ticket: Pick<VerifiedLaunchTicket, "hst" | "pth">,
): string {
  const url = new URL(`https://${ticket.hst}${ticket.pth}`);
  if (url.protocol !== "https:") {
    throw new LaunchTicketError("Ticket produced a non-https URL", "invalid_claims");
  }
  return url.toString();
}

/**
 * Split an https URL into the host + path pair stored in a ticket.
 */
export function splitUrl(url: string): { host: string; path: string } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    path: `${parsed.pathname}${parsed.search}${parsed.hash}`,
  };
}
