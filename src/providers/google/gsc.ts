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
 * Google Search Console connector.
 *
 * Read-only, and honest about what the API actually returns: the
 * searchanalytics.query endpoint returns *aggregated* rows. A site with many
 * long-tail queries is sampled and grouped, and the API never returns every
 * query. The connector reports that in its notes so the UI can say so
 * instead of implying completeness.
 *
 * API version: v1.
 */

const SEARCH_CONSOLE_API = "https://searchconsole.googleapis.com/webmasters/v3";

interface QueryResponse {
  rows?: Array<{
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  }>;
  responseAggregationType?: string;
}

export interface GscConnectorOptions {
  /** Override the API base URL (used by contract tests). */
  baseUrl?: string;
  /** The property the connector is bound to, e.g. "sc-domain:medicalbay.ma". */
  propertyUrl?: string;
}

export class GscConnector implements ProviderConnector {
  readonly key = "gsc" as const;
  readonly apiVersion = "v1";

  constructor(private readonly options: GscConnectorOptions = {}) {}

  async listAccounts(auth: ConnectorAuth): Promise<ConnectorAccount[]> {
    const propertyUrl = this.options.propertyUrl;
    if (!propertyUrl) {
      throw ConnectorError.invalidResponse(
        "No Search Console property is configured for this connector.",
      );
    }
    void auth;
    return [
      {
        externalAccountId: propertyUrl,
        displayLabel: propertyUrl,
        identifiers: { gsc: { propertyUrl } },
        timezone: null,
        currency: null,
      },
    ];
  }

  async readReport(
    account: ConnectorAccount,
    request: ReportRequest,
    auth: ConnectorAuth,
  ): Promise<ReportResult> {
    const propertyUrl =
      (account.identifiers.gsc as { propertyUrl?: string } | undefined)
        ?.propertyUrl ?? account.externalAccountId;

    if (!propertyUrl) {
      throw ConnectorError.invalidResponse(
        "The Search Console account has no property, so no report can be requested.",
      );
    }

    const dimension = request.dimension ?? "date";
    const dimensions = GSC_DIMENSIONS[dimension] ?? ["date"];

    const body = {
      startDate: request.startDate,
      endDate: request.endDate,
      dimensions,
      // The API rejects a rowLimit above 25,000.
      rowLimit: Math.min(request.limit ?? 25_000, 25_000),
      startRow: 0,
      dataState: "final",
    };

    const response = await providerRequest<QueryResponse>(
      auth.accessToken,
      {
        method: "POST",
        baseUrl: this.options.baseUrl ?? SEARCH_CONSOLE_API,
        path: `/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`,
        body,
        signal: auth.signal,
        provider: "Search Console",
      },
    );

    const facts: DailyFact[] = (response.rows ?? []).map((row) => {
      const keys = row.keys ?? [];
      const values: Record<string, number | string | null> = {
        clicks: row.clicks ?? null,
        impressions: row.impressions ?? null,
        ctr: row.ctr ?? null,
        position: row.position ?? null,
      };

      dimensions.forEach((name, index) => {
        values[name] = keys[index] ?? null;
      });

      // Search Console reports by date. A row with a date dimension carries
      // its own day; a row without one is an aggregate across the window and
      // is dated to the window start so it is not mistaken for a daily fact.
      const day = dimensions.includes("date") ? (keys[0] ?? request.startDate) : request.startDate;

      return {
        metricDate: day,
        dimension,
        dimensionId: keys.join(" | "),
        dimensionLabel: keys.length > 0 ? keys[keys.length - 1] ?? null : null,
        values,
        sourceFetchedAt: new Date().toISOString(),
      };
    });

    const notes: string[] = [
      "The Search Console query endpoint returns aggregated rows. It does not return every query; long-tail queries are sampled and grouped.",
    ];
    if (response.responseAggregationType) {
      notes.push(`The API aggregated the response as "${response.responseAggregationType}".`);
    }
    if ((response.rows?.length ?? 0) >= Math.min(request.limit ?? 25_000, 25_000)) {
      notes.push(
        "The response hit the row limit, so the results are a partial view of the period.",
      );
    }

    return {
      facts,
      truncated:
        (response.rows?.length ?? 0) >= Math.min(request.limit ?? 25_000, 25_000),
      notes,
      nextCursor: null,
    };
  }
}

/** Normalised dimension name to the Search Console dimension list. */
const GSC_DIMENSIONS: Record<string, string[]> = {
  date: ["date"],
  query: ["query"],
  page: ["page"],
  country: ["country"],
  device: ["device"],
  search_type: ["searchType"],
};

export const gscConnector = new GscConnector();
