import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { getTodayInTimezone } from "@/domain/timezone";
import { addDays } from "@/domain/dates";
import { resolveRangeFromParams } from "@/lib/range-params";
import { getAccountIds } from "@/lib/repositories/metrics";
import { formatCount, formatRatio } from "@/domain/metrics";
import { formatMessage, intlLocale } from "@/lib/i18n";
import { getLocale, getTranslator } from "@/lib/i18n-server";
import { ErrorState } from "@/components/ui/states";
import { sumSeries } from "@/domain/kpi";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("pages.social.title") };
}

/**
 * Social accounts and content performance.
 *
 * Organic profile analytics and paid social campaigns are different surfaces
 * with different permissions, and are shown as separate categories.
 */
export default async function SocialPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const guard = await requirePermission(session, "social.read");
  if (!guard.allowed) return guard.response;

  const supabase = await createClient();
  const params = await searchParams;
  const today = getTodayInTimezone(session.workspaceTimezone);
  const { current } = resolveRangeFromParams(params, today);
  const locale = intlLocale(await getLocale());
  const t = await getTranslator();

  // A failed query is **not** an empty result. "There are no connected
  // accounts" and "we could not read the connected accounts" are different
  // facts, and the screen must not confuse them.
  let accounts: Awaited<ReturnType<typeof getAccountIds>> = [];
  let accountsFailure: string | null = null;

  try {
    accounts = await getAccountIds(supabase, session.workspaceId!);
  } catch (error) {
    accountsFailure =
      error instanceof Error
        ? error.message
        : t("pages.social.accountsReadError");
  }

  const socialAccounts = accounts.filter((account) =>
    ["meta", "instagram", "linkedin", "youtube"].includes(account.providerKey),
  );

  const {
    data: metricRows,
    error: metricsError,
  } = await supabase
    .from("social_account_metrics")
    .select(
      "workspace_id, account_id, metric_date, organic, followers, reach, impressions, engagements, clicks, video_views, content_count, source_fetched_at",
    )
    .eq("workspace_id", session.workspaceId!)
    .gte("metric_date", current.start)
    .lte("metric_date", current.end);

  const rows = (metricRows ?? []) as Array<{
    account_id: string;
    metric_date: string;
    organic: boolean;
    followers: number | null;
    reach: number | null;
    impressions: number | null;
    engagements: number | null;
    clicks: number | null;
    video_views: number | null;
    content_count: number | null;
    source_fetched_at: string;
  }>;

  // The posts are scoped to the same window as the KPIs above them, so a
  // card and the figures beside it never describe different periods.
  const { data: postRows, error: postsError } = await supabase
    .from("social_post_metrics")
    .select(
      "id, account_id, platform, post_id, posted_at, format, link, reach, impressions, engagements, clicks, video_views",
    )
    .eq("workspace_id", session.workspaceId!)
    .gte("posted_at", current.start)
    .lt("posted_at", addDays(current.end, 1))
    .order("posted_at", { ascending: false })
    .limit(50);

  const aggregate = (field: "reach" | "impressions" | "engagements" | "followers") =>
    sumSeries(
      rows.map((row) => ({
        value: row[field],
        source: "provider" as const,
        grain: "day" as const,
        fetchedAt: row.source_fetched_at,
      })),
    );

  const reach = aggregate("reach");
  const engagements = aggregate("engagements");

  // The engagements tile carries the engagement rate instead of the usual
  // coverage line, so each tile states its own detail.
  const coverageDetail =
    rows.length > 0
      ? t("pages.social.acrossConnectedAccounts")
      : t("pages.social.noSocialDataYet");

  const tiles = [
    { label: t("pages.social.reach"), value: reach.value, detail: coverageDetail },
    {
      label: t("pages.social.impressions"),
      value: aggregate("impressions").value,
      detail: coverageDetail,
    },
    {
      label: t("pages.social.engagements"),
      value: engagements.value,
      detail: formatMessage(t("pages.social.engagementRateOfReach"), {
        rate: formatRatio(engagements.value, reach.value, locale),
      }),
    },
    {
      label: t("pages.social.followers"),
      value: aggregate("followers").value,
      detail: coverageDetail,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.social.title")}
        subtitle={t("pages.social.subtitle")}
      />

      <Notice tone="info" title={t("pages.social.organicPaidNoticeTitle")}>
        {t("pages.social.organicPaidNoticeBody")}
      </Notice>

      <Card>
        <CardHeader
          title={t("pages.social.connectedAccountsTitle")}
          subtitle={t("pages.social.connectedAccountsSubtitle")}
        />
        <CardBody className="p-0">
          {accountsFailure ? (
            <ErrorState
              detail={accountsFailure}
              className="border-0"
            />
          ) : (
            <DataTable
              label={t("pages.social.accountsTableLabel")}
              rows={socialAccounts}
              empty={
                <EmptyState
                  title={t("pages.social.noAccountsTitle")}
                  description={t("pages.social.noAccountsDescription")}
                  icon={<Users className="size-5" />}
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
                    <span className="font-semibold text-tertiary">{row.label}</span>
                  ),
                },
                {
                  key: "provider",
                  header: t("common.provider"),
                  mobile: "secondary",
                  render: (row) => (
                    <Chip tone="teal">{row.providerKey}</Chip>
                  ),
                },
              ]}
            />
          )}
        </CardBody>
      </Card>

      {metricsError ? (
        <ErrorState
          detail={formatMessage(t("pages.social.metricsReadError"), {
            message: metricsError.message,
          })}
          className="border-0"
        />
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((card) => (
          <Card key={card.label} className="p-4">
            <h3 className="text-label-md font-semibold text-secondary">
              {card.label}
            </h3>
            <p className="mt-1 text-headline-md font-bold text-tertiary">
              {card.value === null
                ? "—"
                : new Intl.NumberFormat(locale, { notation: "compact" }).format(
                    card.value,
                  )}
            </p>
            <p className="mt-1 text-body-sm text-muted-text">{card.detail}</p>
          </Card>
        ))}
      </div>
      )}

      <Card>
        <CardHeader
          title={t("pages.social.contentPerformanceTitle")}
          subtitle={t("pages.social.contentPerformanceSubtitle")}
        />
        <CardBody className="p-0">
          {postsError ? (
            <ErrorState
              detail={formatMessage(t("pages.social.postsReadError"), {
                message: postsError.message,
              })}
              className="border-0"
            />
          ) : (
            <DataTable
              label={t("pages.social.postsTableLabel")}
              rows={postRows ?? []}
              empty={
                <EmptyState
                  title={t("pages.social.noPostMetricsTitle")}
                  description={t("pages.social.noPostMetricsDescription")}
                  className="border-0"
                />
              }
              rowKey={(row) => (row as { id: string }).id}
              columns={[
                {
                  key: "platform",
                  header: t("pages.social.platformColumn"),
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">
                      {(row as { platform: string }).platform}
                    </span>
                  ),
                },
                {
                  key: "format",
                  header: t("pages.social.formatColumn"),
                  mobile: "secondary",
                  render: (row) =>
                    (row as { format: string | null }).format ?? "—",
                },
                {
                  key: "posted",
                  header: t("pages.social.postedColumn"),
                  mobile: "secondary",
                  render: (row) => {
                    const postedAt = (row as { posted_at: string | null })
                      .posted_at;
                    return postedAt
                      ? new Date(postedAt).toLocaleDateString(locale)
                      : "—";
                  },
                },
                {
                  key: "reach",
                  header: t("pages.social.reach"),
                  numeric: true,
                  mobile: "secondary",
                  render: (row) =>
                    formatCount((row as { reach: number | null }).reach, locale),
                },
                {
                  key: "engagements",
                  header: t("pages.social.engagements"),
                  numeric: true,
                  mobile: "secondary",
                  render: (row) =>
                    formatCount(
                      (row as { engagements: number | null }).engagements,
                      locale,
                    ),
                },
                {
                  key: "link",
                  header: t("pages.social.linkColumn"),
                  mobile: "secondary",
                  render: (row) => {
                    const link = (row as { link: string | null }).link;
                    return link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-ink underline-offset-2 hover:underline"
                      >
                        {t("common.open")}
                      </a>
                    ) : (
                      "—"
                    );
                  },
                },
              ]}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
