/**
 * Provider connector contract.
 *
 * Every connector implements the same interface, so the sync worker never
 * needs to know which provider it is talking to. The interface is
 * deliberately small: read the accounts, read a report, refresh the token.
 * Optional write operations are declared but disabled in this release.
 */

import type { ProviderKey } from "@/providers/registry";

/** A provider account, as the provider itself describes it. */
export interface ConnectorAccount {
  /** Stable provider-side identifier. */
  externalAccountId: string;
  displayLabel: string;
  /** Provider-specific identifiers used to build launch targets. */
  identifiers: Record<string, unknown>;
  /** The provider's own timezone for this account, if it reports one. */
  timezone?: string | null;
  /** The provider's own currency for this account, if it reports one. */
  currency?: string | null;
}

/** The slice of data a connector was asked for. */
export interface ReportRequest {
  /** Inclusive ISO day. */
  startDate: string;
  /** Inclusive ISO day. */
  endDate: string;
  /** Optional dimension grouping, e.g. "query" or "campaign". */
  dimension?: string;
  /** Device the report is for, where the provider distinguishes them. */
  device?: "desktop" | "mobile";
  /** Maximum rows to read. Providers with row limits are called out. */
  limit?: number;
  /** The provider's pagination cursor, when the previous page was partial. */
  cursor?: string | null;
}

/** A normalised daily fact. */
export interface DailyFact {
  metricDate: string;
  dimension: string;
  dimensionId: string;
  dimensionLabel: string | null;
  /** Metric values keyed by the connector's normalised field names. */
  values: Record<string, number | string | boolean | null>;
  /** The provider timestamp of the record, for lineage. */
  sourceFetchedAt: string;
}

export interface ReportResult {
  facts: DailyFact[];
  /** Set when the provider truncated the result. */
  truncated: boolean;
  /** The provider's own pagination/aggregation caveats. */
  notes: string[];
  /** The next cursor, when the provider paginates. */
  nextCursor?: string | null;
}

export interface ConnectorCapability {
  key: string;
  implemented: boolean;
  requires?: string;
  limitation?: string;
}

export interface ConnectorAuth {
  /** The OAuth access token to present to the provider. */
  accessToken: string;
  /** Cancels the request when the job is abandoned. */
  signal?: AbortSignal;
}

export interface ProviderConnector {
  key: ProviderKey;
  /** The provider API version this adapter targets. */
  apiVersion: string;
  /** List the accounts this credential can reach. */
  listAccounts(auth: ConnectorAuth): Promise<ConnectorAccount[]>;
  /** Read a report for one account. */
  readReport(
    account: ConnectorAccount,
    request: ReportRequest,
    auth: ConnectorAuth,
  ): Promise<ReportResult>;
  /**
   * Refresh the access token. Returns a new token when the provider issued
   * one, or null when the existing token is still valid.
   */
  refreshToken?(
    account: ConnectorAccount,
    auth: ConnectorAuth,
  ): Promise<{ accessToken: string; expiresAt: string } | null>;
  /**
   * Optional write operations. Declared so the capability matrix can say
   * "not available" honestly. None are implemented in this release.
   */
  write?: never;
}

/**
 * A connector failure that the sync worker can classify.
 *
 * `retryable` decides whether the job goes back on the queue or straight to
 * the dead-letter state.
 */
export class ConnectorError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ConnectorError";
  }

  static auth(message: string): ConnectorError {
    return new ConnectorError(message, "auth_failed", false, 401);
  }

  static permission(message: string): ConnectorError {
    return new ConnectorError(message, "permission_denied", false, 403);
  }

  static rateLimited(message: string, retryAfterSeconds?: number): ConnectorError {
    return new ConnectorError(
      retryAfterSeconds
        ? `${message} Retry after ${retryAfterSeconds}s.`
        : message,
      "rate_limited",
      true,
      429,
    );
  }

  static unavailable(message: string): ConnectorError {
    return new ConnectorError(message, "provider_unavailable", true, 503);
  }

  static invalidResponse(message: string): ConnectorError {
    return new ConnectorError(message, "invalid_response", false);
  }
}
