import type { Metadata } from "next";
import { Globe } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Chip } from "@/components/ui/chip";
import { RegisterWebsiteButton } from "@/components/websites/register-website-button";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import {
  listWebsiteDomains,
  listWebsites,
  listWebsitePages,
  latestHealthChecks,
} from "@/lib/repositories/websites";
import { formatAge } from "@/domain/freshness";

export const metadata: Metadata = { title: "Websites" };
export const dynamic = "force-dynamic";

/**
 * The website portfolio.
 *
 * The registry is generic, so a future Medical Bay microsite appears here by
 * adding a row — no code or schema change.
 */
export default async function WebsitesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const guard = await requirePermission(session, "websites.read");
  if (!guard.allowed) return guard.response;

  const supabase = await createClient();
  const params = await searchParams;
  const siteFilter =
    typeof params.site === "string" ? params.site : undefined;

  const [websites, pages, checks, domains] = await Promise.all([
    listWebsites(supabase, session.workspaceId!).catch(() => []),
    listWebsitePages(supabase, session.workspaceId!, {
      websiteId: siteFilter,
      limit: 200,
    }).catch(() => []),
    latestHealthChecks(supabase, session.workspaceId!).catch(() => []),
    listWebsiteDomains(supabase, session.workspaceId!).catch(() => []),
  ]);

  const hostnamesFor = (websiteId: string) =>
    domains
      .filter((entry) => entry.website_id === websiteId)
      .map((entry) => entry.hostname);

  const now = new Date();
  const healthFor = (websiteId: string) => {
    const latest = checks.find(
      (check) => check.website_id === websiteId && check.check_type === "uptime",
    );
    return latest ?? null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Websites"
        subtitle="Portfolio of sites, pages, traffic and health."
        actions={
          <RegisterWebsiteButton
            canManage={session.permissions.has("integrations.manage")}
          />
        }
      />

      <Notice tone="info" title="Adding a site">
        Registering a site links it to a Google Search Console property, a GA4
        property and optionally a GTM container. The registry stores only the
        domain and the provider identifiers — never a page snapshot of the
        site.
      </Notice>

      <Card>
        <CardHeader
          title="Portfolio"
          subtitle={`${websites.length} site${websites.length === 1 ? "" : "s"}`}
        />
        <CardBody className="p-0">
          {websites.length === 0 ? (
            <EmptyState
              title="No sites registered"
              description="Register medicalbay.ma to start reporting on traffic, search and site health."
              icon={<Globe className="size-5" />}
              className="border-0"
            />
          ) : (
            <DataTable
              label="Websites"
              rows={websites}
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
                  render: (row) => (
                    <a
                      href={`https://${row.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-ink underline-offset-2 hover:underline"
                    >
                      {row.domain}
                    </a>
                  ),
                },
                {
                  key: "hostnames",
                  header: "Hostnames",
                  mobile: "hidden",
                  render: (row) => {
                    const list = hostnamesFor((row as { id: string }).id);
                    return list.length > 0 ? list.join(", ") : "—";
                  },
                },
                {
                  key: "locales",
                  header: "Languages",
                  mobile: "secondary",
                  render: (row) => (
                    <span className="flex flex-wrap gap-1">
                      {row.locales.map((locale) => (
                        <Chip key={locale} tone="teal">
                          {locale.toUpperCase()}
                        </Chip>
                      ))}
                    </span>
                  ),
                },
                {
                  key: "services",
                  header: "Services",
                  mobile: "hidden",
                  render: (row) =>
                    row.service_lines.length > 0
                      ? row.service_lines.join(", ")
                      : "—",
                },
                {
                  key: "health",
                  header: "Health",
                  mobile: "secondary",
                  render: (row) => {
                    const check = healthFor(row.id);
                    if (!check) return <span className="text-muted-text">—</span>;
                    return (
                      <Chip
                        tone={
                          check.status === "ok"
                            ? "success"
                            : check.status === "critical"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {check.status}
                      </Chip>
                    );
                  },
                },
                {
                  key: "lastSync",
                  header: "Last check",
                  mobile: "secondary",
                  render: (row) => {
                    const check = healthFor(row.id);
                    return check
                      ? formatAge(
                          (now.getTime() - Date.parse(check.checked_at)) / 1000,
                        )
                      : "—";
                  },
                },
              ]}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Pages & landing pages"
          subtitle="Inventory grouped by language, service and page class"
        />
        <CardBody className="p-0">
          {pages.length === 0 ? (
            <EmptyState
              title="No pages inventoried yet"
              description="The technical crawl fills this in. CCM records the URL, locale, page class and metadata — not a copy of the page."
              className="border-0"
            />
          ) : (
            <DataTable
              label="Website pages"
              rows={pages}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "url",
                  header: "URL",
                  mobile: "primary",
                  render: (row) => (
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-ink underline-offset-2 hover:underline"
                    >
                      {row.path}
                    </a>
                  ),
                },
                {
                  key: "locale",
                  header: "Locale",
                  mobile: "secondary",
                  render: (row) => row.locale ?? "—",
                },
                {
                  key: "class",
                  header: "Class",
                  mobile: "secondary",
                  render: (row) => (
                    <Chip tone="neutral">{row.page_class}</Chip>
                  ),
                },
                {
                  key: "service",
                  header: "Service",
                  mobile: "hidden",
                  render: (row) => row.service_line ?? "—",
                },
                {
                  key: "status",
                  header: "Status",
                  numeric: true,
                  mobile: "secondary",
                  render: (row) =>
                    row.status_code === null ? "—" : String(row.status_code),
                },
              ]}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
