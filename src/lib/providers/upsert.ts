import type { Db } from "@/lib/repositories/types";
import type { DailyFact } from "@/providers/connector";

/**
 * Persisting normalised daily facts.
 *
 * Every write is an upsert keyed by the fact's natural key, so a retried job
 * overwrites its own rows instead of duplicating them. That is what makes the
 * sync idempotent.
 */

/**
 * The row shapes below are passed straight to PostgREST, so their property
 * names are the **database column names**, not camelCase. A mismatch here
 * would silently write a null column, which is why the normalisation tests
 * assert the exact keys.
 */
export interface AdsFact {
  workspace_id: string;
  account_id: string;
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

export interface Ga4Fact {
  workspace_id: string;
  account_id: string;
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

export interface GscFact {
  workspace_id: string;
  account_id: string;
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

/** Turn a connector fact into an ads row, or null when it is not one. */
export function toAdsFact(
  fact: DailyFact,
  context: { workspaceId: string; accountId: string; currency: string | null },
): AdsFact | null {
  if (fact.dimension === "ga4" || fact.dimension === "gsc") return null;
  return {
    workspace_id: context.workspaceId,
    account_id: context.accountId,
    metric_date: fact.metricDate,
    dimension: fact.dimension,
    dimension_id: fact.dimensionId,
    dimension_label: fact.dimensionLabel,
    impressions: numberOrNull(fact.values.impressions),
    clicks: numberOrNull(fact.values.clicks),
    cost_micros: numberOrNull(fact.values.cost_micros),
    conversions: numberOrNull(fact.values.conversions),
    conversion_value_micros: numberOrNull(fact.values.conversion_value_micros),
    currency: context.currency,
    source_fetched_at: fact.sourceFetchedAt,
  };
}

export function toGa4Fact(
  fact: DailyFact,
  context: { workspaceId: string; accountId: string },
): Ga4Fact | null {
  if (fact.dimension !== "ga4") return null;
  return {
    workspace_id: context.workspaceId,
    account_id: context.accountId,
    metric_date: fact.metricDate,
    dimension: fact.dimension,
    dimension_id: fact.dimensionId,
    dimension_label: fact.dimensionLabel,
    sessions: numberOrNull(fact.values.sessions),
    active_users: numberOrNull(fact.values.active_users),
    new_users: numberOrNull(fact.values.new_users),
    engaged_sessions: numberOrNull(fact.values.engaged_sessions),
    screen_page_views: numberOrNull(fact.values.screen_page_views),
    key_events: numberOrNull(fact.values.key_events),
    event_name:
      typeof fact.values.event === "string" ? fact.values.event : null,
    event_count: numberOrNull(fact.values.event_count),
    revenue: numberOrNull(fact.values.revenue),
    currency: null,
    source_fetched_at: fact.sourceFetchedAt,
  };
}

export function toGscFact(
  fact: DailyFact,
  context: { workspaceId: string; accountId: string },
): GscFact | null {
  if (fact.dimension !== "gsc") return null;
  return {
    workspace_id: context.workspaceId,
    account_id: context.accountId,
    metric_date: fact.metricDate,
    dimension: fact.dimension,
    dimension_id: fact.dimensionId,
    dimension_label: fact.dimensionLabel,
    clicks: numberOrNull(fact.values.clicks),
    impressions: numberOrNull(fact.values.impressions),
    ctr: numberOrNull(fact.values.ctr),
    position: numberOrNull(fact.values.position),
    country:
      typeof fact.values.country === "string" ? fact.values.country : null,
    device: typeof fact.values.device === "string" ? fact.values.device : null,
    search_type:
      typeof fact.values.search_type === "string" ? fact.values.search_type : null,
    source_fetched_at: fact.sourceFetchedAt,
  };
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Write a batch of ads facts. */
export async function upsertAdsFacts(
  db: Db,
  facts: AdsFact[],
): Promise<number> {
  if (facts.length === 0) return 0;
  const { error } = await db.from("daily_ads_metrics").upsert(facts, {
    onConflict:
      "workspace_id,account_id,metric_date,dimension,dimension_id",
  });
  if (error) throw new Error(`Could not write the ads facts: ${error.message}`);
  return facts.length;
}

/** Write a batch of GA4 facts. */
export async function upsertGa4Facts(
  db: Db,
  facts: Ga4Fact[],
): Promise<number> {
  if (facts.length === 0) return 0;
  const { error } = await db.from("daily_ga4_metrics").upsert(facts, {
    onConflict:
      "workspace_id,account_id,metric_date,dimension,dimension_id",
  });
  if (error) throw new Error(`Could not write the GA4 facts: ${error.message}`);
  return facts.length;
}

/** Write a batch of Search Console facts. */
export async function upsertGscFacts(
  db: Db,
  facts: GscFact[],
): Promise<number> {
  if (facts.length === 0) return 0;
  const { error } = await db.from("daily_gsc_metrics").upsert(facts, {
    onConflict:
      "workspace_id,account_id,metric_date,dimension,dimension_id",
  });
  if (error) {
    throw new Error(`Could not write the Search Console facts: ${error.message}`);
  }
  return facts.length;
}

/** Write a batch of rank snapshots (provider-observed positions). */
export async function upsertRankSnapshots(
  db: Db,
  rows: Array<{
    workspaceId: string;
    accountId: string;
    keyword: string;
    searchEngine: string;
    country: string | null;
    city: string | null;
    device: string;
    landingUrl: string | null;
    position: number | null;
    observedOn: string;
    sourceProvider: string;
  }>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await db.from("rank_snapshots").upsert(rows, {
    onConflict:
      "workspace_id,account_id,keyword,search_engine,country,city,device,observed_on",
    ignoreDuplicates: true,
  });
  if (error) {
    throw new Error(`Could not write the rank snapshots: ${error.message}`);
  }
  return rows.length;
}

/** Write a batch of social account metrics. */
export async function upsertSocialAccountMetrics(
  db: Db,
  rows: Array<{
    workspaceId: string;
    accountId: string;
    metricDate: string;
    organic: boolean;
    followers: number | null;
    reach: number | null;
    impressions: number | null;
    engagements: number | null;
    clicks: number | null;
    videoViews: number | null;
    contentCount: number | null;
    sourceFetchedAt: string;
  }>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await db.from("social_account_metrics").upsert(rows, {
    onConflict: "workspace_id,account_id,metric_date,organic",
  });
  if (error) {
    throw new Error(
      `Could not write the social account metrics: ${error.message}`,
    );
  }
  return rows.length;
}

/** Write a batch of social post metrics. */
export async function upsertSocialPostMetrics(
  db: Db,
  rows: Array<{
    workspaceId: string;
    accountId: string;
    platform: string;
    postId: string;
    postedAt: string | null;
    format: string | null;
    link: string | null;
    captionExcerpt: string | null;
    reach: number | null;
    impressions: number | null;
    engagements: number | null;
    clicks: number | null;
    videoViews: number | null;
    sourceFetchedAt: string;
  }>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await db.from("social_post_metrics").upsert(rows, {
    onConflict: "workspace_id,account_id,platform,post_id",
  });
  if (error) {
    throw new Error(`Could not write the social post metrics: ${error.message}`);
  }
  return rows.length;
}

/** Write a Tag Manager container inventory snapshot. */
export async function upsertTagManagerSnapshot(
  db: Db,
  row: {
    workspaceId: string;
    accountId: string;
    containerId: string;
    versionId: string | null;
    versionNumber: number | null;
    publishedAt: string | null;
    tags: unknown;
    triggers: unknown;
    variables: unknown;
    workspaces: unknown;
    environments: unknown;
    expectedMeasurementIds: string[];
    capturedAt: string;
  },
): Promise<void> {
  const { error } = await db.from("tag_manager_snapshots").insert(row);
  if (error) {
    throw new Error(
      `Could not write the Tag Manager snapshot: ${error.message}`,
    );
  }
}

/**
 * Write a site health check.
 *
 * A check is a point in time, so it is inserted rather than upserted: the
 * history is the point. The value column holds the headline figure — the
 * status code, the performance score, the days of certificate life left —
 * and the detail column holds the rest.
 */
export async function insertSiteHealthCheck(
  db: Db,
  row: {
    workspaceId: string;
    websiteId: string;
    checkType: string;
    status: string;
    checkedAt: string;
    value: number | null;
    unit: string | null;
    detail: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await db.from("site_health_checks").insert({
    workspace_id: row.workspaceId,
    website_id: row.websiteId,
    check_type: row.checkType,
    status: row.status,
    checked_at: row.checkedAt,
    value: row.value,
    unit: row.unit,
    detail: row.detail,
  });

  if (error) {
    throw new Error(`Could not write the site health check: ${error.message}`);
  }
}
