import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plug } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable } from "@/components/ui/table";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/states";
import { ChannelTrendChart } from "@/components/charts/channel-trend-chart";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { getTodayInTimezone } from "@/domain/timezone";
import { resolveRangeFromParams } from "@/lib/range-params";
import {
  getAdsMetrics,
  getGa4Metrics,
  getGscMetrics,
  latestFetchedAt,
} from "@/lib/repositories/metrics";
import {
  computeCpa,
  computeCtr,
  computeRoas,
  describeChange,
  sumSeries,
  weightedAveragePosition,
} from "@/domain/kpi";
import { formatMoney, formatPercent, microsToAmount } from "@/domain/currency";
import { eachDay } from "@/domain/dates";
import { SYNC_INTERVALS, computeFreshness, formatAge } from "@/domain/freshness";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

/**
 * The Executive Command Center.
 *
 * Every number on this page is either reported by a provider or derived by
 * CCM from reported values, and says which. A metric with no data renders as
 * unavailable — never as zero.
 */
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const guard = await requirePermission(session, "overview.read");
  if (!guard.allowed) return guard.response;

  const supabase = await createClient();
  const params = await searchParams;
  const today = getTodayInTimezone(session.workspaceTimezone);
  const { current, previous } = resolveRangeFromParams(params, today);
  const workspaceId = session.workspaceId!;

  const [adsRows, ga4Rows, gscRows] = await Promise.all([
    getAdsMetrics(supabase, workspaceId, current.start, current.end).catch(
      () => [],
    ),
    getGa4Metrics(supabase, workspaceId, current.start, current.end).catch(
      () => [],
    ),
    getGscMetrics(supabase, workspaceId, current.start, current.end).catch(
      () => [],
    ),
  ]);

  const previousAds = await getAdsMetrics(
    supabase,
    workspaceId,
    previous.start,
    previous.end,
  ).catch(() => []);
  const previousGa4 = await getGa4Metrics(
    supabase,
    workspaceId,
    previous.start,
    previous.end,
  ).catch(() => []);
  const previousGsc = await getGscMetrics(
    supabase,
    workspaceId,
    previous.start,
    previous.end,
  ).catch(() => []);

  const hasData =
    adsRows.length > 0 || ga4Rows.length > 0 || gscRows.length > 0;

  // --- Ads totals ------------------------------------------------------------
  const adsTotals = sumSeries(
    adsRows.map((row) => ({
      value: row.cost_micros === null ? null : microsToAmount(row.cost_micros, "MAD"),
      source: "provider" as const,
      grain: "day" as const,
      fetchedAt: row.source_fetched_at,
    })),
  );
  const previousAdsTotals = sumSeries(
    previousAds.map((row) => ({
      value: row.cost_micros === null ? null : microsToAmount(row.cost_micros, "MAD"),
      source: "provider" as const,
      grain: "day" as const,
      fetchedAt: row.source_fetched_at,
    })),
  );
  const adsConversions = sumSeries(
    adsRows.map((row) => ({
      value: row.conversions,
      source: "provider" as const,
      grain: "day" as const,
      fetchedAt: row.source_fetched_at,
    })),
  );
  const previousAdsConversions = sumSeries(
    previousAds.map((row) => ({
      value: row.conversions,
      source: "provider" as const,
      grain: "day" as const,
      fetchedAt: row.source_fetched_at,
    })),
  );
  const adsImpressions = sumSeries(
    adsRows.map((row) => ({
      value: row.impressions,
      source: "provider" as const,
      grain: "day" as const,
      fetchedAt: row.source_fetched_at,
    })),
  );
  const adsClicks = sumSeries(
    adsRows.map((row) => ({
      value: row.clicks,
      source: "provider" as const,
      grain: "day" as const,
      fetchedAt: row.source_fetched_at,
    })),
  );

  const spendMoney = adsTotals.value === null
    ? null
    : { amount: adsTotals.value, currency: "MAD" };

  const cpa = computeCpa(spendMoney, adsConversions.value === null ? null : {
    value: adsConversions.value,
    source: "derived",
    grain: "day",
    fetchedAt: null,
  });

  const conversionValue = sumSeries(
    adsRows.map((row) => ({
      value:
        row.conversion_value_micros === null
          ? null
          : microsToAmount(row.conversion_value_micros, "MAD"),
      source: "provider" as const,
      grain: "day" as const,
      fetchedAt: row.source_fetched_at,
    })),
  );
  const roas = computeRoas(
    spendMoney,
    conversionValue.value === null
      ? null
      : { amount: conversionValue.value, currency: "MAD" },
  );

  // --- GA4 -------------------------------------------------------------------
  const ga4Sessions = sumSeries(
    ga4Rows.map((row) => ({
      value: row.sessions,
      source: "provider" as const,
      grain: "day" as const,
      fetchedAt: row.source_fetched_at,
    })),
  );
  const previousGa4Sessions = sumSeries(
    previousGa4.map((row) => ({
      value: row.sessions,
      source: "provider" as const,
      grain: "day" as const,
      fetchedAt: row.source_fetched_at,
    })),
  );
  const ga4KeyEvents = sumSeries(
    ga4Rows.map((row) => ({
      value: row.key_events,
      source: "provider" as const,
      grain: "day" as const,
      fetchedAt: row.source_fetched_at,
    })),
  );

  // --- Search Console --------------------------------------------------------
  const gscClicks = sumSeries(
    gscRows.map((row) => ({
      value: row.clicks,
      source: "provider" as const,
      grain: "day" as const,
      fetchedAt: row.source_fetched_at,
    })),
  );
  const previousGscClicks = sumSeries(
    previousGsc.map((row) => ({
      value: row.clicks,
      source: "provider" as const,
      grain: "day" as const,
      fetchedAt: row.source_fetched_at,
    })),
  );
  const gscPosition = weightedAveragePosition(
    gscRows.map((row) => ({
      position: row.position,
      impressions: row.impressions,
    })),
  );

  // --- Trend series ----------------------------------------------------------
  const days = eachDay(current.start, current.end);
  const series = [
    {
      key: "organic",
      label: "Organic search",
      color: "#4bbdbd",
      points: days.map((day) => ({
        day,
        value: sumSeries(
          gscRows
            .filter((row) => row.metric_date === day)
            .map((row) => ({
              value: row.clicks,
              source: "provider" as const,
              grain: "day" as const,
              fetchedAt: row.source_fetched_at,
            })),
        ).value,
      })),
    },
    {
      key: "paid",
      label: "Paid search",
      color: "#6ccaca",
      points: days.map((day) => ({
        day,
        value: sumSeries(
          adsRows
            .filter((row) => row.metric_date === day)
            .map((row) => ({
              value: row.clicks,
              source: "provider" as const,
              grain: "day" as const,
              fetchedAt: row.source_fetched_at,
            })),
        ).value,
      })),
    },
    {
      key: "sessions",
      label: "Sessions",
      color: "#8ad6d6",
      points: days.map((day) => ({
        day,
        value: sumSeries(
          ga4Rows
            .filter((row) => row.metric_date === day)
            .map((row) => ({
              value: row.sessions,
              source: "provider" as const,
              grain: "day" as const,
              fetchedAt: row.source_fetched_at,
            })),
        ).value,
      })),
    },
  ];

  // --- Connections -----------------------------------------------------------
  const { data: connections } = await supabase
    .from("provider_connections")
    .select("id, provider_key, display_label, status, last_success_at, last_attempt_at")
    .eq("workspace_id", workspaceId)
    .order("provider_key", { ascending: true });

  const now = new Date();
  const connectionRows = (connections ?? []).map((connection) => {
    const interval =
      SYNC_INTERVALS[
        connection.provider_key as keyof typeof SYNC_INTERVALS
      ] ?? 6 * 3600;
    const freshness = computeFreshness({
      lastSuccessAt: connection.last_success_at,
      lastAttemptAt: connection.last_attempt_at,
      lastAttemptFailed: connection.status !== "connected",
      targetIntervalSeconds: interval,
      now,
    });
    return { connection, freshness };
  });

  const campaignRows = adsRows
    .filter((row) => row.dimension === "campaign")
    .reduce<Map<string, (typeof adsRows)[number]>>((map, row) => {
      const existing = map.get(row.dimension_id);
      if (!existing) {
        map.set(row.dimension_id, row);
      } else {
        map.set(row.dimension_id, {
          ...existing,
          impressions: (existing.impressions ?? 0) + (row.impressions ?? 0),
          clicks: (existing.clicks ?? 0) + (row.clicks ?? 0),
          cost_micros: (existing.cost_micros ?? 0) + (row.cost_micros ?? 0),
          conversions: (existing.conversions ?? 0) + (row.conversions ?? 0),
        });
      }
      return map;
    }, new Map());

  const topCampaigns = [...campaignRows.values()]
    .sort((a, b) => (b.cost_micros ?? 0) - (a.cost_micros ?? 0))
    .slice(0, 5);

  const adsFetchedAt = latestFetchedAt(adsRows);
  const ga4FetchedAt = latestFetchedAt(ga4Rows);
  const gscFetchedAt = latestFetchedAt(gscRows);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Welcome to CCM"
        subtitle="Your central hub for marketing, growth and digital operations."
        actions={
          <Link
            href="/integrations"
            className="inline-flex h-[47px] items-center justify-center gap-2 rounded-md bg-primary px-[25px] text-button-text font-semibold text-white transition-colors hover:bg-primary-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Plug aria-hidden="true" className="size-4" />
            Connect a source
          </Link>
        }
      />

      {!hasData ? (
        <Notice tone="info" title="No live data yet">
          CCM is connected to your workspace but no provider has reported yet.
          The figures below stay empty until a source syncs — CCM does not
          substitute zeros for missing data. Connect a provider from{" "}
          <Link href="/integrations" className="font-semibold underline">
            Integrations
          </Link>
          .
        </Notice>
      ) : null}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          label="Ad spend"
          value={formatMoney(spendMoney)}
          change={describeChange(adsTotals.value, previousAdsTotals.value)}
          source={adsFetchedAt ? { label: "Google Ads", fetchedAt: adsFetchedAt, ageLabel: formatAge((now.getTime() - Date.parse(adsFetchedAt)) / 1000) } : null}
        />
        <KpiCard
          label="Conversions"
          value={
            adsConversions.value === null
              ? "—"
              : new Intl.NumberFormat("en-GB").format(adsConversions.value)
          }
          change={describeChange(
            adsConversions.value,
            previousAdsConversions.value,
          )}
          source={adsFetchedAt ? { label: "Google Ads", fetchedAt: adsFetchedAt, ageLabel: formatAge((now.getTime() - Date.parse(adsFetchedAt)) / 1000) } : null}
        />
        <KpiCard
          label="Organic clicks"
          value={
            gscClicks.value === null
              ? "—"
              : new Intl.NumberFormat("en-GB", { notation: "compact" }).format(
                  gscClicks.value,
                )
          }
          change={describeChange(gscClicks.value, previousGscClicks.value)}
          source={
            gscFetchedAt
              ? {
                  label: "Search Console",
                  fetchedAt: gscFetchedAt,
                  ageLabel: formatAge(
                    (now.getTime() - Date.parse(gscFetchedAt)) / 1000,
                  ),
                }
              : null
          }
        />
        <KpiCard
          label="GA4 sessions"
          value={
            ga4Sessions.value === null
              ? "—"
              : new Intl.NumberFormat("en-GB", { notation: "compact" }).format(
                  ga4Sessions.value,
                )
          }
          change={describeChange(ga4Sessions.value, previousGa4Sessions.value)}
          source={ga4FetchedAt ? { label: "GA4", fetchedAt: ga4FetchedAt, ageLabel: formatAge((now.getTime() - Date.parse(ga4FetchedAt)) / 1000) } : null}
        />
        <KpiCard
          label="GA4 key events"
          value={
            ga4KeyEvents.value === null
              ? "—"
              : new Intl.NumberFormat("en-GB").format(ga4KeyEvents.value)
          }
          source={ga4FetchedAt ? { label: "GA4", fetchedAt: ga4FetchedAt, ageLabel: formatAge((now.getTime() - Date.parse(ga4FetchedAt)) / 1000) } : null}
        />
        <KpiCard
          label="Cost per conversion"
          value={formatMoney(
            cpa ? { amount: cpa.value ?? 0, currency: "MAD" } : null,
          )}
          source={adsFetchedAt ? { label: "Google Ads", fetchedAt: adsFetchedAt, ageLabel: formatAge((now.getTime() - Date.parse(adsFetchedAt)) / 1000) } : null}
        />
      </div>

      {/* Trends + campaigns */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Channel trends"
            subtitle="Performance across all channels"
          />
          <CardBody>
            {hasData ? (
              <ChannelTrendChart series={series} valueLabel="Clicks" />
            ) : (
              <EmptyState
                title="No trend data yet"
                description="The chart fills in as soon as the first sync lands."
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Top campaigns"
            subtitle="By spend in the selected period"
            actions={
              <Link
                href="/google-ads"
                className="inline-flex items-center gap-1 text-label-md font-semibold text-primary-ink hover:underline"
              >
                View all
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            }
          />
          <CardBody className="p-0">
            {topCampaigns.length === 0 ? (
              <EmptyState
                title="No campaigns"
                description="Connect Google Ads to see campaign performance."
                className="border-0"
              />
            ) : (
              <DataTable
                label="Top campaigns"
                rows={topCampaigns}
                rowKey={(row) => row.dimension_id}
                columns={[
                  {
                    key: "name",
                    header: "Campaign",
                    mobile: "primary",
                    render: (row) => (
                      <span className="font-semibold text-tertiary">
                        {row.dimension_label ?? row.dimension_id}
                      </span>
                    ),
                  },
                  {
                    key: "spend",
                    header: "Spend",
                    numeric: true,
                    mobile: "secondary",
                    render: (row) =>
                      row.cost_micros === null
                        ? "—"
                        : formatMoney({
                            amount: microsToAmount(row.cost_micros, "MAD"),
                            currency: "MAD",
                          }),
                  },
                  {
                    key: "conversions",
                    header: "Conversions",
                    numeric: true,
                    mobile: "secondary",
                    render: (row) =>
                      row.conversions === null
                        ? "—"
                        : new Intl.NumberFormat("en-GB").format(row.conversions),
                  },
                ]}
              />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Secondary metrics */}
      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard>
          <h3 className="text-label-md font-semibold text-secondary">CTR</h3>
          <p className="mt-1 text-headline-md font-bold text-tertiary">
            {formatPercent(
              computeCtr(
                { value: adsClicks.value, source: "provider", grain: "day", fetchedAt: null },
                { value: adsImpressions.value, source: "provider", grain: "day", fetchedAt: null },
              )?.value ?? null,
            )}
          </p>
          <p className="mt-1 text-body-sm text-muted-text">Google Ads</p>
        </StatCard>

        <StatCard>
          <h3 className="text-label-md font-semibold text-secondary">ROAS</h3>
          <p className="mt-1 text-headline-md font-bold text-tertiary">
            {roas?.value === null || roas === null
              ? "—"
              : `${roas.value.toFixed(2)}x`}
          </p>
          <p className="mt-1 text-body-sm text-muted-text">
            {conversionValue.value === null
              ? "No conversion value reported"
              : "Conversion value ÷ spend"}
          </p>
        </StatCard>

        <StatCard>
          <h3 className="text-label-md font-semibold text-secondary">
            Average position
          </h3>
          <p className="mt-1 text-headline-md font-bold text-tertiary">
            {gscPosition.value === null
              ? "—"
              : gscPosition.value.toFixed(1)}
          </p>
          <p className="mt-1 text-body-sm text-muted-text">
            Impression-weighted, Search Console
          </p>
        </StatCard>
      </div>

      {/* Connections */}
      <Card>
        <CardHeader
          title="Data freshness & connections"
          subtitle="Every source, its state and how old its data is"
          actions={
            <Link
              href="/integrations"
              className="inline-flex items-center gap-1 text-label-md font-semibold text-primary-ink hover:underline"
            >
              Manage
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          }
        />
        <CardBody className="p-0">
          {connectionRows.length === 0 ? (
            <EmptyState
              title="No providers connected"
              description="Connect Google Ads, GA4, Search Console, GTM or a mailbox to start reporting."
              icon={<Plug className="size-5" />}
              className="border-0"
              action={
                <Link href="/integrations">
                  <Button variant="primary" size="sm">
                    Go to integrations
                  </Button>
                </Link>
              }
            />
          ) : (
            <DataTable
              label="Connections"
              rows={connectionRows}
              rowKey={(row) => row.connection.id}
              columns={[
                {
                  key: "provider",
                  header: "Provider",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">
                      {row.connection.display_label}
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
                        row.freshness.state === "fresh"
                          ? "success"
                          : row.freshness.state === "failing"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {row.freshness.label}
                    </Chip>
                  ),
                },
                {
                  key: "lastSync",
                  header: "Last sync",
                  mobile: "secondary",
                  render: (row) =>
                    row.connection.last_success_at
                      ? formatAge(
                          (now.getTime() - Date.parse(row.connection.last_success_at)) /
                            1000,
                        )
                      : "—",
                },
              ]}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
