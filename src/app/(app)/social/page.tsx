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
import { resolveRangeFromParams } from "@/lib/range-params";
import { getAccountIds } from "@/lib/repositories/metrics";
import { formatCount, formatRatio } from "@/domain/metrics";
import { getLocale } from "@/lib/i18n-server";
import { intlLocale } from "@/lib/i18n";
import { ErrorState } from "@/components/ui/states";
import { sumSeries } from "@/domain/kpi";

export const metadata: Metadata = { title: "Social Media" };
export const dynamic = "force-dynamic";

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
        : "The connected accounts could not be read.";
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

  const { data: postRows, error: postsError } = await supabase
    .from("social_post_metrics")
    .select(
      "id, account_id, platform, post_id, posted_at, format, link, reach, impressions, engagements, clicks, video_views",
    )
    .eq("workspace_id", session.workspaceId!)
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social Media"
        subtitle="Accounts, content performance and publishing."
      />

      <Notice tone="info" title="Organic and paid are separate">
        Organic profile analytics and paid social campaign results come from
        different surfaces with different permissions. They are shown as
        separate categories and are never combined into a single number.
      </Notice>

      <Card>
        <CardHeader
          title="Connected accounts"
          subtitle="Identities, permissions and data freshness"
        />
        <CardBody className="p-0">
          {accountsFailure ? (
            <ErrorState
              detail={accountsFailure}
              className="border-0"
            />
          ) : socialAccounts.length === 0 ? (
            <EmptyState
              title="No social accounts connected"
              description="Connect Instagram, Meta, LinkedIn or YouTube. Medical Bay's public site links Instagram (medicalbay.maroc), Facebook, LinkedIn (medical-bay-agadir) and TikTok."
              icon={<Users className="size-5" />}
              className="border-0"
            />
          ) : (
            <DataTable
              label="Social accounts"
              rows={socialAccounts}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "label",
                  header: "Account",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">{row.label}</span>
                  ),
                },
                {
                  key: "provider",
                  header: "Provider",
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
          detail={`Could not read social account metrics: ${metricsError.message}`}
          className="border-0"
        />
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Reach", value: reach.value },
          { label: "Impressions", value: aggregate("impressions").value },
          { label: "Engagements", value: engagements.value },
          { label: "Followers", value: aggregate("followers").value },
        ].map((card) => (
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
            <p className="mt-1 text-body-sm text-muted-text">
              {card.label === "Engagements"
                ? `Engagement rate ${formatRatio(
                    engagements.value,
                    reach.value,
                    locale,
                  )} of reach`
                : rows.length > 0
                  ? "Across the connected accounts"
                  : "No social data synced yet"}
            </p>
          </Card>
        ))}
      </div>
      )}

      <Card>
        <CardHeader
          title="Content performance"
          subtitle="Top and declining posts"
        />
        <CardBody className="p-0">
          {postsError ? (
            <ErrorState
              detail={`Could not read social post metrics: ${postsError.message}`}
              className="border-0"
            />
          ) : (postRows ?? []).length === 0 ? (
            <EmptyState
              title="No post metrics"
              description="Post-level performance appears once a social account reports."
              className="border-0"
            />
          ) : (
            <DataTable
              label="Social posts"
              rows={postRows ?? []}
              rowKey={(row) => (row as { id: string }).id}
              columns={[
                {
                  key: "platform",
                  header: "Platform",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">
                      {(row as { platform: string }).platform}
                    </span>
                  ),
                },
                {
                  key: "format",
                  header: "Format",
                  mobile: "secondary",
                  render: (row) =>
                    (row as { format: string | null }).format ?? "—",
                },
                {
                  key: "reach",
                  header: "Reach",
                  numeric: true,
                  mobile: "secondary",
                  render: (row) =>
                    formatCount((row as { reach: number | null }).reach, locale),
                },
                {
                  key: "engagements",
                  header: "Engagements",
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
                  header: "Link",
                  mobile: "hidden",
                  render: (row) => {
                    const link = (row as { link: string | null }).link;
                    return link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-ink underline-offset-2 hover:underline"
                      >
                        Open
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
