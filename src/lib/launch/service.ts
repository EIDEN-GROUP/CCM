import { serverEnv } from "@/lib/env";
import {
  issueLaunchTicket,
  normalisePem,
  splitUrl,
  type LaunchTicketClaims,
} from "@/lib/launch/tickets";
import {
  assertAllowedLaunchUrl,
  buildLaunchTarget,
  InvalidLaunchTargetError,
  type LaunchMode,
} from "@/lib/launch/urls";
import {
  getProvider,
  type AccountIdentifiers,
  type ProviderKey,
} from "@/providers/registry";

/**
 * The account launcher service.
 *
 * Responsibilities, in order:
 *   1. Prove the caller may open the account (RLS + permission).
 *   2. Build the destination URL from *server-side* identifiers.
 *   3. Validate the URL against the provider host allowlist.
 *   4. Mint a short-lived, signed, single-use ticket.
 *   5. Record the attempt.
 *
 * The browser never supplies a URL. That single rule is what prevents CCM
 * from becoming an open redirect or a phishing launcher.
 */

export interface LaunchableAccount {
  id: string;
  workspaceId: string;
  providerKey: ProviderKey;
  providerName: string;
  displayLabel: string;
  externalAccountId: string | null;
  identifiers: AccountIdentifiers;
  /** Resolved launch URL, or null when an identifier is missing. */
  accountUrl: string | null;
  managementUrl: string | null;
  /** Which identifiers are still needed. */
  missing: string[];
  launchMode: "direct" | "extension" | "helper";
  browserProfileLabel: string | null;
  browserProfileDirectory: string | null;
  /** The browser bridge instance this account is mapped to. */
  extensionInstanceId: string | null;
  /** The local helper endpoint, when one is paired. */
  helperEndpoint: string | null;
  status: string;
  apiStatus: string;
  lastOpenedAt: string | null;
  lastLaunchResult: string | null;
}

export interface LaunchRequest {
  accountId: string;
  mode: LaunchMode;
  userId: string;
  workspaceId: string;
}

export type LaunchOutcome =
  | { ok: true; url: string; ticket: string; jti: string; expiresAt: string; host: string; path: string }
  | { ok: false; code: string; message: string };

/**
 * Build the launch target for an account and mint a ticket.
 */
export async function prepareLaunch(
  request: LaunchRequest,
  account: {
    id: string;
    workspaceId: string;
    providerKey: ProviderKey;
    identifiers: AccountIdentifiers;
    displayLabel: string;
  },
): Promise<LaunchOutcome> {
  const provider = getProvider(account.providerKey);

  const target = buildLaunchTarget(account.providerKey, account.identifiers, request.mode);
  if (!target.url) {
    return {
      ok: false,
      code: "missing_identifier",
      message:
        target.missing?.join(", ") ??
        `No ${request.mode} destination is available for ${provider.displayName}.`,
    };
  }

  let url: URL;
  try {
    url = assertAllowedLaunchUrl(account.providerKey, target.url);
  } catch (error) {
    if (error instanceof InvalidLaunchTargetError) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
      };
    }
    throw error;
  }

  const { host, path } = splitUrl(url.toString());

  const claims: LaunchTicketClaims = {
    sub: request.userId,
    acc: account.id,
    prv: account.providerKey,
    hst: host,
    pth: path,
    wsp: request.workspaceId,
  };

  try {
    const ticket = await issueLaunchTicket(claims);
    return {
      ok: true,
      url: url.toString(),
      ticket: ticket.token,
      jti: ticket.jti,
      expiresAt: ticket.expiresAt,
      host,
      path,
    };
  } catch (error) {
    return {
      ok: false,
      code: "signing_unavailable",
      message:
        error instanceof Error
          ? error.message
          : "The launch signing key is not available.",
    };
  }
}

/**
 * The public verification key, published for the browser bridge extension.
 *
 * A public key is not a secret. The extension uses it to verify that a ticket
 * really was issued by this CCM deployment, without ever holding the private
 * key.
 */
export async function getLaunchPublicJwk(): Promise<{
  kty: string;
  crv: string;
  x: string;
  y: string;
  kid: string;
} | null> {
  const pem = serverEnv.launchSigningPublicKey();
  if (!pem) return null;

  const { importSPKI } = await import("jose");
  const material = normalisePem(pem);
  const key = await importSPKI(material, "ES256");
  const jwk = await crypto.subtle.exportKey("jwk", key);

  return {
    kty: jwk.kty ?? "EC",
    crv: jwk.crv ?? "P-256",
    x: jwk.x ?? "",
    y: jwk.y ?? "",
    kid: serverEnv.launchSigningKeyId() ?? "ccm-launch-1",
  };
}

/**
 * The launch ticket lifetime in seconds. Deliberately short: a ticket is a
 * momentary permission to open one page, not a bearer session.
 */
export const LAUNCH_TICKET_TTL_SECONDS = 60;
