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
 * Ahrefs API v3 — Rank Tracker.
 *
 * Base URL: `https://api.ahrefs.com/v3`.
 *
 * `GET /rank-tracker/overview` requires `project_id` (integer), `device`
 * (`desktop` or `mobile`) and `select`. The endpoint is documented as free
 * — it does not consume API units.
 *
 * These are **provider-observed** positions. They are not Google Search
 * Console average positions and CCM never blends the two.
 */

const AHREFS_API = "https://api.ahrefs.com/v3";

/** The columns CCM asks for. */
const OVERVIEW_COLUMNS = [
  "keyword",
  "position",
  "position_prev",
  "position_diff",
  "country",
  "language",
  "location",
  "url",
  "search_volume",
].join(",");

interface AhrefsOverviewRow {
  keyword?: string;
  position?: number | null;
  position_prev?: number | null;
  position_diff?: number | null;
  country?: string;
  language?: string;
  location?: string;
  url?: string;
  search_volume?: number | null;
}

interface AhrefsOverviewResponse {
  overviews?: AhrefsOverviewRow[];
}

export class AhrefsConnector implements ProviderConnector {
  readonly key = "ahrefs" as const;
  readonly apiVersion = "v3";

  constructor(private readonly options: { baseUrl?: string } = {}) {}

  async listAccounts(auth: ConnectorAuth): Promise<ConnectorAccount[]> {
    void auth;
    // Ahrefs projects are configured by the owner, not discovered by the API.
    return [];
  }

  async readReport(
    account: ConnectorAccount,
    request: ReportRequest,
    auth: ConnectorAuth,
  ): Promise<ReportResult> {
    const projectId =
      (account.identifiers.ahrefs as { projectId?: string } | undefined)
        ?.projectId ?? account.externalAccountId;

    if (!projectId) {
      throw ConnectorError.invalidResponse(
        "The Ahrefs account has no Rank Tracker project id, so no ranks can be read.",
      );
    }

    const device = request.device ?? "desktop";
    const date = request.endDate;

    const query = new URLSearchParams({
      select: OVERVIEW_COLUMNS,
      project_id: projectId,
      device,
      date,
      limit: String(Math.min(request.limit ?? 1000, 1000)),
      output: "json",
    });

    const response = await providerRequest<AhrefsOverviewResponse>(
      auth.accessToken,
      {
        baseUrl: this.options.baseUrl ?? AHREFS_API,
        path: `/rank-tracker/overview?${query.toString()}`,
        signal: auth.signal,
        provider: "Ahrefs",
      },
    );

    const facts: DailyFact[] = (response.overviews ?? [])
      .filter((row) => row.keyword)
      .map((row) => ({
        metricDate: date,
        dimension: "rank",
        dimensionId: `${row.keyword}|${row.country ?? ""}|${device}`,
        dimensionLabel: row.keyword!,
        values: {
          keyword: row.keyword!,
          position: row.position ?? null,
          position_prev: row.position_prev ?? null,
          position_diff: row.position_diff ?? null,
          country: row.country ?? null,
          language: row.language ?? null,
          location: row.location ?? null,
          url: row.url ?? null,
          search_volume: row.search_volume ?? null,
          device,
        },
        sourceFetchedAt: new Date().toISOString(),
      }));

    return {
      facts,
      truncated: facts.length >= Math.min(request.limit ?? 1000, 1000),
      notes: [
        "Positions are Ahrefs observations for the requested device. They are not Search Console average positions and CCM never merges the two.",
        "The Rank Tracker overview endpoint does not consume API units.",
      ],
    };
  }
}

export const ahrefsConnector = new AhrefsConnector();
