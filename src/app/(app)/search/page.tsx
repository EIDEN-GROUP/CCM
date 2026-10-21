import type { Metadata } from "next";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { listLaunchableAccounts } from "@/lib/repositories/launcher";
import { listWebsites } from "@/lib/repositories/websites";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

/**
 * Global search.
 *
 * Searches the accounts, websites and providers the signed-in user may
 * already see. It cannot reveal anything the user could not open from the
 * corresponding workspace, because every query is RLS-scoped.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const guard = await requirePermission(session, "overview.read");
  if (!guard.allowed) return guard.response;

  const params = await searchParams;
  const query = (typeof params.q === "string" ? params.q : "").trim();
  const needle = query.toLowerCase();

  const supabase = await createClient();
  const workspaceId = session.workspaceId!;

  const [accounts, websites] = await Promise.all([
    listLaunchableAccounts(supabase, workspaceId).catch(() => []),
    listWebsites(supabase, workspaceId).catch(() => []),
  ]);

  const matchedAccounts = needle
    ? accounts.filter((account) =>
        `${account.providerName} ${account.displayLabel} ${account.externalAccountId ?? ""}`
          .toLowerCase()
          .includes(needle),
      )
    : accounts;

  const matchedWebsites = needle
    ? websites.filter((website) =>
        `${website.name} ${website.domain} ${website.service_lines.join(" ")}`
          .toLowerCase()
          .includes(needle),
      )
    : websites;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search"
        subtitle={
          query
            ? `Results for “${query}”`
            : "Everything your roles give you access to"
        }
      />

      <Card>
        <CardHeader
          title="Accounts"
          subtitle={`${matchedAccounts.length} result${matchedAccounts.length === 1 ? "" : "s"}`}
        />
        <CardBody className="p-0">
          {matchedAccounts.length === 0 ? (
            <EmptyState
              title="No accounts match"
              description="Try a different term, or browse the Account Launcher."
              icon={<Search className="size-5" />}
              className="border-0"
            />
          ) : (
            <DataTable
              label="Account search results"
              rows={matchedAccounts}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "label",
                  header: "Account",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">
                      {row.displayLabel}
                    </span>
                  ),
                },
                {
                  key: "provider",
                  header: "Provider",
                  mobile: "secondary",
                  render: (row) => row.providerName,
                },
                {
                  key: "status",
                  header: "Status",
                  mobile: "secondary",
                  render: (row) => row.status.replace(/_/g, " "),
                },
              ]}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Websites"
          subtitle={`${matchedWebsites.length} result${matchedWebsites.length === 1 ? "" : "s"}`}
        />
        <CardBody className="p-0">
          {matchedWebsites.length === 0 ? (
            <EmptyState
              title="No websites match"
              description="Try a different term."
              className="border-0"
            />
          ) : (
            <DataTable
              label="Website search results"
              rows={matchedWebsites}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "name",
                  header: "Site",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">{row.name}</span>
                  ),
                },
                {
                  key: "domain",
                  header: "Domain",
                  mobile: "secondary",
                  render: (row) => row.domain,
                },
                {
                  key: "services",
                  header: "Services",
                  mobile: "hidden",
                  render: (row) => row.service_lines.join(", ") || "—",
                },
              ]}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
