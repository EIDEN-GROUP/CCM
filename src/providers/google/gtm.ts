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
 * Google Tag Manager API v2.
 *
 * Read-only inventory: accounts, containers, workspaces, versions, tags,
 * triggers, variables and environments. CCM never publishes a version — see
 * `docs/integrations/connector-capability-matrix.md`.
 */

const GTM_API = "https://tagmanager.googleapis.com/tagmanager/v2";

interface GtmAccount {
  accountId: string;
  name: string;
  displayName: string;
  containerIds?: string[];
}

interface GtmContainer {
  containerId: string;
  accountId: string;
  name: string;
  displayName: string;
  publicId?: string;
}

interface GtmVersion {
  versionId: string;
  versionNumber: number;
  containerId: string;
  name: string;
  description?: string;
  publishedAt?: string;
  tag?: unknown[];
  trigger?: unknown[];
  variable?: unknown[];
  fingerprint?: string;
}

interface GtmWorkspace {
  workspaceId: string;
  name: string;
  description?: string;
}

interface GtmEnvironment {
  environmentId: string;
  name: string;
  description?: string;
  containerVersionId?: string;
  url?: string;
}

export class GtmConnector implements ProviderConnector {
  readonly key = "gtm" as const;
  readonly apiVersion = "v2";

  constructor(private readonly options: { baseUrl?: string } = {}) {}

  async listAccounts(auth: ConnectorAuth): Promise<ConnectorAccount[]> {
    const response = await providerRequest<{ account: GtmAccount[] }>(
      auth.accessToken,
      {
        baseUrl: this.options.baseUrl ?? GTM_API,
        path: "/accounts",
        signal: auth.signal,
        provider: "Tag Manager",
      },
    );

    return (response.account ?? []).map((account) => ({
      externalAccountId: account.accountId,
      displayLabel: account.displayName || account.name,
      identifiers: { gtm: { containerId: account.containerIds?.[0] } },
      timezone: null,
      currency: null,
    }));
  }

  async readReport(
    account: ConnectorAccount,
    request: ReportRequest,
    auth: ConnectorAuth,
  ): Promise<ReportResult> {
    const containerId =
      (account.identifiers.gtm as { containerId?: string } | undefined)
        ?.containerId ?? account.externalAccountId;

    if (!containerId) {
      throw ConnectorError.invalidResponse(
        "The Tag Manager account has no container id, so no inventory can be read.",
      );
    }

    const accountId =
      (account.identifiers.gtm as { accountId?: string } | undefined)
        ?.accountId ?? "";

    const base = {
      baseUrl: this.options.baseUrl ?? GTM_API,
      signal: auth.signal,
      provider: "Tag Manager",
    };

    // The container inventory.
    const containers = await providerRequest<{ container?: GtmContainer[] }>(
      auth.accessToken,
      { ...base, path: accountId ? `/accounts/${accountId}/containers` : "/accounts" },
    );

    const container = (containers.container ?? []).find(
      (item) => item.containerId === containerId,
    );

    if (!container) {
      throw ConnectorError.invalidResponse(
        `The container ${containerId} is not visible to this credential.`,
      );
    }

    // The published version, its workspaces and its environments.
    const [versions, workspaces, environments] = await Promise.all([
      providerRequest<{ version?: GtmVersion[] }>(auth.accessToken, {
        ...base,
        path: `/accounts/${container.accountId}/containers/${containerId}/versions`,
      }).catch(() => ({ version: [] as GtmVersion[] })),
      providerRequest<{ workspace?: GtmWorkspace[] }>(auth.accessToken, {
        ...base,
        path: `/accounts/${container.accountId}/containers/${containerId}/workspaces`,
      }).catch(() => ({ workspace: [] as GtmWorkspace[] })),
      providerRequest<{ environment?: GtmEnvironment[] }>(auth.accessToken, {
        ...base,
        path: `/accounts/${container.accountId}/containers/${containerId}/environments`,
      }).catch(() => ({ environment: [] as GtmEnvironment[] })),
    ]);

    const published = (versions.version ?? [])
      .slice()
      .sort(
        (a, b) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0),
      )
      .at(0);

    // The expected GA4 measurement ids, read from the GA4 configuration tags.
    const measurementIds = collectMeasurementIds(published?.tag ?? []);

    const facts: DailyFact[] = [
      {
        metricDate: request.endDate,
        dimension: "gtm",
        dimensionId: containerId,
        dimensionLabel: container.displayName || container.name,
        values: {
          container_id: containerId,
          public_id: container.publicId ?? null,
          version_id: published?.versionId ?? null,
          version_number: published?.versionNumber ?? null,
          published_at: published?.publishedAt ?? null,
          tag_count: Array.isArray(published?.tag) ? published!.tag!.length : 0,
          trigger_count: Array.isArray(published?.trigger)
            ? published!.trigger!.length
            : 0,
          variable_count: Array.isArray(published?.variable)
            ? published!.variable!.length
            : 0,
          workspace_count: (workspaces.workspace ?? []).length,
          environment_count: (environments.environment ?? []).length,
          measurement_ids: measurementIds.join(","),
        },
        sourceFetchedAt: new Date().toISOString(),
      },
    ];

    return {
      facts,
      truncated: false,
      notes: [
        "The inventory is a read-only snapshot of the published container version. CCM does not publish versions.",
      ],
    };
  }
}

/**
 * Read the GA4 measurement ids referenced by the container's tags.
 *
 * The GA4 configuration tag carries the measurement id in its first argument,
 * e.g. `G-XXXXXXX`. This is how CCM discovers the measurement id when the
 * site does not expose one in its HTML — which is the case for
 * medicalbay.ma, whose GA4 tag is configured inside GTM.
 */
export function collectMeasurementIds(tags: unknown[]): string[] {
  const found = new Set<string>();

  const visit = (value: unknown) => {
    if (typeof value === "string") {
      const match = value.match(/\bG-[A-Z0-9]{4,}\b/);
      if (match) found.add(match[0]);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === "object" && value !== null) {
      for (const nested of Object.values(value)) visit(nested);
    }
  };

  visit(tags);
  return [...found].sort();
}

export const gtmConnector = new GtmConnector();
