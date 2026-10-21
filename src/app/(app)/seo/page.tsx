import type { Metadata } from "next";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { KpiCard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { getTodayInTimezone } from "@/domain/timezone";
import { resolveRangeFromParams } from "@/lib/range-params";
import { getGscMetrics, latestFetchedAt } from "@/lib/repositories/metrics";
import { coverageOf, describeChange, sumSeries, weightedAveragePosition } from "@/domain/kpi";
import { addNullable, formatCount, formatRatio } from "@/domain/metrics";
import { getLocale } from "@/lib/i18n-server";
import { intlLocale } from "@/lib/i18n";
import { ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "SEO & Rankings" };
export const dynamic = "force-dynamic";

/**
 * Search Console and rankings.
 *
 * Google-reported data and third-party rank observations are deliberately
 * kept apart: a provider-estimated position and a Search Console average
 * position are different measurements and are never averaged together.
 */
export default async function SeoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const guard = await requirePermission(session, "seo.read");
  if (!guard.allowed) return guard.response;

  const supabase = await createClient();
  const params = await searchParams;
  const today = getTodayInTimezone(session.workspaceTimezone);
  const { current, previous } = resolveRangeFromParams(params, today);
  const workspaceId = session.workspaceId!;
  const locale = intlLocale(await getLocale());

  // A failed query is **not** an empty result. The difference is the whole
  // point: "there was no search traffic" and "we could not read the search
  // traffic" are different facts, and the screen must not confuse them.
  let rows: Awaited<ReturnType<typeof getGscMetrics>> = [];
  let previousRows: Awaited<ReturnType<typeof getGscMetrics>> = [];
  let failure: string | null = null;

  try {
    rows = await getGscMetrics(
      supabase,
      workspaceId,
      current.start,
      current.end,
    );
  } catch (error) {
    failure =
      error instanceof Error
        ? error.message
        : "The Search Console metrics could not be read.";
  }

  if (!failure) {
    try {
      previousRows = await getGscMetrics(
        supabase,
        workspaceId,
        previous.start,
        previous.end,
      );
    } catch {
      // The comparison period is optional. Losing it means no trend, not a
      // broken screen.
      previousRows = [];
    }
  }

  const sum = (list: typeof rows, field: "clicks" | "impressions") =>
    sumSeries(
      list.map((row) => ({
        value: row[field],
        source: "provider" as const,
        grain: "day" as const,
        fetchedAt: row.source_fetched_at,
      })),
    );

  const clicks = sum(rows, "clicks");
  const previousClicks = sum(previousRows, "clicks");
  const impressions = sum(rows, "impressions");
  const previousImpressions = sum(previousRows, "impressions");
  const position = weightedAveragePosition(
    rows.map((row) => ({ position: row.position, impressions: row.impressions })),
  );
  const previousPosition = weightedAveragePosition(
    previousRows.map((row) => ({
      position: row.position,
      impressions: row.impressions,
    })),
  );

  const queries = new Map<
    string,
    {
      id: string;
      label: string;
      clicks: number | null;
      impressions: number | null;
      position: number | null;
      weighted: number;
    }
  >();
  for (const row of rows) {
    if (row.dimension !== "query") continue;
    const entry = queries.get(row.dimension_id) ?? {
      id: row.dimension_id,
      label: row.dimension_label ?? row.dimension_id,
      clicks: 0,
      impressions: 0,
      position: null,
      weighted: 0,
    };
    // A query's total is unknown as soon as one of its rows is unknown: the
    // other rows are not the whole of it.
    entry.clicks = addNullable(entry.clicks, row.clicks);
    entry.impressions = addNullable(entry.impressions, row.impressions);
    if (row.position !== null && row.impressions !== null && row.impressions > 0) {
      entry.weighted += row.position * row.impressions;
      entry.position = row.position;
    }
    queries.set(row.dimension_id, entry);
  }

  const topQueries = [...queries.values()]
    .map((query) => ({
      ...query,
      averagePosition:
        query.position === null ||
        query.impressions === null ||
        query.impressions === 0
          ? null
          : query.weighted / query.impressions,
    }))
    // An unknown click count sorts last. It is not "the smallest".
    .sort((a, b) => {
      if (a.clicks === null) return b.clicks === null ? 0 : 1;
      if (b.clicks === null) return -1;
      return b.clicks - a.clicks;
    })
    .slice(0, 15);

  const { data: rankRows, error: rankError } = await supabase
    .from("rank_snapshots")
    .select(
      "id, keyword, search_engine, country, city, device, landing_url, position, observed_on, source_provider",
    )
    .eq("workspace_id", workspaceId)
    .order("observed_on", { ascending: false })
    .limit(50);

  const fetchedAt = latestFetchedAt(rows);

  return (
    <div className="space-y-6">
      <PageHeader
        title="SEO & Rankings"
        subtitle="Search Console, technical checks and tracked rankings."
      />

      <Notice tone="info" title="Two different measurements">
        Search Console clicks, impressions and average position are reported by
        Google. Rank-tracking observations come from a third-party provider and
        are shown in their own table. CCM never blends them, because they
        measure different things.
      </Notice>

      {failure ? (
        <ErrorState
          detail={failure}
          className="border-0"
        />
      ) : (
        <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Organic clicks"
           coverage={coverageOf(clicks)}
          value={
            clicks.value === null
              ? "—"
              : new Intl.NumberFormat(locale, { notation: "compact" }).format(
                  clicks.value,
                )
          }
          change={describeChange(clicks.value, previousClicks.value)}
          source={fetchedAt ? { label: "Search Console", fetchedAt } : null}
        />
        <KpiCard
          label="Organic impressions"
           coverage={coverageOf(impressions)}
          value={
            impressions.value === null
              ? "—"
              : new Intl.NumberFormat(locale, { notation: "compact" }).format(
                  impressions.value,
                )
          }
          change={describeChange(impressions.value, previousImpressions.value)}
        />
        <KpiCard
          label="CTR"
           coverage={coverageOf(clicks)}
          value={formatRatio(clicks.value, impressions.value, locale)}
        />
        <KpiCard
          label="Average position"
           coverage={coverageOf(position)}
          value={position.value === null ? "—" : position.value.toFixed(1)}
          change={describeChange(position.value, previousPosition.value)}
        />
      </div>

      <Card>
        <CardHeader
          title="Top queries"
          subtitle="By clicks, from Search Console"
        />
        <CardBody className="p-0">
          {topQueries.length === 0 ? (
            <EmptyState
              title="No query data"
              description="Connect a verified Search Console property to see real query performance."
              icon={<Search className="size-5" />}
              className="border-0"
            />
          ) : (
            <DataTable
              label="Top queries"
              rows={topQueries}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "query",
                  header: "Query",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">{row.label}</span>
                  ),
                },
                {
                  key: "clicks",
                  header: "Clicks",
                  numeric: true,
                  mobile: "secondary",
                  render: (row) => formatCount(row.clicks, locale),
                },
                {
                  key: "impressions",
                  header: "Impressions",
                  numeric: true,
                  mobile: "secondary",
                  render: (row) => formatCount(row.impressions, locale),
                },
                {
                  key: "position",
                  header: "Position",
                  numeric: true,
                  mobile: "secondary",
                  render: (row) =>
                    row.averagePosition === null
                      ? "—"
                      : row.averagePosition.toFixed(1),
                },
              ]}
            />
          )}
        </CardBody>
      </Card>
        </>
      )}

      <Card>
        <CardHeader
          title="Tracked rankings"
          subtitle="Third-party observations, kept separate from Search Console"
        />
        <CardBody className="p-0">
          {rankError ? (
            <ErrorState
              detail={`Could not read rank snapshots: ${rankError.message}`}
              className="border-0"
            />
          ) : (rankRows ?? []).length === 0 ? (
            <EmptyState
              title="No rank snapshots"
              description="Rank observations appear once a rank-tracking provider is connected and a project is configured."
              className="border-0"
            />
          ) : (
            <DataTable
              label="Rank snapshots"
              rows={rankRows ?? []}
              rowKey={(row) => (row as { id: string }).id}
              columns={[
                {
                  key: "keyword",
                  header: "Keyword",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">
                      {(row as { keyword: string }).keyword}
                    </span>
                  ),
                },
                {
                  key: "country",
                  header: "Country",
                  mobile: "secondary",
                  render: (row) =>
                    (row as { country: string | null }).country ?? "—",
                },
                {
                  key: "device",
                  header: "Device",
                  mobile: "secondary",
                  render: (row) =>
                    (row as { device: string }).device,
                },
                {
                  key: "position",
                  header: "Position",
                  numeric: true,
                  mobile: "secondary",
                  render: (row) =>
                    (row as { position: number | null }).position ?? "—",
                },
                {
                  key: "observed",
                  header: "Observed",
                  mobile: "hidden",
                  render: (row) =>
                    (row as { observed_on: string }).observed_on,
                },
                {
                  key: "provider",
                  header: "Source",
                  mobile: "hidden",
                  render: (row) =>
                    (row as { source_provider: string }).source_provider,
                },
              ]}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
