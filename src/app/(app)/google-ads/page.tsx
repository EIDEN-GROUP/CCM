import type { Metadata } from "next";
import { BadgeDollarSign } from "lucide-react";
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
import { getAdsMetrics, latestFetchedAt } from "@/lib/repositories/metrics";
import {
  computeCpa,
  computeCtr,
  computeRoas,
  describeChange,
  sumSeries,
} from "@/domain/kpi";
import { formatMoney, formatPercent, microsToAmount } from "@/domain/currency";
import { formatAge } from "@/domain/freshness";

export const metadata: Metadata = { title: "Google Ads" };
export const dynamic = "force-dynamic";

/**
 * Google Ads, read-only.
 *
 * The v1 release has no write path at all: no campaign edits, no budget
 * changes, no pauses. Every change would require a preview, an explicit
 * approval, an audit record and a reversible version reference, and none of
 * that exists yet, so the buttons are simply absent rather than disabled
 * after the fact.
 */
export default async function GoogleAdsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const guard = await requirePermission(session, "ads.read");
  if (!guard.allowed) return guard.response;

  const supabase = await createClient();
  const params = await searchParams;
  const today = getTodayInTimezone(session.workspaceTimezone);
  const { current, previous } = resolveRangeFromParams(params, today);
  const workspaceId = session.workspaceId!;

  const rows = await getAdsMetrics(
    supabase,
    workspaceId,
    current.start,
    current.end,
  ).catch(() => []);
  const previousRows = await getAdsMetrics(
    supabase,
    workspaceId,
    previous.start,
    previous.end,
  ).catch(() => []);

  const sum = (list: typeof rows, field: "cost_micros" | "clicks" | "impressions" | "conversions" | "conversion_value_micros") =>
    sumSeries(
      list.map((row) => ({
        value: row[field] === null ? null : Number(row[field]),
        source: "provider" as const,
        grain: "day" as const,
        fetchedAt: row.source_fetched_at,
      })),
    );

  const spend = sum(rows, "cost_micros");
  const previousSpend = sum(previousRows, "cost_micros");
  const clicks = sum(rows, "clicks");
  const impressions = sum(rows, "impressions");
  const conversions = sum(rows, "conversions");
  const previousConversions = sum(previousRows, "conversions");
  const conversionValue = sum(rows, "conversion_value_micros");

  const currency = rows.find((row) => row.currency)?.currency ?? "MAD";
  const spendMoney =
    spend.value === null ? null : { amount: microsToAmount(spend.value, currency), currency };
  const cpa = computeCpa(spendMoney, {
    value: conversions.value,
    source: "derived",
    grain: "day",
    fetchedAt: null,
  });
  const roas = computeRoas(
    spendMoney,
    conversionValue.value === null
      ? null
      : { amount: microsToAmount(conversionValue.value, currency), currency },
  );

  // Aggregate the daily facts into one row per campaign.
  const campaigns = new Map<
    string,
    {
      id: string;
      label: string;
      impressions: number;
      clicks: number;
      cost: number;
      conversions: number;
    }
  >();

  for (const row of rows) {
    if (row.dimension !== "campaign") continue;
    const entry = campaigns.get(row.dimension_id) ?? {
      id: row.dimension_id,
      label: row.dimension_label ?? row.dimension_id,
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
    };
    entry.impressions += row.impressions ?? 0;
    entry.clicks += row.clicks ?? 0;
    entry.cost += row.cost_micros ?? 0;
    entry.conversions += row.conversions ?? 0;
    campaigns.set(row.dimension_id, entry);
  }

  const fetchedAt = latestFetchedAt(rows);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Google Ads"
        subtitle="Spend, campaigns, conversions and pacing."
      />

      <Notice tone="warning" title="Read-only">
        Campaign edits, budget changes, pauses and bulk operations are disabled
        in this release. They require a preview, an explicit approval, an audit
        record and a reversible version reference before they can be offered.
      </Notice>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Spend"
          value={formatMoney(spendMoney)}
          change={describeChange(spend.value, previousSpend.value)}
          source={
            fetchedAt
              ? {
                  label: "Google Ads",
                  fetchedAt,
                  ageLabel: formatAge(
                    (new Date().getTime() - Date.parse(fetchedAt)) / 1000,
                  ),
                }
              : null
          }
        />
        <KpiCard
          label="Impressions"
          value={
            impressions.value === null
              ? "—"
              : new Intl.NumberFormat("en-GB", { notation: "compact" }).format(
                  impressions.value,
                )
          }
        />
        <KpiCard
          label="Clicks"
          value={
            clicks.value === null
              ? "—"
              : new Intl.NumberFormat("en-GB", { notation: "compact" }).format(
                  clicks.value,
                )
          }
        />
        <KpiCard
          label="Conversions"
          value={
            conversions.value === null
              ? "—"
              : new Intl.NumberFormat("en-GB").format(conversions.value)
          }
          change={describeChange(conversions.value, previousConversions.value)}
        />
        <KpiCard
          label="ROAS"
          value={roas?.value === null || roas === null ? "—" : `${roas.value.toFixed(2)}x`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="CTR"
          value={formatPercent(
            computeCtr(
              { value: clicks.value, source: "provider", grain: "day", fetchedAt: null },
              { value: impressions.value, source: "provider", grain: "day", fetchedAt: null },
            )?.value ?? null,
          )}
        />
        <KpiCard
          label="Avg. CPC"
          value={formatMoney(
            clicks.value === null || clicks.value === 0 || spendMoney === null
              ? null
              : { amount: spendMoney.amount / clicks.value, currency },
          )}
        />
        <KpiCard
          label="CPA"
          value={formatMoney(
            cpa ? { amount: cpa.value ?? 0, currency } : null,
          )}
        />
        <KpiCard
          label="Conversion value"
          value={formatMoney(
            conversionValue.value === null
              ? null
              : {
                  amount: microsToAmount(conversionValue.value, currency),
                  currency,
                },
          )}
        />
      </div>

      <Card>
        <CardHeader
          title="Campaigns"
          subtitle="Account performance for the selected period"
        />
        <CardBody className="p-0">
          {campaigns.size === 0 ? (
            <EmptyState
              title="No campaign data yet"
              description="Connect a Google Ads account. The Google Ads API access level is granted on the Google Cloud project — see Integrations for the setup steps."
              icon={<BadgeDollarSign className="size-5" />}
              className="border-0"
            />
          ) : (
            <DataTable
              label="Campaigns"
              rows={[...campaigns.values()]}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "name",
                  header: "Campaign",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">{row.label}</span>
                  ),
                },
                {
                  key: "impressions",
                  header: "Impressions",
                  numeric: true,
                  mobile: "secondary",
                  render: (row) =>
                    new Intl.NumberFormat("en-GB").format(row.impressions),
                },
                {
                  key: "clicks",
                  header: "Clicks",
                  numeric: true,
                  mobile: "secondary",
                  render: (row) =>
                    new Intl.NumberFormat("en-GB").format(row.clicks),
                },
                {
                  key: "spend",
                  header: "Spend",
                  numeric: true,
                  mobile: "secondary",
                  render: (row) =>
                    formatMoney({
                      amount: microsToAmount(row.cost, currency),
                      currency,
                    }),
                },
                {
                  key: "conversions",
                  header: "Conversions",
                  numeric: true,
                  mobile: "secondary",
                  render: (row) =>
                    new Intl.NumberFormat("en-GB").format(row.conversions),
                },
                {
                  key: "cpa",
                  header: "CPA",
                  numeric: true,
                  mobile: "hidden",
                  render: (row) =>
                    row.conversions === 0
                      ? "—"
                      : formatMoney({
                          amount: microsToAmount(row.cost, currency) / row.conversions,
                          currency,
                        }),
                },
              ]}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
