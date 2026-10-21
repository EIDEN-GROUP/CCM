import type { Db } from "@/lib/repositories/types";
import {
  demoAdsRows,
  demoGa4Rows,
  demoGscRows,
  demoModeIsUnsafe,
  isDemoMode,
} from "@/lib/demo/fixtures";

/**
 * Metric reads.
 *
 * Every function here returns raw, normalised daily facts. Aggregation and
 * comparison happen in `src/domain/kpi.ts`, never in a component, so the same
 * numbers appear on a page, in an export and in an alert.
 */

export interface AdsMetricRow {
  metric_date: string;
  dimension: string;
  dimension_id: string;
  dimension_label: string | null;
  impressions: number | null;
  clicks: number | null;
  cost_micros: number | null;
  conversions: number | null;
  conversion_value_micros: number | null;
  currency: string | null;
  source_fetched_at: string;
}

export interface Ga4MetricRow {
  metric_date: string;
  dimension: string;
  dimension_id: string;
  dimension_label: string | null;
  sessions: number | null;
  active_users: number | null;
  new_users: number | null;
  engaged_sessions: number | null;
  screen_page_views: number | null;
  key_events: number | null;
  event_name: string | null;
  event_count: number | null;
  revenue: number | null;
  currency: string | null;
  source_fetched_at: string;
}

export interface GscMetricRow {
  metric_date: string;
  dimension: string;
  dimension_id: string;
  dimension_label: string | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
  country: string | null;
  device: string | null;
  search_type: string | null;
  source_fetched_at: string;
}

export async function getAdsMetrics(
  db: Db,
  workspaceId: string,
  start: string,
  end: string,
  accountIds?: string[],
): Promise<AdsMetricRow[]> {
  // Demo mode returns clearly-labelled synthetic fixtures instead of
  // querying the database, so the interface can be demonstrated without a
  // provider.
  //
  // In production it refuses: a deployment that served fabricated marketing
  // figures in place of the real — missing — ones would be lying to the
  // owner, and the fixtures would contradict the screens.
  if (isDemoMode()) {
    if (demoModeIsUnsafe()) return [];
    return demoAdsRows(start, end) as AdsMetricRow[];
  }

  let query = db
    .from("daily_ads_metrics")
    .select(
      "metric_date, dimension, dimension_id, dimension_label, impressions, clicks, cost_micros, conversions, conversion_value_micros, currency, source_fetched_at",
    )
    .eq("workspace_id", workspaceId)
    .gte("metric_date", start)
    .lte("metric_date", end);

  if (accountIds && accountIds.length > 0) {
    query = query.in("account_id", accountIds);
  }

  const { data, error } = await query.order("metric_date", { ascending: true });
  if (error) throw new Error(`Could not read ads metrics: ${error.message}`);
  return (data ?? []) as AdsMetricRow[];
}

export async function getGa4Metrics(
  db: Db,
  workspaceId: string,
  start: string,
  end: string,
  accountIds?: string[],
): Promise<Ga4MetricRow[]> {
  if (isDemoMode()) {
    if (demoModeIsUnsafe()) return [];
    return demoGa4Rows(start, end) as Ga4MetricRow[];
  }

  let query = db
    .from("daily_ga4_metrics")
    .select(
      "metric_date, dimension, dimension_id, dimension_label, sessions, active_users, new_users, engaged_sessions, screen_page_views, key_events, event_name, event_count, revenue, currency, source_fetched_at",
    )
    .eq("workspace_id", workspaceId)
    .gte("metric_date", start)
    .lte("metric_date", end);

  if (accountIds && accountIds.length > 0) {
    query = query.in("account_id", accountIds);
  }

  const { data, error } = await query.order("metric_date", { ascending: true });
  if (error) throw new Error(`Could not read GA4 metrics: ${error.message}`);
  return (data ?? []) as Ga4MetricRow[];
}

export async function getGscMetrics(
  db: Db,
  workspaceId: string,
  start: string,
  end: string,
  accountIds?: string[],
): Promise<GscMetricRow[]> {
  if (isDemoMode()) {
    if (demoModeIsUnsafe()) return [];
    return demoGscRows(start, end) as GscMetricRow[];
  }

  let query = db
    .from("daily_gsc_metrics")
    .select(
      "metric_date, dimension, dimension_id, dimension_label, clicks, impressions, ctr, position, country, device, search_type, source_fetched_at",
    )
    .eq("workspace_id", workspaceId)
    .gte("metric_date", start)
    .lte("metric_date", end);

  if (accountIds && accountIds.length > 0) {
    query = query.in("account_id", accountIds);
  }

  const { data, error } = await query.order("metric_date", { ascending: true });
  if (error) throw new Error(`Could not read Search Console metrics: ${error.message}`);
  return (data ?? []) as GscMetricRow[];
}

/** The account ids in a workspace, scoped by RLS. */
export async function getAccountIds(
  db: Db,
  workspaceId: string,
): Promise<{ id: string; providerKey: string; label: string }[]> {
  const { data, error } = await db
    .from("external_accounts")
    .select("id, provider_key, display_label")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("display_label", { ascending: true });

  if (error) throw new Error(`Could not list accounts: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    providerKey: row.provider_key,
    label: row.display_label,
  }));
}

/** The newest source timestamp for a set of facts, used for freshness. */
export function latestFetchedAt<T extends { source_fetched_at: string }>(
  rows: T[],
): string | null {
  if (rows.length === 0) return null;
  return rows
    .map((row) => row.source_fetched_at)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
}
