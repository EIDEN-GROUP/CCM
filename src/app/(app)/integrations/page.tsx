import type { Metadata } from "next";
import { Plug, Boxes } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Chip } from "@/components/ui/chip";
import { ConnectionActions } from "@/components/integrations/connection-actions";
import { ConnectProviderButton } from "@/components/integrations/connect-provider-button";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { formatAge } from "@/domain/freshness";
import { oauthProviderFor, OAUTH_PROVIDER_LIST } from "@/lib/oauth/registry";
import { listAppCredentials } from "@/lib/providers/app-credentials";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTranslator } from "@/lib/i18n-server";
import { formatMessage, type MessagePathRoot, type Translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** A message key inside the `pages.integrations` namespace. */
type IntegrationsPath = Extract<MessagePathRoot, `pages.integrations.${string}`>;

/** A message key inside the `api` namespace, which owns the connection states. */
type ApiPath = Extract<MessagePathRoot, `api.${string}`>;

/**
 * The connection states.
 *
 * `api.*` already carries the vocabulary of a connection, so the catalogue
 * is reused rather than duplicated here.
 */
const CONNECTION_STATUS: Record<string, ApiPath> = {
  connected: "api.connected",
  needs_setup: "api.needsSetup",
  token_refresh_failed: "api.tokenRefreshFailed",
  permission_revoked: "api.permissionRevoked",
  provider_outage: "api.providerOutage",
  rate_limited: "api.rateLimited",
  sync_stale: "api.syncStale",
};

/** The provider taxonomy. */
const CATEGORY: Record<string, IntegrationsPath> = {
  advertising: "pages.integrations.categoryAdvertising",
  analytics: "pages.integrations.categoryAnalytics",
  search: "pages.integrations.categorySearch",
  tagging: "pages.integrations.categoryTagging",
  social: "pages.integrations.categorySocial",
  email: "pages.integrations.categoryEmail",
  seo: "pages.integrations.categorySeo",
  ux: "pages.integrations.categoryUx",
  site: "pages.integrations.categorySite",
};

function labelFor(
  t: Translator,
  map: Record<string, IntegrationsPath> | Record<string, ApiPath>,
  value: string,
): string {
  const key = map[value];
  return key ? t(key) : value;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("pages.integrations.title") };
}

/**
 * The connection catalogue.
 *
 * Every provider shows its real state: connected, needs setup, failed, rate
 * limited, and so on. A provider that is not connected says so, with the
 * steps needed to connect it.
 */
