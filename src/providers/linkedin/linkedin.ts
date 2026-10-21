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
 * LinkedIn Marketing API — organisation page analytics.
 *
 * The organisation analytics endpoints are a **restricted partnership API**: a
 * standard app gets a 403 with a clear explanation. CCM reports that
 * honestly rather than substituting a different number, because a LinkedIn
 * impression count and a Meta impression count are not interchangeable.
 *
 * The API version is time-based and must be migrated on schedule; the pinned
 * version lives in the provider registry.
 */

const LINKEDIN_API = "https://api.linkedin.com/rest";
const LINKEDIN_V2 = "https://api.linkedin.com/v2";

/** The organisation page statistic pillars CCM reports. */
const STATISTIC_KEYS = [
  "organicImpressionsImpressionsIndexed",
  "organicImpressionsUniqueMembersImpressed",
  "engagement",
] as const;

interface LinkedInStatistic {
  name?: string;
  value?: number;
  // The v2 shape puts the value in a `total` field.
  total?: number;
}

interface LinkedInTimeInterval {
  timeInterval?: string;
  values?: LinkedInStatistic[];
}

interface LinkedInElement {
  organizationalEntity?: string;
  timeIntervals?: LinkedInTimeInterval[];
}

export class LinkedInConnector implements ProviderConnector {
  readonly key = "linkedin" as const;
  readonly apiVersion = "2026-10";

  constructor(private readonly options: { baseUrl?: string } = {}) {}

  async listAccounts(auth: ConnectorAuth): Promise<ConnectorAccount[]> {
    // The Acls endpoint tells the credential which organisations it can see.
    const response = await providerRequest<{
      elements?: Array<{
        organization?: string;
        roleAssignee?: string;
        state?: string;
      }>;
    }>(auth.accessToken, {
      baseUrl: this.options.baseUrl ?? LINKEDIN_V2,
      path: "/organizationAcls?q=roleAssignee&roleAssignee=me&state=APPROVED&limit=100",
      signal: auth.signal,
      provider: "LinkedIn",
    });

    return (response.elements ?? []).map((element) => {
      const id = (element.organization ?? "").split(":").pop() ?? "";
      return {
        externalAccountId: id,
        displayLabel: `Organisation ${id}`,
        identifiers: { linkedin: { organizationId: id } },
        timezone: null,
        currency: null,
      };
    });
  }

  async readReport(
    account: ConnectorAccount,
    request: ReportRequest,
    auth: ConnectorAuth,
  ): Promise<ReportResult> {
    const organizationId =
      (account.identifiers.linkedin as { organizationId?: string } | undefined)
        ?.organizationId ?? account.externalAccountId;

    if (!organizationId) {
      throw ConnectorError.invalidResponse(
        "The LinkedIn account has no organisation id, so no analytics can be read.",
      );
    }

    const query = new URLSearchParams({
      q: "organizationalEntity",
      organizationalEntity: `urn:li:organization:${organizationId}`,
      timeGranularity: "DAILY",
      timeIntervals: `(start:(year:${request.startDate.slice(0, 4)},month:${Number(
        request.startDate.slice(5, 7),
      )},day:${Number(request.startDate.slice(8, 10))}),end:(year:${request.endDate.slice(
        0,
        4,
      )},month:${Number(request.endDate.slice(5, 7))},day:${Number(
        request.endDate.slice(8, 10),
      )}))`,
    });

    let response: { elements?: LinkedInElement[] };
    try {
      response = await providerRequest<{ elements?: LinkedInElement[] }>(
        auth.accessToken,
        {
          baseUrl: this.options.baseUrl ?? LINKEDIN_API,
          path: `/organizationPageStatistics?${query.toString()}`,
          signal: auth.signal,
          provider: "LinkedIn",
        },
      );
    } catch (error) {
      if (
        error instanceof ConnectorError &&
        (error.code === "permission_denied" || error.code === "auth_failed")
      ) {
        throw new ConnectorError(
          "LinkedIn organisation analytics is a restricted partnership API. This app does not have access to the Marketing API partnership for this organisation.",
          "permission_denied",
          false,
          403,
        );
      }
      throw error;
    }

    const facts: DailyFact[] = [];
    for (const element of response.elements ?? []) {
      for (const interval of element.timeIntervals ?? []) {
        const values: Record<string, number | string | null> = {
          date: interval.timeInterval ?? null,
        };
        for (const statistic of interval.values ?? []) {
          if (!statistic.name) continue;
          const value = statistic.value ?? statistic.total ?? null;
          values[statistic.name] = typeof value === "number" ? value : null;
        }
        facts.push({
          metricDate: interval.timeInterval ?? request.endDate,
          dimension: "linkedin",
          dimensionId: `${organizationId}|${interval.timeInterval ?? ""}`,
          dimensionLabel: "Organisation page statistics",
          values,
          sourceFetchedAt: new Date().toISOString(),
        });
      }
    }

    return {
      facts,
      truncated: false,
      notes: [
        "Organisation page statistics are a restricted LinkedIn partnership API. Without it, this workspace shows no LinkedIn numbers rather than a substitute.",
      ],
    };
  }
}

export const linkedInConnector = new LinkedInConnector();
export { STATISTIC_KEYS };
