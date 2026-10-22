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
import { getTranslator } from "@/lib/i18n-server";
import { formatMessage } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("nav.websites") };
}

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
  const t = await getTranslator();
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
        title={t("pages.websites.title")}
        subtitle={t("pages.websites.subtitle")}
        actions={
          <RegisterWebsiteButton
            canManage={session.permissions.has("integrations.manage")}
          />
        }
      />

      <Notice tone="info" title={t("pages.websites.addingSiteTitle")}>
        {t("pages.websites.addingSiteBody")}
      </Notice>

      <Card>
        <CardHeader
          title={t("pages.websites.portfolio")}
          subtitle={
            websites.length === 1
              ? formatMessage(t("pages.websites.portfolioCountOne"), {
                  count: websites.length,
                })
              : formatMessage(t("pages.websites.portfolioCountMany"), {
                  count: websites.length,
                })
          }
        />
        <CardBody className="p-0">
          <DataTable
            label={t("pages.websites.title")}
            rows={websites}
            empty={
              <EmptyState
                title={t("pages.websites.noSitesTitle")}
                description={t("pages.websites.noSitesBody")}
                icon={<Globe className="size-5" />}
                className="border-0"
              />
            }
            rowKey={(row) => row.id}
            columns={[
              {
                key: "name",
                header: t("pages.websites.site"),
                mobile: "primary",
                render: (row) => (
                  <span className="font-semibold text-tertiary">{row.name}</span>
                ),
              },
              {
                key: "domain",
                header: t("pages.websites.domain"),
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
                header: t("pages.websites.hostnames"),
                mobile: "secondary",
                render: (row) => {
                  const list = hostnamesFor((row as { id: string }).id);
                  return list.length > 0 ? list.join(", ") : "—";
                },
              },
              {
                key: "locales",
                header: t("pages.websites.languages"),
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
                header: t("pages.websites.services"),
                mobile: "secondary",
                render: (row) =>
                  row.service_lines.length > 0
                    ? row.service_lines.join(", ")
                    : "—",
              },
              {
                key: "health",
                header: t("pages.websites.health"),
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
                header: t("pages.websites.lastCheck"),
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
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.websites.pagesLandingTitle")}
          subtitle={t("pages.websites.pagesLandingSubtitle")}
        />
        <CardBody className="p-0">
          <DataTable
            label={t("pages.websites.websitePages")}
            rows={pages}
            empty={
              <EmptyState
                title={t("pages.websites.noPagesTitle")}
                description={t("pages.websites.noPagesBody")}
                className="border-0"
              />
            }
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
                header: t("pages.websites.locale"),
                mobile: "secondary",
                render: (row) => row.locale ?? "—",
              },
              {
                key: "class",
                header: t("pages.websites.pageClass"),
                mobile: "secondary",
                render: (row) => (
                  <Chip tone="neutral">{row.page_class}</Chip>
                ),
              },
              {
                key: "service",
                header: t("pages.websites.service"),
                mobile: "secondary",
                render: (row) => row.service_line ?? "—",
              },
              {
                key: "status",
                header: t("common.status"),
                numeric: true,
                mobile: "secondary",
                render: (row) =>
                  row.status_code === null ? "—" : String(row.status_code),
              },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}
