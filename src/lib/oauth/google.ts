import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { ConnectorError } from "@/providers/connector";

/**
 * Google OAuth 2.0.
 *
 * Implements the authorisation-code flow with PKCE, a CSRF-resistant `state`
 * parameter, and a server-side code exchange. The browser never sees a token.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** The scopes CCM requests, per product. Read-only first. */
export const GOOGLE_SCOPES = {
  ga4: [
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/analytics.readonly",
  ],
  gsc: ["https://www.googleapis.com/auth/webmasters.readonly"],
  gtm: ["https://www.googleapis.com/auth/tagmanager.readonly"],
  ads: ["https://www.googleapis.com/auth/adwords"],
  youtube: [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
  ],
  gmail: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
  ],
} as const;

export type GoogleProduct = keyof typeof GOOGLE_SCOPES;

export function googleScopesFor(products: GoogleProduct[]): string[] {
  const scopes = new Set<string>();
  for (const product of products) {
    for (const scope of GOOGLE_SCOPES[product]) scopes.add(scope);
  }
  return [...scopes];
}

/** The PKCE verifier/challenge pair for one authorisation attempt. */
export interface PkcePair {
  verifier: string;
  challenge: string;
  method: "S256";
}

export function createPkcePair(): PkcePair {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(
    createHash("sha256").update(verifier).digest(),
  );
  return { verifier, challenge, method: "S256" };
}

export function base64Url(buffer: Buffer | Uint8Array): string {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function randomState(): string {
  return base64Url(randomBytes(24));
}

/**
 * Constant-time comparison of two state values.
 *
 * The comparison is length-safe: a length mismatch returns false without
 * comparing, and equal-length values are compared in constant time.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

export interface AuthorizeUrlOptions {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
  /** "consent" forces the approval screen; "select_account" lets the user pick. */
  prompt?: "consent" | "select_account" | "none";
  /** Optional offline access so a refresh token is issued. */
  accessType?: "online" | "offline";
  loginHint?: string;
}

export function buildAuthorizeUrl(options: AuthorizeUrlOptions): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", options.scopes.join(" "));
  url.searchParams.set("state", options.state);
  url.searchParams.set("code_challenge", options.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", options.accessType ?? "offline");
  // Incremental consent: only ask for what is not already granted.
  url.searchParams.set("include_granted_scopes", "true");
  if (options.prompt) url.searchParams.set("prompt", options.prompt);
  if (options.loginHint) url.searchParams.set("login_hint", options.loginHint);
  return url.toString();
}

/**
 * Exchange an authorisation code for tokens.
 */
export async function exchangeCodeForTokens(
  options: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
    codeVerifier: string;
  },
): Promise<GoogleTokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: options.code,
      client_id: options.clientId,
      client_secret: options.clientSecret,
      redirect_uri: options.redirectUri,
      grant_type: "authorization_code",
      code_verifier: options.codeVerifier,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as
    | GoogleTokenResponse
    | { error?: string; error_description?: string };

  if (!response.ok || "error" in body) {
    const description =
      "error_description" in body
        ? body.error_description
        : `HTTP ${response.status}`;
    throw ConnectorError.auth(`Google rejected the token exchange: ${description}`);
  }

  return body as GoogleTokenResponse;
}

/**
 * Refresh an access token.
 *
 * Returns null when the provider says the refresh token is no longer valid,
 * which the caller must treat as "the owner has to re-authorise".
 */
export async function refreshAccessToken(
  options: { clientId: string; clientSecret: string; refreshToken: string },
): Promise<GoogleTokenResponse | null> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: options.clientId,
      client_secret: options.clientSecret,
      refresh_token: options.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (response.status === 400 || response.status === 401) {
    // The refresh token was revoked or expired. This is not retryable.
    return null;
  }

  const body = (await response.json().catch(() => ({}))) as
    | GoogleTokenResponse
    | { error?: string; error_description?: string };

  if (!response.ok || "error" in body) {
    throw ConnectorError.unavailable(
      `Google could not refresh the access token (HTTP ${response.status}).`,
    );
  }

  return body as GoogleTokenResponse;
}
