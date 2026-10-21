import {
  ConnectorError,
  type ConnectorAccount,
  type ConnectorAuth,
  type DailyFact,
  type ProviderConnector,
  type ReportRequest,
  type ReportResult,
} from "../connector";
import { providerRequest } from "../http";

/**
 * Google Ads connector.
 *
 * Read-only.
 *
 * **Access model.** Developer tokens were sunset on 9 September 2026. API
 * access levels now live on the Google Cloud project, and the token is
 * optional. This adapter therefore sends no `developer-token` header; a
 * project on Test access will fail against a production account with
 * `AuthorizationError.CLOUD_PROJECT_NOT_PROVED_FOR_PRODUCTION`, which is
 * turned into an actionable, non-retryable error naming the fix.
 *
 * API version: v25. Pinned here and in the provider registry.
 */

const ADS_API = "https://googleads.googleapis.com/v25";

interface SearchResponse {
  results?: Array<{
    campaign?: {
      id?: string;
      name?: string;
      status?: string;
      advertisingChannelType?: string;
    };
    adGroup?: { id?: string; name?: string };
    metrics?: {
      impressions?: string;
      clicks?: string;
      costMicros?: string;
      conversions?: string;
      conversionsValue?: string;
      ctr?: string;
      averageCpc?: string;
    };
    segments?: { date?: string; device?: string; geo?: string; network?: string };
    customer?: { id?: string; currencyCode?: string; timeZone?: string };
  }>;
  nextPageToken?: string;
  fieldMask?: string;
}

export interface GoogleAdsConnectorOptions {
  /** Override the API base URL (used by contract tests). */
  baseUrl?: string;
  /**
   * The manager (MCC) customer id, sent as `login-customer-id` when the
   * target account is reached through a manager account.
   */
  loginCustomerId?: string;
}

export class GoogleAdsConnector implements ProviderConnector {
  readonly key = "google_ads" as const;
  readonly apiVersion = "v25";

  constructor(private readonly options: GoogleAdsConnectorOptions = {}) {}

  async listAccounts(auth: ConnectorAuth): Promise<ConnectorAccount[]> {
    void auth;
    // Account discovery is driven by the customer ids the owner has linked
    // in the account registry, not by crawling the hierarchy.
    return [];
  }

  async readReport(
    account: ConnectorAccount,
    request: ReportRequest,
    auth: ConnectorAuth,
  ): Promise<ReportResult> {
    const customerId =
      (account.identifiers.google_ads as { customerId?: string } | undefined)
        ?.customerId ?? account.externalAccountId;

    if (!customerId) {
      throw ConnectorError.invalidResponse(
        "The Google Ads account has no customer id, so no report can be requested.",
      );
    }

    const dimension = request.dimension ?? "campaign";
    const query = buildQuery(dimension, request);

    const headers: Record<string, string> = {};
    if (this.options.loginCustomerId) {
      headers["login-customer-id"] = this.options.loginCustomerId.replace(/-/g, "");
    }

    const response = await providerRequest<SearchResponse>(
      auth.accessToken,
      {
        method: "POST",
        baseUrl: this.options.baseUrl ?? ADS_API,
        path: `/customers/${encodeURIComponent(customerId)}/googleAds:searchStream`,
        headers,
        body: { query, pageSize: 1000, pageToken: request.cursor ?? undefined },
        signal: auth.signal,
        provider: "Google Ads",
      },
    );

    const facts: DailyFact[] = (response.results ?? []).map((row) => {
      const dimensionId =
        row.campaign?.id ??
        row.adGroup?.id ??
        row.segments?.device ??
        row.segments?.geo ??
        row.segments?.network ??
        "";
      const dimensionLabel =
        row.campaign?.name ??
        row.adGroup?.name ??
        row.segments?.device ??
        row.segments?.geo ??
        row.segments?.network ??
        null;

      return {
        metricDate: row.segments?.date ?? request.startDate,
        dimension,
        dimensionId,
        dimensionLabel,
        values: {
          impressions: parseNumber(row.metrics?.impressions),
          clicks: parseNumber(row.metrics?.clicks),
          cost_micros: parseNumber(row.metrics?.costMicros),
          conversions: parseNumber(row.metrics?.conversions),
          conversion_value_micros: parseNumber(row.metrics?.conversionsValue),
          ctr: parseNumber(row.metrics?.ctr),
          avg_cpc_micros: parseNumber(row.metrics?.averageCpc),
        },
        sourceFetchedAt: new Date().toISOString(),
      };
    });

    const notes: string[] = [
      "Conversions use the Google Ads attribution model and the conversion actions configured in the account. They are not comparable with GA4 key events.",
      "Cost is reported in micros of the account currency.",
    ];
    if (rowLimitHit(response)) {
      notes.push(
        "The response hit the page limit, so the results cover only part of the selected period.",
      );
    }

    return {
      facts,
      truncated: Boolean(response.nextPageToken),
      notes,
      nextCursor: response.nextPageToken ?? null,
    };
  }
}

/**
 * The GAQL query for a normalised dimension.
 *
 * Only the dimensions CCM normalises are selected, so the response stays
 * small and the mapping stays explicit.
 */
function buildQuery(dimension: string, request: ReportRequest): string {
  const select = [
    "campaign.id",
    "campaign.name",
    "segments.date",
    "metrics.impressions",
    "metrics.clicks",
    "metrics.cost_micros",
    "metrics.conversions",
    "metrics.conversions_value",
  ];

  if (dimension === "ad_group") select.push("ad_group.id", "ad_group.name");
  if (dimension === "device") select.push("segments.device");
  if (dimension === "geo") select.push("segments.geo");
  if (dimension === "network") select.push("segments.network");

  const where = [
    `segments.date BETWEEN '${request.startDate}' AND '${request.endDate}'`,
  ];

  return `SELECT ${select.join(", ")} FROM campaign WHERE ${where.join(" AND ")}`;
}

function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowLimitHit(response: SearchResponse): boolean {
  return (response.results?.length ?? 0) >= 1000;
}

export const googleAdsConnector = new GoogleAdsConnector();
