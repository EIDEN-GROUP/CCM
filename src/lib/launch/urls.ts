/**
 * Launch URL construction and validation.
 *
 * This module is the security boundary of the account launcher. It guarantees:
 *
 *  - The URL is always derived from *server-side* account identifiers via the
 *    provider registry. The browser cannot supply a URL, so it cannot cause
 *    CCM to open an attacker-chosen destination.
 *  - Only `https:` is allowed. No `http:`, `javascript:`, `data:` or
 *    `file:` schemes.
 *  - The hostname must be an exact member of the provider's host allowlist.
 *    Substring or suffix matching is deliberately not used — `evil-ads.google.com`
 *    must not pass because it ends with `ads.google.com`.
 *  - When a provider needs an identifier that CCM does not have, the builder
 *    returns `null` and the launcher says "not enough information" instead of
 *    falling back to the provider homepage.
 */

import {
  getProvider,
  type AccountIdentifiers,
  type ProviderKey,
} from "@/providers/registry";

export type LaunchMode = "account" | "management";

export interface LaunchTargetResult {
  url: string | null;
  /** Why the URL could not be produced, when it could not. */
  missing?: string[];
}

export class InvalidLaunchTargetError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_https"
      | "host_not_allowed"
      | "invalid_url"
      | "unknown_provider",
  ) {
    super(message);
    this.name = "InvalidLaunchTargetError";
  }
}

/**
 * Validate a URL against a provider's allowlist.
 *
 * Throws `InvalidLaunchTargetError` rather than returning a boolean so a
 * rejection can be logged with a precise reason.
 */
export function assertAllowedLaunchUrl(
  providerKey: ProviderKey,
  rawUrl: string,
): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new InvalidLaunchTargetError(
      `Launch target for ${providerKey} is not a valid URL`,
      "invalid_url",
    );
  }

  if (url.protocol !== "https:") {
    throw new InvalidLaunchTargetError(
      `Launch target for ${providerKey} must use https, got ${url.protocol}`,
      "not_https",
    );
  }

  const provider = getProvider(providerKey);
  // Exact host match only. A trailing dot ("ads.google.com.") is normalised
  // by the URL parser to "ads.google.com", which is still an exact match.
  if (!provider.hosts.includes(url.hostname)) {
    throw new InvalidLaunchTargetError(
      `Host "${url.hostname}" is not in the allowlist for ${providerKey}`,
      "host_not_allowed",
    );
  }

  return url;
}

/**
 * Build the launch URL for an account.
 *
 * Returns `{ url: null }` when the provider needs identifiers CCM has not
 * stored. Callers render "identifier missing" — never the homepage.
 */
export function buildLaunchTarget(
  providerKey: ProviderKey,
  identifiers: AccountIdentifiers,
  mode: LaunchMode = "account",
): LaunchTargetResult {
  const provider = getProvider(providerKey);
  const builder = mode === "account" ? provider.launch.account : provider.launch.management;
  if (!builder) {
    return { url: null, missing: [`${provider.displayName} has no ${mode} destination`] };
  }

  const raw = builder(identifiers);
  if (!raw) {
    return {
      url: null,
      missing: [`No stored identifier for the ${provider.displayName} ${mode} destination`],
    };
  }

  const url = assertAllowedLaunchUrl(providerKey, raw);
  return { url: url.toString() };
}

/**
 * Which identifiers a provider still needs for each launch mode.
 * Used by the setup wizard to tell the owner exactly what to paste in.
 */
export function requiredIdentifiers(
  providerKey: ProviderKey,
): { account: string[]; management: string[] } {
  const provider = getProvider(providerKey);
  const needs = (mode: LaunchMode): string[] => {
    const builder = mode === "account" ? provider.launch.account : provider.launch.management;
    if (!builder) return [];
    return builder({}) === null ? [mode === "account" ? "account id" : "management id"] : [];
  };
  return { account: needs("account"), management: needs("management") };
}
