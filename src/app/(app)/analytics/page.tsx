import type { Metadata } from "next";
import { ChartPie } from "lucide-react";
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
import { getGa4Metrics, latestFetchedAt } from "@/lib/repositories/metrics";
import { coverageOf, computeKeyEventRate, describeChange, sumSeries } from "@/domain/kpi";
import { formatPercent } from "@/domain/currency";
import { addNullable, formatCount } from "@/domain/metrics";
import { getLocale, getTranslator } from "@/lib/i18n-server";
import { intlLocale } from "@/lib/i18n";
import { ErrorState } from "@/components/ui/states";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("pages.analytics.title") };
}

/**
 * GA4 and attribution.
 *
 * GA4 key events and Google Ads conversions are shown side by side and never
 * merged: they use different attribution windows and different conversion
 * definitions, and a silent reconciliation would be worse than none.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const guard = await requirePermission(session, "analytics.read");
  if (!guard.allowed) return guard.response;

  const supabase = await createClient();
  const params = await searchParams;
  const today = getTodayInTimezone(session.workspaceTimezone);
  const { current, previous } = resolveRangeFromParams(params, today);
  const workspaceId = session.workspaceId!;
  const t = await getTranslator();
  const locale = intlLocale(await getLocale());

  // A failed query is **not** an empty result. The difference is the whole
  // point: "there was no traffic" and "we could not read the traffic" are
  // different facts, and the screen must not confuse them.
  let rows: Awaited<ReturnType<typeof getGa4Metrics>> = [];
  let previousRows: Awaited<ReturnType<typeof getGa4Metrics>> = [];
  let failure: string | null = null;

  try {
    rows = await getGa4Metrics(
      supabase,
      workspaceId,
      current.start,
      current.end,
    );
  } catch (error) {
    failure =
      error instanceof Error
        ? error.message
        : t("pages.analytics.metricsError");
  }

  if (!failure) {
    try {
      previousRows = await getGa4Metrics(
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

  const totalRows = rows.filter((row) => row.dimension === "total");
  const sum = (list: typeof rows, field: "sessions" | "active_users" | "new_users" | "engaged_sessions" | "key_events" | "screen_page_views") =>
    sumSeries(
      list.map((row) => ({
        value: row[field],
        source: "provider" as const,
        grain: "day" as const,
        fetchedAt: row.source_fetched_at,
      })),
    );

  const sessions = sum(totalRows, "sessions");
  const previousSessions = sum(
    previousRows.filter((row) => row.dimension === "total"),
    "sessions",
  );
  const activeUsers = sum(totalRows, "active_users");
  const newUsers = sum(totalRows, "new_users");
  const keyEvents = sum(totalRows, "key_events");
  const previousKeyEvents = sum(
    previousRows.filter((row) => row.dimension === "total"),
    "key_events",
  );
  const views = sum(totalRows, "screen_page_views");

  const fetchedAt = latestFetchedAt(rows);

  // Landing pages and traffic sources.
  const landingPages = rows.filter((row) => row.dimension === "landing_page");
  const sources = rows.filter((row) => row.dimension === "source");

  const aggregateBy = (
    list: typeof rows,
    key: "landing_page" | "source",
    field: "sessions",
  ) => {
    const map = new Map<
      string,
      { id: string; label: string; value: number | null }
    >();
    for (const row of list) {
      if (row.dimension !== key) continue;
      const entry = map.get(row.dimension_id) ?? {
        id: row.dimension_id,
        label: row.dimension_label ?? row.dimension_id,
        value: 0,
      };
      // A dimension's total is unknown as soon as one of its rows is unknown:
      // the other rows are not the whole of it.
      entry.value = addNullable(entry.value, row[field]);
      map.set(row.dimension_id, entry);
    }
    // An unknown total sorts last. It is not "the smallest".
    return [...map.values()].sort((a, b) => {
      if (a.value === null) return b.value === null ? 0 : 1;
      if (b.value === null) return -1;
      return b.value - a.value;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.analytics.title")}
        subtitle={t("pages.analytics.subtitle")}
      />

      <Notice tone="info" title={t("pages.analytics.comparabilityTitle")}>
        {t("pages.analytics.comparabilityBody")}
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
          label={t("pages.analytics.sessions")}
           coverage={coverageOf(sessions)}
          value={
            sessions.value === null
              ? "—"
              : new Intl.NumberFormat(locale, { notation: "compact" }).format(
                  sessions.value,
                )
          }
          change={describeChange(sessions.value, previousSessions.value)}
          source={fetchedAt ? { label: "GA4", fetchedAt } : null}
        />
        <KpiCard
          label={t("pages.analytics.activeUsers")}
           coverage={coverageOf(activeUsers)}
          value={
            activeUsers.value === null
              ? "—"
              : new Intl.NumberFormat(locale, { notation: "compact" }).format(
                  activeUsers.value,
                )
          }
        />
        <KpiCard
          label={t("pages.analytics.newUsers")}
           coverage={coverageOf(newUsers)}
          value={
            newUsers.value === null
              ? "—"
              : new Intl.NumberFormat(locale, { notation: "compact" }).format(
                  newUsers.value,
                )
          }
        />
        <KpiCard
          label={t("pages.analytics.keyEvents")}
           coverage={coverageOf(keyEvents)}
          value={formatCount(keyEvents.value, locale)}
          change={describeChange(keyEvents.value, previousKeyEvents.value)}
        />
        <KpiCard
          label={t("pages.analytics.keyEventRate")}
           coverage={coverageOf(keyEvents)}
          value={formatPercent(
            computeKeyEventRate(
              { value: keyEvents.value, source: "provider", grain: "day", fetchedAt: null },
              { value: sessions.value, source: "provider", grain: "day", fetchedAt: null },
            )?.value ?? null,
            locale,
          )}
        />
        <KpiCard
          label={t("pages.analytics.pageViews")}
           coverage={coverageOf(views)}
          value={
            views.value === null
              ? "—"
              : new Intl.NumberFormat(locale, { notation: "compact" }).format(
                  views.value,
                )
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title={t("pages.analytics.landingPages")}
            subtitle={t("pages.analytics.landingPagesSubtitle")}
          />
          <CardBody className="p-0">
              <DataTable
                label={t("pages.analytics.landingPages")}
                rows={aggregateBy(landingPages, "landing_page", "sessions")}
                empty={
                  <EmptyState
                    title={t("pages.analytics.noLandingDataTitle")}
                    description={t("pages.analytics.noLandingDataBody")}
                    icon={<ChartPie className="size-5" />}
                    className="border-0"
                  />
                }
                rowKey={(row) => row.id}
                columns={[
                  {
                    key: "page",
                    header: t("common.landingPage"),
                    mobile: "primary",
                    render: (row) => (
                      <span className="font-semibold text-tertiary">{row.label}</span>
                    ),
                  },
                  {
                    key: "sessions",
                    header: t("pages.analytics.sessions"),
                    numeric: true,
                    mobile: "secondary",
                    render: (row) => formatCount(row.value, locale),
                  },
                ]}
              />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t("pages.analytics.sources")}
            subtitle={t("pages.analytics.sourcesSubtitle")}
          />
          <CardBody className="p-0">
              <DataTable
                label={t("pages.analytics.sources")}
                rows={aggregateBy(sources, "source", "sessions")}
                empty={
                  <EmptyState
                    title={t("pages.analytics.noSourceDataTitle")}
                    description={t("pages.analytics.noSourceDataBody")}
                    className="border-0"
                  />
                }
                rowKey={(row) => row.id}
                columns={[
                  {
                    key: "source",
                    header: t("common.sourceMedium"),
                    mobile: "primary",
                    render: (row) => (
                      <span className="font-semibold text-tertiary">{row.label}</span>
                    ),
                  },
                  {
                    key: "sessions",
                    header: t("pages.analytics.sessions"),
                    numeric: true,
                    mobile: "secondary",
                    render: (row) => formatCount(row.value, locale),
                  },
                ]}
              />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={t("pages.analytics.funnel")}
          subtitle={t("pages.analytics.funnelSubtitle")}
        />
        <CardBody>
          {totalRows.length === 0 ? (
            <EmptyState
              title={t("pages.analytics.noFunnelDataTitle")}
              description={t("pages.analytics.noFunnelDataBody")}
              className="border-0"
            />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: t("pages.analytics.sessions"),
                  value: sessions.value,
                },
                {
                  label: t("pages.analytics.engagedSessions"),
                  value: sum(totalRows, "engaged_sessions").value,
                },
                {
                  label: t("pages.analytics.keyEvents"),
                  value: keyEvents.value,
                },
              ].map((step) => (
                <div
                  key={step.label}
                  className="rounded-lg border border-border bg-surface-muted/50 p-4"
                >
                  <dt className="text-label-md font-semibold text-secondary">
                    {step.label}
                  </dt>
                  <dd className="mt-1 text-headline-md font-bold text-tertiary">
                    {formatCount(step.value, locale)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </CardBody>
      </Card>
        </>
      )}
    </div>
  );
}
