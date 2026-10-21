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
 * PageSpeed Insights API v5.
 *
 * The measurement is Google's own, run against the live URL. It is a
 * **field** measurement when the URL has been visited by enough real users,
 * and a **lab** measurement otherwise. CCM reports which one it got, because
 * a lab score is not the same claim as a field score.
 *
 * An API key is optional but strongly recommended: without one the quota is
 * shared and small, and CCM would be competing for it.
 */

const PAGESPEED_API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

interface LighthouseAudit {
  id: string;
  title?: string;
  displayValue?: string;
  numericValue?: number;
  score?: number | null;
  scoreDisplayMode?: string;
}

interface LighthouseResult {
  requestedUrl?: string;
  finalUrl?: string;
  categories?: Record<
    string,
    { id: string; title: string; score: number | null }
  >;
  audits?: Record<string, LighthouseAudit>;
  fetchTime?: string;
}

interface PageSpeedResponse {
  loadingExperience?: {
    id?: string;
    overall_category?: string;
    metrics?: Record<
      string,
      { percentile?: number; category?: string; displayValue?: string }
    >;
  };
  originLoadingExperience?: { id?: string; overall_category?: string };
  lighthouseResult?: LighthouseResult;
  error?: { message?: string; code?: number };
}

export class PageSpeedConnector implements ProviderConnector {
  readonly key = "pagespeed" as const;
  readonly apiVersion = "v5";

  constructor(private readonly options: { baseUrl?: string; apiKey?: string } = {}) {}

  async listAccounts(auth: ConnectorAuth): Promise<ConnectorAccount[]> {
    void auth;
    // PageSpeed is measured against a URL, not an account.
    return [];
  }

  async readReport(
    account: ConnectorAccount,
    request: ReportRequest,
    auth: ConnectorAuth,
  ): Promise<ReportResult> {
    const url =
      (account.identifiers.pagespeed as { url?: string } | undefined)?.url ??
      account.externalAccountId;

    if (!url) {
      throw ConnectorError.invalidResponse(
        "The PageSpeed account has no URL, so nothing can be measured.",
      );
    }

    const strategy = request.device === "desktop" ? "desktop" : "mobile";
    const categories = ["performance", "accessibility", "best-practices", "seo"];

    const query = new URLSearchParams({
      url,
      strategy,
      category: categories.join(","),
    });

    const key = this.options.apiKey;
    if (key) query.set("key", key);

    const response = await providerRequest<PageSpeedResponse>(auth.accessToken, {
      baseUrl: this.options.baseUrl ?? PAGESPEED_API,
      path: `/runPagespeed?${query.toString()}`,
      signal: auth.signal,
      provider: "PageSpeed",
    });

    if (response.error) {
      throw ConnectorError.unavailable(
        `PageSpeed could not measure the page: ${response.error.message ?? response.error.code}`,
      );
    }

    const lighthouse = response.lighthouseResult;
    if (!lighthouse) {
      throw ConnectorError.invalidResponse(
        "PageSpeed returned no Lighthouse result for this URL.",
      );
    }

    const audits = lighthouse.audits ?? {};
    const category = lighthouse.categories ?? {};

    const facts: DailyFact[] = [
      {
        metricDate: request.endDate,
        dimension: "pagespeed",
        dimensionId: url,
        dimensionLabel: lighthouse.finalUrl ?? url,
        values: {
          url: lighthouse.finalUrl ?? url,
          strategy,
          // A score of null is "not measured", which is different from zero.
          performance_score: category.performance?.score ?? null,
          accessibility_score: category.accessibility?.score ?? null,
          best_practices_score: category["best-practices"]?.score ?? null,
          seo_score: category.seo?.score ?? null,
          lcp_ms: audits["largest-contentful-paint"]?.numericValue ?? null,
          fcp_ms: audits["first-contentful-paint"]?.numericValue ?? null,
          cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
          tbt_ms: audits["total-blocking-time"]?.numericValue ?? null,
          speed_index_ms: audits["speed-index"]?.numericValue ?? null,
          // Field data, when the URL has enough real traffic.
          field_overall_category:
            response.loadingExperience?.overall_category ?? null,
          field_lcp_ms:
            response.loadingExperience?.metrics?.["LARGEST_CONTENTFUL_PAINT_MS"]
              ?.percentile ?? null,
          field_fcp_ms:
            response.loadingExperience?.metrics?.["FIRST_CONTENTFUL_PAINT_MS"]
              ?.percentile ?? null,
          field_cls:
            response.loadingExperience?.metrics?.["CUMULATIVE_LAYOUT_SHIFT_SCORE"]
              ?.percentile ?? null,
          measured_at: lighthouse.fetchTime ?? new Date().toISOString(),
        },
        sourceFetchedAt: new Date().toISOString(),
      },
    ];

    const notes = [
      `The Lighthouse run used the ${strategy} strategy.`,
      "A Lighthouse score is a lab measurement of one run. It is not the same claim as the field data.",
    ];

    if (!response.loadingExperience) {
      notes.push(
        "There is no field data for this URL — it has not been visited by enough real users. The field figures are unavailable, not zero.",
      );
    }

    return { facts, truncated: false, notes };
  }
}

export const pageSpeedConnector = new PageSpeedConnector();
