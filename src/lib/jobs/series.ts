import type { Db } from "@/lib/repositories/types";
import type { MetricReading } from "@/domain/alerts";

/**
 * Turning stored daily facts into the series the alert engine evaluates.
 *
 * The mapping from a metric key to its source table and column is explicit,
 * so a rule can never point at a metric that does not exist.
 */

export interface MetricSource {
  table: string;
  column: string;
  /** How the daily rows are reduced to one number per day. */
  aggregate: "sum" | "avg" | "max";
}

export const METRIC_SOURCES: Record<string, MetricSource> = {
  "ads.spend": { table: "daily_ads_metrics", column: "cost_micros", aggregate: "sum" },
  "ads.clicks": { table: "daily_ads_metrics", column: "clicks", aggregate: "sum" },
  "ads.impressions": { table: "daily_ads_metrics", column: "impressions", aggregate: "sum" },
  "ads.conversions": { table: "daily_ads_metrics", column: "conversions", aggregate: "sum" },
  "ga4.sessions": { table: "daily_ga4_metrics", column: "sessions", aggregate: "sum" },
  "ga4.active_users": { table: "daily_ga4_metrics", column: "active_users", aggregate: "sum" },
  "ga4.key_events": { table: "daily_ga4_metrics", column: "key_events", aggregate: "sum" },
  "gsc.clicks": { table: "daily_gsc_metrics", column: "clicks", aggregate: "sum" },
  "gsc.impressions": { table: "daily_gsc_metrics", column: "impressions", aggregate: "sum" },
  "social.impressions": {
    table: "social_account_metrics",
    column: "impressions",
    aggregate: "sum",
  },
  "social.engagements": {
    table: "social_account_metrics",
    column: "engagements",
    aggregate: "sum",
  },
};

/**
 * Read a daily series for a metric, most recent last.
 */
export async function readMetricSeries(
  db: Db,
  workspaceId: string,
  metricKey: string,
  days = 30,
): Promise<MetricReading[]> {
  const source = METRIC_SOURCES[metricKey];
  if (!source) return [];

  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await db
    .from(source.table)
    .select("metric_date, dimension, " + source.column)
    .eq("workspace_id", workspaceId)
    .gte("metric_date", since)
    .order("metric_date", { ascending: true });

  if (error) {
    console.error(`could not read the series for ${metricKey}`, error.message);
    return [];
  }

  const byDay = new Map<string, number[]>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const day = String(row.metric_date ?? "");
    if (!day) continue;
    const value = row[source.column];
    if (value === null || value === undefined) continue;
    const list = byDay.get(day) ?? [];
    list.push(Number(value));
    byDay.set(day, list);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, values]) => ({
      day,
      value: summariseSeries(values, source.aggregate),
    }));
}

/**
 * Reduce the rows of one day to a single number.
 *
 * `ads.spend` is stored in micros, so the series is scaled to a readable
 * unit before a rule compares it with a baseline.
 */
export function summariseSeries(
  values: number[],
  aggregate: "sum" | "avg" | "max" = "sum",
): number {
  if (values.length === 0) return 0;
  if (aggregate === "max") return Math.max(...values);
  if (aggregate === "avg") {
    return values.reduce((total, value) => total + value, 0) / values.length;
  }
  return values.reduce((total, value) => total + value, 0);
}
