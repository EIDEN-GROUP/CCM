import type { Metadata } from "next";
import { Plug } from "lucide-react";
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

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        subtitle="Connections, scopes, quotas and freshness."
        actions={
          <ConnectProviderButton
            providers={connectableProviders}
            canManage={session.permissions.has("integrations.manage")}
          />
        }
      />

      <Notice tone="info" title="Honest status">
        A tile only says &ldquo;Connected&rdquo; when CCM holds a working API
        token for that account. Everything else shows what is missing, and the
        setup checklist below lists the approvals that are still outstanding.
      </Notice>

      <Card>
        <CardHeader
          title="Connections"
          subtitle={`${connectionRows.length} configured`}
        />
        <CardBody className="p-0">
          {connectionRows.length === 0 ? (
            <EmptyState
              title="No providers connected"
              description="Connect Google Ads, GA4, Search Console, GTM, Gmail or a social account to start reporting."
              icon={<Plug className="size-5" />}
              className="border-0"
            />
          ) : (
            <DataTable
              label="Connections"
              rows={connectionRows}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "label",
                  header: "Connection",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">
                      {row.display_label}
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
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
                      {row.status.replace(/_/g, " ")}
                    </Chip>
                  ),
                },
                {
                  key: "scopes",
                  header: "Scopes",
                  mobile: "hidden",
                  render: (row) =>
                    row.scopes.length > 0 ? row.scopes.join(", ") : "—",
                },
                {
                  key: "access",
                  header: "Access level",
                  mobile: "hidden",
                  render: (row) => row.api_access_level ?? "—",
                },
                {
                  key: "quota",
                  header: "Quota",
                  numeric: true,
                  mobile: "hidden",
                  render: (row) =>
                    row.quota_limit === null
                      ? "—"
                      : `${row.quota_used}/${row.quota_limit}`,
                },
                {
                  key: "lastSuccess",
                  header: "Last success",
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
                  header: "Last failure",
                  mobile: "hidden",
                  render: (row) => row.last_error_message ?? "—",
                },
              ]}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Provider catalogue"
          subtitle="Every provider CCM knows about, and what it still needs"
        />
        <CardBody className="p-0">
          <DataTable
            label="Provider catalogue"
            rows={definitionRows}
            rowKey={(row) => row.key}
            columns={[
              {
                key: "provider",
                header: "Provider",
                mobile: "primary",
                render: (row) => (
                  <span className="font-semibold text-tertiary">
                    {row.display_name}
                  </span>
                ),
              },
              {
                key: "category",
                header: "Category",
                mobile: "secondary",
                render: (row) => <Chip tone="teal">{row.category}</Chip>,
              },
              {
                key: "apiVersion",
                header: "API version",
                mobile: "secondary",
                render: (row) => row.api_version,
              },
              {
                key: "approvals",
                header: "Still needed",
                mobile: "hidden",
                render: (row) =>
                  row.blocking_approvals.length > 0
                    ? row.blocking_approvals.join(" · ")
                    : "—",
              },
              {
                key: "docs",
                header: "Docs",
                mobile: "hidden",
                render: (row) =>
                  row.docs_url ? (
                    <a
                      href={row.docs_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-ink underline-offset-2 hover:underline"
                    >
                      Open
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
          title="API version watchlist"
          subtitle="Where a deprecation would bite, and how to find out"
        />
        <CardBody>
          <ul className="space-y-2 text-body-sm text-secondary">
            <li>
              <span className="font-semibold text-tertiary">Google Ads</span> —
              developer tokens were sunset on 9 September 2026. Access levels
              now live on the Google Cloud project (Test, Explorer, Basic,
              Standard). Basic and Standard require brand verification.
            </li>
            <li>
              <span className="font-semibold text-tertiary">LinkedIn</span> —
              Marketing API versions are time-based and must be migrated on
              schedule. The pinned version lives in the provider registry, not
              scattered through the code.
            </li>
            <li>
              <span className="font-semibold text-tertiary">Google APIs</span> —
              the Analytics Data API, Search Console API, Tag Manager API v2 and
              Gmail API are versioned centrally in the provider registry.
            </li>          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
