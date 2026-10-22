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
import { coverageOf, computeCpa, computeCtr, computeRoas, describeChange, sumSeries, } from "@/domain/kpi";
import { formatMoney, formatPercent, microsToAmount } from "@/domain/currency";
import { formatAge } from "@/domain/freshness";
import { addNullable, formatCount } from "@/domain/metrics";
import { getLocale, getTranslator } from "@/lib/i18n-server";
import { intlLocale } from "@/lib/i18n";
import { ErrorState } from "@/components/ui/states";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("nav.googleAds") };
}

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
  const t = await getTranslator();
  const locale = intlLocale(await getLocale());

  // A failed query is **not** an empty result. The difference is the whole
  // point: "there was no spend" and "we could not read the spend" are
  // different facts, and the screen must not confuse them.
  let rows: Awaited<ReturnType<typeof getAdsMetrics>> = [];
  let previousRows: Awaited<ReturnType<typeof getAdsMetrics>> = [];
  let failure: string | null = null;

  try {
    rows = await getAdsMetrics(supabase, workspaceId, current.start, current.end);
  } catch (error) {
    failure =
      error instanceof Error
        ? error.message
        : t("pages.googleAds.metricsError");
  }

  if (!failure) {
    try {
      previousRows = await getAdsMetrics(
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
  //
  // A campaign's total is **unknown** when any of its days is unknown. A
  // provider that did not report impressions on one day leaves a hole; the
  // total of the other days is not the total of the campaign.
  const campaigns = new Map<
    string,
    {
      id: string;
      label: string;
      impressions: number | null;
      clicks: number | null;
      cost: number | null;
      conversions: number | null;
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
    entry.impressions = addNullable(entry.impressions, row.impressions);
    entry.clicks = addNullable(entry.clicks, row.clicks);
    entry.cost = addNullable(entry.cost, row.cost_micros);
    entry.conversions = addNullable(entry.conversions, row.conversions);
    campaigns.set(row.dimension_id, entry);
  }

  const fetchedAt = latestFetchedAt(rows);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.googleAds.title")}
        subtitle={t("pages.googleAds.subtitle")}
      />

      <Notice tone="warning" title={t("pages.googleAds.readOnlyTitle")}>
        {t("pages.googleAds.readOnlyBody")}
      </Notice>

      {failure ? (
        <ErrorState
          detail={failure}
          className="border-0"
        />
      ) : (
        <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label={t("pages.googleAds.spend")}
           coverage={coverageOf(spend)}
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
          label={t("pages.googleAds.impressions")}
           coverage={coverageOf(impressions)}
          value={
            impressions.value === null
              ? "—"
              : new Intl.NumberFormat(locale, { notation: "compact" }).format(
                  impressions.value,
                )
          }
        />
        <KpiCard
          label={t("pages.googleAds.clicks")}
           coverage={coverageOf(clicks)}
          value={
            clicks.value === null
              ? "—"
              : new Intl.NumberFormat(locale, { notation: "compact" }).format(
                  clicks.value,
                )
          }
        />
        <KpiCard
          label={t("pages.googleAds.conversions")}
           coverage={coverageOf(conversions)}
          value={
            conversions.value === null
              ? "—"
              : new Intl.NumberFormat(locale).format(conversions.value)
          }
          change={describeChange(conversions.value, previousConversions.value)}
        />
        <KpiCard
          label={t("pages.googleAds.roas")}
           coverage={coverageOf(spend)}
          value={roas?.value === null || roas === null ? "—" : `${roas.value.toFixed(2)}x`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t("pages.googleAds.ctr")}
           coverage={coverageOf(clicks)}
          value={formatPercent(
            computeCtr(
              { value: clicks.value, source: "provider", grain: "day", fetchedAt: null },
              { value: impressions.value, source: "provider", grain: "day", fetchedAt: null },
            )?.value ?? null,
          )}
        />
        <KpiCard
          label={t("pages.googleAds.avgCpc")}
           coverage={coverageOf(clicks)}
          value={formatMoney(
            clicks.value === null || clicks.value === 0 || spendMoney === null
              ? null
              : { amount: spendMoney.amount / clicks.value, currency },
          )}
        />
        <KpiCard
          label={t("pages.googleAds.cpa")}
           coverage={coverageOf(conversions)}
          value={formatMoney(
            cpa ? { amount: cpa.value ?? 0, currency } : null,
          )}
        />
        <KpiCard
          label={t("pages.googleAds.convValue")}
           coverage={coverageOf(conversionValue)}
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
          title={t("pages.googleAds.campaigns")}
          subtitle={t("pages.googleAds.campaignsSubtitle")}
        />
        <CardBody className="p-0">
            <DataTable
              label={t("pages.googleAds.campaigns")}
              rows={[...campaigns.values()]}
              empty={
                <EmptyState
                  title={t("pages.googleAds.noCampaignsTitle")}
                  description={t("pages.googleAds.noCampaignsBody")}
                  icon={<BadgeDollarSign className="size-5" />}
                  className="border-0"
                />
              }
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "name",
                  header: t("common.campaign"),
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">{row.label}</span>
                  ),
                },
                {
                  key: "impressions",
                  header: t("pages.googleAds.impressions"),
                  numeric: true,
                  mobile: "secondary",
                  render: (row) => formatCount(row.impressions, locale),
                },
                {
                  key: "clicks",
                  header: t("pages.googleAds.clicks"),
                  numeric: true,
                  mobile: "secondary",
                  render: (row) => formatCount(row.clicks, locale),
                },
                {
                  key: "spend",
                  header: t("pages.googleAds.spend"),
                  numeric: true,
                  mobile: "secondary",
                  render: (row) =>
                    row.cost === null
                      ? "—"
                      : formatMoney({
                          amount: microsToAmount(row.cost, currency),
                          currency,
                        }),
                },
                {
                  key: "conversions",
                  header: t("pages.googleAds.conversions"),
                  numeric: true,
                  mobile: "secondary",
                  render: (row) => formatCount(row.conversions, locale),
                },
                {
                  key: "cpa",
                  header: t("pages.googleAds.cpa"),
                  numeric: true,
                  mobile: "secondary",
                  render: (row) =>
                    row.conversions === null || row.cost === null || row.conversions === 0
                      ? "—"
                      : formatMoney({
                          amount: microsToAmount(row.cost, currency) / row.conversions,
                          currency,
                        }),
                },
              ]}
            />
        </CardBody>
      </Card>
        </>
      )}
    </div>
  );
}
