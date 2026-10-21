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
 * Google Analytics Data API connector.
 *
 * Read-only. The Admin API is only used to discover which properties the
 * credential can reach; the Data API does the reporting.
 *
 * API version: v1beta. The version is pinned here and in the provider
 * registry rather than scattered through the code.
 */

const DATA_API = "https://analyticsdata.googleapis.com/v1beta";
const ADMIN_API = "https://analyticsadmin.googleapis.com/v1beta";

/** Metrics CCM requests, and the normalised field they land in. */
const METRIC_MAP: Record<string, string> = {
  sessions: "sessions",
  activeUsers: "active_users",
  newUsers: "new_users",
  engagedSessions: "engaged_sessions",
  screenPageViews: "screen_page_views",
  keyEvents: "key_events",
  totalRevenue: "revenue",
};

/** Dimensions CCM requests, and the normalised field they land in. */
const DIMENSION_MAP: Record<string, string> = {
  date: "date",
  sessionSource: "source",
  sessionMedium: "medium",
  sessionSourceMedium: "source_medium",
  sessionCampaignName: "campaign",
  landingPage: "landing_page",
  pagePath: "page",
  deviceCategory: "device",
  country: "country",
  city: "city",
  eventName: "event",
};

interface RunReportResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
  metadata?: {
    currencyCode?: string;
    timeZone?: string;
    dataLossFromOtherRow?: boolean;
    subjectToThresholding?: boolean;
  };
  rowCount?: number;
  totals?: unknown[];
  maximums?: unknown[];
  minimums?: unknown[];
}

export interface Ga4ConnectorOptions {
  /** The Google Cloud project the access token belongs to. */
  projectId?: string;
  /** Override the API base URL (used by contract tests). */
  baseUrl?: string;
}

export class Ga4Connector implements ProviderConnector {
  readonly key = "ga4" as const;
  readonly apiVersion = "v1beta";

  constructor(private readonly options: Ga4ConnectorOptions = {}) {}

  async listAccounts(auth: ConnectorAuth): Promise<ConnectorAccount[]> {
    // The Admin API needs the account hierarchy. In practice a connector
    // instance is bound to one Google Cloud project and one property, so the
    // account list is supplied by configuration rather than crawled.
    const propertyId = this.options.projectId;
    if (!propertyId) {
      throw ConnectorError.invalidResponse(
        "No GA4 property is configured for this connector.",
      );
    }
    void auth;
    return [
      {
        externalAccountId: propertyId,
        displayLabel: propertyId,
        identifiers: { ga4: { propertyId } },
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
    const propertyId =
      (account.identifiers.ga4 as { propertyId?: string } | undefined)
        ?.propertyId ?? account.externalAccountId;

    if (!propertyId) {
      throw ConnectorError.invalidResponse(
        "The GA4 account has no property id, so no report can be requested.",
      );
    }

    const dimension = request.dimension ?? "date";
    const ga4Dimension = GA4_DIMENSION_BY_NORMALISED[dimension] ?? "date";

    const body = {
      dateRanges: [
        {
          startDate: request.startDate,
          endDate: request.endDate,
        },
      ],
      dimensions: [{ name: ga4Dimension }],
      metrics: Object.keys(METRIC_MAP).map((name) => ({ name })),
      // GA4 caps a report at 100,000 rows. The cursor is the row offset.
      limit: Math.min(request.limit ?? 10_000, 100_000),
      offset: 0,
      keepEmptyRows: false,
    };

    const response = await providerRequest<RunReportResponse>(
      auth.accessToken,
      {
        method: "POST",
        baseUrl: this.options.baseUrl ?? DATA_API,
        path: `/properties/${encodeURIComponent(propertyId)}:runReport`,
        body,
        signal: auth.signal,
        provider: "GA4",
      },
    );

    const facts: DailyFact[] = (response.rows ?? []).map((row) => {
      const values: Record<string, number | string | null> = {};

      (row.dimensionValues ?? []).forEach((dimensionValue, index) => {
        const name = Object.values(DIMENSION_MAP)[index];
        if (!name) return;
        values[name] = dimensionValue.value ?? null;
      });

      (row.metricValues ?? []).forEach((metricValue, index) => {
        const name = Object.values(METRIC_MAP)[index];
        if (!name) return;
        values[name] = parseMetricValue(metricValue.value);
      });

      return {
        metricDate:
          typeof values.date === "string" ? values.date : request.startDate,
        dimension,
        dimensionId:
          typeof values[dimension] === "string" ? (values[dimension] as string) : "",
        dimensionLabel:
          typeof values[dimension] === "string" ? (values[dimension] as string) : null,
        values,
        sourceFetchedAt: new Date().toISOString(),
      };
    });

    const notes: string[] = [];
    if (response.metadata?.dataLossFromOtherRow) {
      notes.push(
        "GA4 withheld rows that would let a user be identified. Totals are therefore not a complete count.",
      );
    }
    if (response.metadata?.subjectToThresholding) {
      notes.push(
        "GA4 applied cardinality thresholding, so some rows are grouped into '(other)'.",
      );
    }
    if (response.metadata?.timeZone) {
      notes.push(`Reported in the property timezone ${response.metadata.timeZone}.`);
    }
    if (response.metadata?.currencyCode) {
      notes.push(`Revenue reported in ${response.metadata.currencyCode}.`);
    }

    return {
      facts,
      truncated: (response.rowCount ?? facts.length) >= (request.limit ?? 10_000),
      notes,
      nextCursor: null,
    };
  }

  /**
   * The access token comes from the connection's encrypted credential store
   * and is supplied by the worker, so the connector never touches the
   * database and never holds a secret.
   */
}

/** Normalised dimension name to the GA4 dimension name. */
const GA4_DIMENSION_BY_NORMALISED: Record<string, string> = {
  date: "date",
  source: "sessionSourceMedium",
  medium: "sessionMedium",
  source_medium: "sessionSourceMedium",
  campaign: "sessionCampaignName",
  landing_page: "landingPage",
  page: "pagePath",
  device: "deviceCategory",
  country: "country",
  city: "city",
  event: "eventName",
};

/**
 * GA4 returns metric values as strings. An empty string means the provider
 * has no value, which is `null` and not zero.
 */
export function parseMetricValue(raw: string | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export const ga4Connector = new Ga4Connector();
export { ADMIN_API };
