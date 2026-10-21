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
import { computeKeyEventRate, describeChange, sumSeries } from "@/domain/kpi";
import { formatPercent } from "@/domain/currency";

export const metadata: Metadata = { title: "GA4 & Attribution" };
export const dynamic = "force-dynamic";

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

  const rows = await getGa4Metrics(
    supabase,
    workspaceId,
    current.start,
    current.end,
  ).catch(() => []);
  const previousRows = await getGa4Metrics(
    supabase,
    workspaceId,
    previous.start,
    previous.end,
  ).catch(() => []);

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
    const map = new Map<string, { id: string; label: string; value: number }>();
    for (const row of list) {
      if (row.dimension !== key) continue;
      const entry = map.get(row.dimension_id) ?? {
        id: row.dimension_id,
        label: row.dimension_label ?? row.dimension_id,
        value: 0,
      };
      entry.value += row[field] ?? 0;
      map.set(row.dimension_id, entry);
    }
    return [...map.values()].sort((a, b) => b.value - a.value);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="GA4 & Attribution"
        subtitle="Traffic sources, events, funnels and key events."
      />

      <Notice tone="info" title="Comparability">
        Google Ads conversions and GA4 key events use different attribution
        windows and different conversion definitions. CCM shows them side by
        side and flags the difference; it never silently reconciles them.
      </Notice>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Sessions"
          value={
            sessions.value === null
              ? "—"
              : new Intl.NumberFormat("en-GB", { notation: "compact" }).format(
                  sessions.value,
                )
          }
          change={describeChange(sessions.value, previousSessions.value)}
          source={fetchedAt ? { label: "GA4", fetchedAt } : null}
        />
        <KpiCard
          label="Active users"
          value={
            activeUsers.value === null
              ? "—"
              : new Intl.NumberFormat("en-GB", { notation: "compact" }).format(
                  activeUsers.value,
                )
          }
        />
        <KpiCard
          label="New users"
          value={
            newUsers.value === null
              ? "—"
              : new Intl.NumberFormat("en-GB", { notation: "compact" }).format(
                  newUsers.value,
                )
          }
        />
        <KpiCard
          label="Key events"
          value={
            keyEvents.value === null
              ? "—"
              : new Intl.NumberFormat("en-GB").format(keyEvents.value)
          }
          change={describeChange(keyEvents.value, previousKeyEvents.value)}
        />
        <KpiCard
          label="Key event rate"
          value={formatPercent(
            computeKeyEventRate(
              { value: keyEvents.value, source: "provider", grain: "day", fetchedAt: null },
              { value: sessions.value, source: "provider", grain: "day", fetchedAt: null },
            )?.value ?? null,
          )}
        />
        <KpiCard
          label="Page views"
          value={
            views.value === null
              ? "—"
              : new Intl.NumberFormat("en-GB", { notation: "compact" }).format(
                  views.value,
                )
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Landing pages"
            subtitle="Sessions by landing page"
          />
          <CardBody className="p-0">
            {landingPages.length === 0 ? (
              <EmptyState
                title="No landing page data"
                description="Connect a GA4 property to see which pages drive sessions."
                icon={<ChartPie className="size-5" />}
                className="border-0"
              />
            ) : (
              <DataTable
                label="Landing pages"
                rows={aggregateBy(landingPages, "landing_page", "sessions")}
                rowKey={(row) => row.id}
                columns={[
                  {
                    key: "page",
                    header: "Landing page",
                    mobile: "primary",
                    render: (row) => (
                      <span className="font-semibold text-tertiary">{row.label}</span>
                    ),
                  },
                  {
                    key: "sessions",
                    header: "Sessions",
                    numeric: true,
                    mobile: "secondary",
                    render: (row) =>
                      new Intl.NumberFormat("en-GB").format(row.value),
                  },
                ]}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Traffic sources" subtitle="Sessions by source / medium" />
          <CardBody className="p-0">
            {sources.length === 0 ? (
              <EmptyState
                title="No source data"
                description="Traffic source data appears once GA4 has reported."
                className="border-0"
              />
            ) : (
              <DataTable
                label="Traffic sources"
                rows={aggregateBy(sources, "source", "sessions")}
                rowKey={(row) => row.id}
                columns={[
                  {
                    key: "source",
                    header: "Source / medium",
                    mobile: "primary",
                    render: (row) => (
                      <span className="font-semibold text-tertiary">{row.label}</span>
                    ),
                  },
                  {
                    key: "sessions",
                    header: "Sessions",
                    numeric: true,
                    mobile: "secondary",
                    render: (row) =>
                      new Intl.NumberFormat("en-GB").format(row.value),
                  },
                ]}
              />
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Funnel"
          subtitle="Sessions → engaged sessions → key events"
        />
        <CardBody>
          {sessions.value === null ? (
            <EmptyState
              title="No funnel data"
              description="The funnel is built from GA4 session and key-event data."
              className="border-0"
            />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Sessions",
                  value: sessions.value,
                },
                {
                  label: "Engaged sessions",
                  value: sum(totalRows, "engaged_sessions").value,
                },
                {
                  label: "Key events",
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
                    {step.value === null
                      ? "—"
                      : new Intl.NumberFormat("en-GB").format(step.value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