export default async function IntegrationsPage() {
  const session = await getSession();
  const guard = await requirePermission(session, "integrations.read");
  if (!guard.allowed) return guard.response;

  const t = await getTranslator();

  const supabase = await createClient();
  const workspaceId = session.workspaceId!;

  const [{ data: connections }, { data: definitions }] = await Promise.all([
    supabase
      .from("provider_connections")
      .select(
        "id, provider_key, display_label, status, auth_mode, scopes, api_access_level, quota_limit, quota_used, last_success_at, last_attempt_at, last_error_code, last_error_message, next_refresh_at",
      )
      .eq("workspace_id", workspaceId),
    supabase
      .from("provider_definitions")
      .select(
        "key, display_name, category, api_version, hosts, docs_url, blocking_approvals",
      ),
  ]);

  const connectionRows = (connections ?? []) as Array<{
    id: string;
    provider_key: string;
    display_label: string;
    status: string;
    auth_mode: string;
    scopes: string[];
    api_access_level: string | null;
    quota_limit: number | null;
    quota_used: number;
    last_success_at: string | null;
    last_attempt_at: string | null;
    last_error_code: string | null;
    last_error_message: string | null;
    next_refresh_at: string | null;
  }>;

  const definitionRows = (definitions ?? []) as Array<{
    key: string;
    display_name: string;
    category: string;
    api_version: string;
    hosts: string[];
    docs_url: string | null;
    blocking_approvals: string[];
  }>;

  // Which providers have their app configured. The owner adds the client
  // id and secret in Settings — Provider apps, so a connection can be made
  // without a redeploy.
  const admin = createAdminClient();
  const appCredentials = await listAppCredentials(admin, workspaceId).catch(
    () => [],
  );
  const configuredApps = new Set(
    appCredentials.map((credential) => credential.providerKey),
  );

  // The providers that can be connected from here, and whether their app
  // has been set up. A provider that is not configured says so rather than
  // failing when the button is pressed.
  const connectableProviders = OAUTH_PROVIDER_LIST.map((config) => ({
    key: config.key,
    displayName: config.displayName,
    products: config.products.map((product) => ({
      key: product.key,
      label: product.label,
    })),
    configured: configuredApps.has(config.key),
  }));

  const now = new Date();

  const connectionsSubtitle =
    connectionRows.length === 1
      ? t("pages.integrations.connectionsSubtitleOne")
      : formatMessage(t("pages.integrations.connectionsSubtitleOther"), {
          count: connectionRows.length,
        });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.integrations.title")}
        subtitle={t("pages.integrations.subtitle")}
        actions={
          <ConnectProviderButton
            providers={connectableProviders}
            canManage={session.permissions.has("integrations.manage")}
          />
        }
      />

      <Notice tone="info" title={t("pages.integrations.honestStatusTitle")}>
        {t("pages.integrations.honestStatusBody")}
      </Notice>

      <Card>
        <CardHeader
          title={t("pages.integrations.connectionsTitle")}
          subtitle={connectionsSubtitle}
        />
        <CardBody className="p-0">
          <DataTable
            label={t("pages.integrations.connectionsTable")}
            rows={connectionRows}
            empty={
              <EmptyState
                title={t("pages.integrations.noConnectionsTitle")}
                description={t("pages.integrations.noConnectionsBody")}
                icon={<Plug className="size-5" />}
                className="border-0"
              />
            }
            rowKey={(row) => row.id}
            columns={[
              {
                key: "label",
                header: t("pages.integrations.columnConnection"),
                mobile: "primary",
                render: (row) => (
                  <span className="font-semibold text-tertiary">
                    {row.display_label}
                  </span>
                ),
              },
              {
                key: "status",
                header: t("common.status"),
                mobile: "secondary",
                render: (row) => (
                  <Chip
                    tone={
                      row.status === "connected"
                        ? "success"
                        : row.status === "needs_setup"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {labelFor(t, CONNECTION_STATUS, row.status)}
                  </Chip>
                ),
              },
              {
                key: "scopes",
                header: t("pages.integrations.scopes"),
                mobile: "secondary",
                render: (row) =>
                  row.scopes.length > 0 ? row.scopes.join(", ") : "—",
              },
              {
                key: "access",
                header: t("pages.integrations.columnAccessLevel"),
                mobile: "secondary",
                render: (row) => row.api_access_level ?? "—",
              },
              {
                key: "quota",
                header: t("pages.integrations.quota"),
                numeric: true,
                mobile: "secondary",
                render: (row) =>
                  row.quota_limit === null
                    ? "—"
                    : `${row.quota_used}/${row.quota_limit}`,
              },
              {
                key: "lastSuccess",
                header: t("pages.integrations.lastSuccess"),
                mobile: "secondary",
                render: (row) =>
                  row.last_success_at
                    ? formatAge(
                        (now.getTime() - Date.parse(row.last_success_at)) / 1000,
                      )
                    : "—",
              },
              {
                key: "actions",
                header: "",
                mobile: "secondary",
                render: (row) => (
                  <ConnectionActions
                    connectionId={row.id}
                    providerKey={row.provider_key}
                    status={row.status}
                    canManage={session.permissions.has("integrations.manage")}
                    oauthProvider={oauthProviderFor(row.provider_key)}
                    appConfigured={
                      (() => {
                        const provider = oauthProviderFor(row.provider_key);
                        return provider ? configuredApps.has(provider) : false;
                      })()
                    }
                  />
                ),
              },
              {
                key: "error",
                header: t("pages.integrations.lastFailure"),
                mobile: "secondary",
                render: (row) => row.last_error_message ?? "—",
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.integrations.providerCatalogueTitle")}
          subtitle={t("pages.integrations.providerCatalogueSubtitle")}
        />
        <CardBody className="p-0">
          <DataTable
            label={t("pages.integrations.providerCatalogueTable")}
            rows={definitionRows}
            empty={
              <EmptyState
                title={t("pages.integrations.noProviderCatalogueTitle")}
                description={t("pages.integrations.noProviderCatalogueBody")}
                icon={<Boxes className="size-5" />}
                className="border-0"
              />
            }
            rowKey={(row) => row.key}
            columns={[
              {
                key: "provider",
                header: t("common.provider"),
                mobile: "primary",
                render: (row) => (
                  <span className="font-semibold text-tertiary">
                    {row.display_name}
                  </span>
                ),
              },
              {
                key: "category",
                header: t("pages.integrations.columnCategory"),
                mobile: "secondary",
                render: (row) => (
                  <Chip tone="teal">{labelFor(t, CATEGORY, row.category)}</Chip>
                ),
              },
              {
                key: "apiVersion",
                header: t("pages.integrations.apiVersion"),
                mobile: "secondary",
                render: (row) => row.api_version,
              },
              {
                key: "approvals",
                header: t("pages.integrations.columnStillNeeded"),
                mobile: "secondary",
                render: (row) =>
                  row.blocking_approvals.length > 0
                    ? row.blocking_approvals.join(" · ")
                    : "—",
              },
              {
                key: "docs",
                header: t("pages.integrations.columnDocs"),
                mobile: "secondary",
                render: (row) =>
                  row.docs_url ? (
                    <a
                      href={row.docs_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-ink underline-offset-2 hover:underline"
                    >
                      {t("common.open")}
                    </a>
                  ) : (
                    "—"
                  ),
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.integrations.changelog")}
          subtitle={t("pages.integrations.watchlistSubtitle")}
        />
        <CardBody>
          <ul className="space-y-2 text-body-sm text-secondary">
            <li>
              <span className="font-semibold text-tertiary">Google Ads</span>
              {" — "}
              {t("pages.integrations.watchlistGoogleAds")}
            </li>
            <li>
              <span className="font-semibold text-tertiary">LinkedIn</span>
              {" — "}
              {t("pages.integrations.watchlistLinkedIn")}
            </li>
            <li>
              <span className="font-semibold text-tertiary">Google APIs</span>
              {" — "}
              {t("pages.integrations.watchlistGoogleApis")}
            </li>          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
