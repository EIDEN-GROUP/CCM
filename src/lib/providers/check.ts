import type { Db } from "@/lib/repositories/types";
import { Ga4Connector } from "@/providers/google/ga4";
import { GscConnector } from "@/providers/google/gsc";
import { GoogleAdsConnector } from "@/providers/google/google-ads";
import { GtmConnector } from "@/providers/google/gtm";
import { GmailConnector } from "@/providers/google/gmail";
import { MetaConnector } from "@/providers/meta/meta";
import { LinkedInConnector } from "@/providers/linkedin/linkedin";
import { AhrefsConnector } from "@/providers/ahrefs/ahrefs";
import { PageSpeedConnector } from "@/providers/web/pagespeed";
import {
  type ConnectorAccount,
  type ConnectorAuth,
  type ProviderConnector,
} from "@/providers/connector";
import { ConnectorError } from "@/providers/connector";

/**
 * Checking that a connection really works.
 *
 * A connection can be `connected` and still be useless: the token was
 * revoked, the app lost its permissions, the account was unlinked. The
 * only honest check is to ask the provider.
 *
 * The check is the connector's own `listAccounts`, so it exercises the same
 * endpoint the first sync will use. It costs one provider call.
 */

export interface ConnectionCheckResult {
  ok: boolean;
  /** The accounts the provider says this credential can reach. */
  accounts: Array<{ externalAccountId: string; displayLabel: string }>;
  /** What the provider said, when it said something. */
  detail: string | null;
  /** The provider's own error code, when it gave one. */
  code: string | null;
  /** How long the call took. */
  durationMs: number;
}

/**
 * The connector for a provider key.
 */
export function connectorFor(
  providerKey: string,
): ProviderConnector | null {
  switch (providerKey) {
    case "ga4":
      return new Ga4Connector();
    case "gsc":
      return new GscConnector();
    case "google_ads":
      return new GoogleAdsConnector();
    case "gtm":
      return new GtmConnector();
    case "gmail":
      return new GmailConnector();
    case "meta":
      return new MetaConnector({ surface: "page" });
    case "instagram":
      return new MetaConnector({ surface: "instagram" });
    case "linkedin":
      return new LinkedInConnector();
    case "ahrefs":
      return new AhrefsConnector();
    case "pagespeed":
      return new PageSpeedConnector();
    default:
      return null;
  }
}

/**
 * Check a connection against its provider.
 */
export async function checkConnection(options: {
  db: Db;
  providerKey: string;
  accessToken: string;
  account: ConnectorAccount;
}): Promise<ConnectionCheckResult> {
  const connector = connectorFor(options.providerKey);

  if (!connector) {
    return {
      ok: false,
      accounts: [],
      detail: `There is no live check for ${options.providerKey}. It is configured from the website registry rather than from a provider account.`,
      code: "no_check",
      durationMs: 0,
    };
  }

  const startedAt = Date.now();

  try {
    const accounts = await connector.listAccounts({
      accessToken: options.accessToken,
    } as ConnectorAuth);

    return {
      ok: true,
      accounts: accounts.map((account) => ({
        externalAccountId: account.externalAccountId,
        displayLabel: account.displayLabel,
      })),
      detail:
        accounts.length === 0
          ? "The provider accepted the credential but returned no account for it."
          : null,
      code: accounts.length === 0 ? "no_accounts" : null,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof ConnectorError) {
      return {
        ok: false,
        accounts: [],
        detail: error.message,
        code: error.code,
        durationMs: Date.now() - startedAt,
      };
    }

    return {
      ok: false,
      accounts: [],
      detail:
        error instanceof Error ? error.message : "The provider could not be reached.",
      code: "unknown_error",
      durationMs: Date.now() - startedAt,
    };
  }
}
