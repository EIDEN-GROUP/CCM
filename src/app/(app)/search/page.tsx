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
import { getTranslator } from "@/lib/i18n-server";
import { formatMessage, type MessagePathRoot, type Translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** A message key inside the `browser` namespace, which owns the launch states. */
type BrowserPath = Extract<MessagePathRoot, `browser.${string}`>;

/**
 * The launch states of an account.
 *
 * `browser.*` already carries the vocabulary, so the catalogue is reused
 * rather than duplicated here.
 */
const LAUNCH_STATUS: Record<string, BrowserPath> = {
  ready: "browser.ready",
  profile_unmapped: "browser.profileUnmapped",
  extension_not_paired: "browser.extensionNotPaired",
  helper_unavailable: "browser.helperUnavailable",
  browser_unsupported: "browser.browserUnsupported",
};

function labelFor(
  t: Translator,
  map: Record<string, BrowserPath>,
  value: string,
): string {
  const key = map[value];
  return key ? t(key) : value;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("pages.search.title") };
}

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

  const t = await getTranslator();

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

  const accountsLabel =
    matchedAccounts.length === 1
      ? t("pages.search.resultsOne")
      : formatMessage(t("pages.search.resultsOther"), {
          count: matchedAccounts.length,
        });

  const websitesLabel =
    matchedWebsites.length === 1
      ? t("pages.search.resultsOne")
      : formatMessage(t("pages.search.resultsOther"), {
          count: matchedWebsites.length,
        });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.search.title")}
        subtitle={
          query
            ? formatMessage(t("pages.search.resultsFor"), { query })
            : t("pages.search.subtitleAll")
        }
      />

      <Card>
        <CardHeader
          title={t("pages.search.accountsTitle")}
          subtitle={accountsLabel}
        />
        <CardBody className="p-0">
            <DataTable
              label={t("pages.search.accountsTable")}
              rows={matchedAccounts}
              empty={
                <EmptyState
                  title={t("pages.search.noAccountsTitle")}
                  description={t("pages.search.noAccountsBody")}
                  icon={<Search className="size-5" />}
                  className="border-0"
                />
              }
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "label",
                  header: t("common.account"),
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">
                      {row.displayLabel}
                    </span>
                  ),
                },
                {
                  key: "provider",
                  header: t("common.provider"),
                  mobile: "secondary",
                  render: (row) => row.providerName,
                },
                {
                  key: "status",
                  header: t("common.status"),
                  mobile: "secondary",
                  render: (row) => labelFor(t, LAUNCH_STATUS, row.status),
                },
              ]}
            />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.search.websitesTitle")}
          subtitle={websitesLabel}
        />
        <CardBody className="p-0">
            <DataTable
              label={t("pages.search.websitesTable")}
              rows={matchedWebsites}
              empty={
                <EmptyState
                  title={t("pages.search.noWebsitesTitle")}
                  description={t("pages.search.noWebsitesBody")}
                  className="border-0"
                />
              }
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "name",
                  header: t("pages.search.columnSite"),
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">{row.name}</span>
                  ),
                },
                {
                  key: "domain",
                  header: t("pages.search.columnDomain"),
                  mobile: "secondary",
                  render: (row) => row.domain,
                },
                {
                  key: "services",
                  header: t("pages.search.columnServices"),
                  mobile: "secondary",
                  render: (row) => row.service_lines.join(", ") || "—",
                },
              ]}
            />
        </CardBody>
      </Card>
    </div>
  );
}
