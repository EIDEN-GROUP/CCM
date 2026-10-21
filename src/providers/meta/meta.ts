import {
  type ConnectorAccount,
  type ConnectorAuth,
  type ProviderConnector,
  type ReportRequest,
  type ReportResult,
} from "../connector";
import { providerRequest } from "../http";
import type { ProviderKey } from "../registry";

/**
 * Meta Graph API — Facebook Pages and Instagram professional accounts.
 *
 * Two surfaces, deliberately kept apart:
 *   - **Organic** profile analytics for a Page or an Instagram account.
 *   - **Paid** campaign results, which belong to the Meta Ads connection.
 *
 * CCM never merges the two. The connector serves the organic surface; paid
 * results arrive through the Google Ads-style `daily_ads_metrics` path with
 * their own account.
 */

const GRAPH_VERSION = "v23.0";
const GRAPH_BASE = "https://graph.facebook.com";

/** Page-level insight metrics. */
const PAGE_METRICS = [
  "page_impressions",
  "page_engaged_users",
  "page_post_engagements",
  "page_consumptions",
  "page_views_total",
];

/** Instagram account insight metrics. */
const INSTAGRAM_METRICS = [
  "reach",
  "impressions",
  "profile_views",
  "follower_count",
  "media_count",
  "total_interactions",
];

interface GraphInsightRow {
  name?: string;
  period?: string;
  values?: Array<{ value?: number | string | Record<string, unknown> }>;
  title?: string;
  action_type?: string;
}

export class MetaConnector implements ProviderConnector {
  readonly apiVersion = GRAPH_VERSION;
  readonly key: ProviderKey;

  constructor(
    private readonly options: { baseUrl?: string; surface?: "page" | "instagram" } = {},
  ) {
    this.key = options.surface === "instagram" ? "instagram" : "meta";
  }

  async listAccounts(auth: ConnectorAuth): Promise<ConnectorAccount[]> {
    if (this.options.surface === "instagram") {
      // Instagram accounts are discovered through the Facebook Pages the
      // credential can see.
      const pages = await this.listAccounts(auth);
      return pages;
    }

    const response = await providerRequest<{
      data?: Array<{ id: string; name: string; access_token?: string }>;
    }>(auth.accessToken, {
      baseUrl: this.options.baseUrl ?? GRAPH_BASE,
      path: `/${GRAPH_VERSION}/me/accounts?fields=id,name,access_token,followers_count,category&limit=100`,
      signal: auth.signal,
      provider: "Meta",
    });

    return (response.data ?? []).map((page) => ({
      externalAccountId: page.id,
      displayLabel: page.name,
      identifiers: { meta: { pageId: page.id } },
      timezone: null,
      currency: null,
    }));
  }

  async readReport(
    account: ConnectorAccount,
    request: ReportRequest,
    auth: ConnectorAuth,
  ): Promise<ReportResult> {
    return this.options.surface === "instagram"
      ? this.readInstagram(account, request, auth)
      : this.readPage(account, request, auth);
  }

  private async readPage(
    account: ConnectorAccount,
    request: ReportRequest,
    auth: ConnectorAuth,
  ): Promise<ReportResult> {
    const pageId =
      (account.identifiers.meta as { pageId?: string } | undefined)?.pageId ??
      account.externalAccountId;

    const query = new URLSearchParams({
      metric: PAGE_METRICS.join(","),
      period: "day",
      since: request.startDate,
      until: request.endDate,
      access_token: auth.accessToken,
      limit: String(Math.min(request.limit ?? 500, 500)),
    });

    const response = await providerRequest<{ data?: GraphInsightRow[] }>(
      auth.accessToken,
      {
        baseUrl: this.options.baseUrl ?? GRAPH_BASE,
        path: `/${GRAPH_VERSION}/${encodeURIComponent(pageId)}/insights?${query.toString()}`,
        signal: auth.signal,
        provider: "Meta",
      },
    );

    const facts = (response.data ?? []).map((row) => {
      const values: Record<string, number | string | null> = {
        metric: row.name ?? null,
        date: row.period ?? null,
      };
      for (const entry of row.values ?? []) {
        values[entry.value === undefined ? "value" : "value"] = null;
      }
      // The Graph API returns a single unnamed value per metric row.
      const numeric = row.values?.[0]?.value;
      values.value =
        typeof numeric === "number"
          ? numeric
          : typeof numeric === "string"
            ? Number(numeric)
            : null;
      return {
        metricDate: row.period ?? request.endDate,
        dimension: "meta",
        dimensionId: `${pageId}|${row.name ?? ""}|${row.period ?? ""}`,
        dimensionLabel: row.name ?? null,
        values,
        sourceFetchedAt: new Date().toISOString(),
      };
    });

    return {
      facts,
      truncated: facts.length >= Math.min(request.limit ?? 500, 500),
      notes: [
        "These are organic Page insights. Paid Meta campaign results belong to the paid connection and are never merged with them.",
      ],
    };
  }

  private async readInstagram(
    account: ConnectorAccount,
    request: ReportRequest,
    auth: ConnectorAuth,
  ): Promise<ReportResult> {
    const igId =
      (account.identifiers.meta as { igBusinessAccountId?: string } | undefined)
        ?.igBusinessAccountId ?? account.externalAccountId;

    const query = new URLSearchParams({
      metric: INSTAGRAM_METRICS.join(","),
      period: "day",
      since: request.startDate,
      until: request.endDate,
      access_token: auth.accessToken,
      limit: String(Math.min(request.limit ?? 500, 500)),
    });

    const response = await providerRequest<{ data?: GraphInsightRow[] }>(
      auth.accessToken,
      {
        baseUrl: this.options.baseUrl ?? GRAPH_BASE,
        path: `/${GRAPH_VERSION}/${encodeURIComponent(igId)}/insights?${query.toString()}`,
        signal: auth.signal,
        provider: "Instagram",
      },
    );

    const facts = (response.data ?? []).map((row) => {
      const numeric = row.values?.[0]?.value;
      return {
        metricDate: row.period ?? request.endDate,
        dimension: "instagram",
        dimensionId: `${igId}|${row.name ?? ""}|${row.period ?? ""}`,
        dimensionLabel: row.name ?? null,
        values: {
          metric: row.name ?? null,
          date: row.period ?? null,
          value:
            typeof numeric === "number"
              ? numeric
              : typeof numeric === "string"
                ? Number(numeric)
                : null,
        },
        sourceFetchedAt: new Date().toISOString(),
      };
    });

    return {
      facts,
      truncated: facts.length >= Math.min(request.limit ?? 500, 500),
      notes: [
        "These are organic Instagram insights for a professional account. They require the account to be linked to a Facebook Page.",
        "Instagram only reports reach and impressions for a recent window; older days are not available and are left empty rather than zero.",
      ],
    };
  }
}

export const metaConnector = new MetaConnector({ surface: "page" });
export const instagramConnector = new MetaConnector({ surface: "instagram" });
