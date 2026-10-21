import type { Db } from "@/lib/repositories/types";

/**
 * The scheduled digest.
 *
 * A digest is a **report that already happened**: it is built from the
 * records CCM has synced, over a period that has closed, and it is stored so
 * it can be read later without re-running the numbers.
 *
 * The rules it inherits from the rest of the product:
 *
 *   - A missing figure is null, never zero.
 *   - Every section states its source and the period it covers.
 *   - Nothing is extrapolated, and no provider is mixed with another.
 *   - The payload contains no mailbox content and no customer identifier.
 */

export interface DigestSection {
  key: string;
  title: string;
  /** Where the numbers came from. */
  source: string;
  /** Whether the section has any data at all. */
  available: boolean;
  /** Why the section is empty, when it is. */
  unavailableReason?: string;
  metrics: Array<{
    label: string;
    value: number | null;
    unit: string | null;
    /** The formula, so a reader can check the arithmetic. */
    formula?: string | null;
  }>;
  rows?: Array<Record<string, string | number | null>>;
  caveats?: string[];
}

export interface DigestPayload {
  key: string;
  title: string;
  description: string | null;
  period: { start: string; end: string; timezone: string; currency: string };
  generatedAt: string;
  sections: DigestSection[];
  caveats: string[];
}

/** The periods a digest can cover. */
export function digestPeriod(
  cadence: string,
  end: string,
  timezone: string,
): { start: string; end: string } {
  const endDate = new Date(`${end}T00:00:00Z`);
  const days =
    cadence === "daily" ? 1 : cadence === "weekly" ? 7 : cadence === "monthly" ? 30 : 28;

  const startDate = new Date(endDate.getTime() - (days - 1) * 86_400_000);

  void timezone;

  return {
    start: startDate.toISOString().slice(0, 10),
    end,
  };
}

/**
 * Build a digest from the synced records.
 */
export async function buildDigest(
  db: Db,
  options: {
    workspaceId: string;
    key: string;
    title: string;
    description: string | null;
    cadence: string;
    period: { start: string; end: string };
    timezone: string;
    currency: string;
  },
): Promise<DigestPayload> {
  const { workspaceId, period } = options;

  const [ads, ga4, gsc, alerts, connections] = await Promise.all([
    db
      .from("daily_ads_metrics")
      .select(
        "dimension, dimension_label, impressions, clicks, cost_micros, conversions, conversion_value_micros, currency, source_fetched_at",
      )
      .eq("workspace_id", workspaceId)
      .gte("metric_date", period.start)
      .lte("metric_date", period.end),
    db
      .from("daily_ga4_metrics")
      .select(
        "sessions, active_users, engaged_sessions, key_events, source_fetched_at",
      )
      .eq("workspace_id", workspaceId)
      .gte("metric_date", period.start)
      .lte("metric_date", period.end),
    db
      .from("daily_gsc_metrics")
      .select("clicks, impressions, ctr, position, source_fetched_at")
      .eq("workspace_id", workspaceId)
      .gte("metric_date", period.start)
      .lte("metric_date", period.end),
    db
      .from("alerts")
      .select("id, title, severity, metric, status, opened_at")
      .eq("workspace_id", workspaceId)
      .eq("status", "open"),
    db
      .from("provider_connections")
      .select("id, provider_key, display_label, status, last_success_at")
      .eq("workspace_id", workspaceId),
  ]);

  const adsRows = (ads.data ?? []) as Array<Record<string, unknown>>;
  const ga4Rows = (ga4.data ?? []) as Array<Record<string, unknown>>;
  const gscRows = (gsc.data ?? []) as Array<Record<string, unknown>>;
  const alertRows = (alerts.data ?? []) as Array<Record<string, unknown>>;
  const connectionRows = (connections.data ?? []) as Array<Record<string, unknown>>;

  const caveats: string[] = [];
  const sections: DigestSection[] = [];

  // --- Paid -----------------------------------------------------------------
  if (adsRows.length === 0) {
    sections.push({
      key: "ads",
      title: "Paid",
      source: "Google Ads",
      available: false,
      unavailableReason:
        "No Google Ads records have been synced for this period.",
      metrics: [],
    });
  } else {
    const impressions = sum(adsRows, "impressions");
    const clicks = sum(adsRows, "clicks");
    const costMicros = sum(adsRows, "cost_micros");
    const conversions = sum(adsRows, "conversions");
    const valueMicros = sum(adsRows, "conversion_value_micros");
    const currency = String(adsRows[0]?.currency ?? options.currency);

    const cost = costMicros / 1_000_000;
    const value = valueMicros / 1_000_000;

    const byCampaign = new Map<
      string,
      { label: string; cost: number; clicks: number; conversions: number; impressions: number }
    >();

    for (const row of adsRows) {
      const id = String(row.dimension_label ?? row.dimension ?? "unknown");
      const entry = byCampaign.get(id) ?? {
        label: String(row.dimension_label ?? id),
        cost: 0,
        clicks: 0,
        conversions: 0,
        impressions: 0,
      };
      entry.cost += Number(row.cost_micros ?? 0) / 1_000_000;
      entry.clicks += Number(row.clicks ?? 0);
      entry.conversions += Number(row.conversions ?? 0);
      entry.impressions += Number(row.impressions ?? 0);
      byCampaign.set(id, entry);
    }

    const campaignRows = [...byCampaign.entries()]
      .sort(([, a], [, b]) => b.cost - a.cost)
      .slice(0, 10)
      .map(([, entry]) => ({
        campaign: entry.label,
        spend: round2(entry.cost),
        clicks: entry.clicks,
        impressions: entry.impressions,
        conversions: entry.conversions,
        cpc: entry.clicks > 0 ? round2(entry.cost / entry.clicks) : null,
        cpa: entry.conversions > 0 ? round2(entry.cost / entry.conversions) : null,
      }));

    sections.push({
      key: "ads",
      title: "Paid",
      source: "Google Ads",
      available: true,
      metrics: [
        { label: "Spend", value: round2(cost), unit: currency },
        { label: "Impressions", value: impressions, unit: null },
        { label: "Clicks", value: clicks, unit: null },
        {
          label: "CTR",
          value:
            impressions > 0 ? round4((clicks / impressions) * 100) : null,
          unit: "%",
          formula: "clicks / impressions",
        },
        { label: "Conversions", value: conversions, unit: null },
        {
          label: "Cost per conversion",
          value:
            conversions > 0 ? round2(cost / conversions) : null,
          unit: currency,
          formula: "spend / conversions",
        },
        {
          label: "ROAS",
          value:
            valueMicros > 0 && cost > 0 ? round2(value / cost) : null,
          unit: "x",
          formula: "conversion value / spend",
        },
      ],
      rows: campaignRows,
    });

    if (conversions === 0) {
      caveats.push(
        "Google Ads reported no conversions for this period, so cost per conversion and ROAS are unavailable rather than zero.",
      );
    }
  }

  // --- Organic --------------------------------------------------------------
  if (ga4Rows.length === 0) {
    sections.push({
      key: "ga4",
      title: "Organic and on-site",
      source: "Google Analytics 4",
      available: false,
      unavailableReason:
        "No GA4 records have been synced for this period.",
      metrics: [],
    });
  } else {
    const sessions = sum(ga4Rows, "sessions");
    const activeUsers = sum(ga4Rows, "active_users");
    const engaged = sum(ga4Rows, "engaged_sessions");
    const keyEvents = sum(ga4Rows, "key_events");

    sections.push({
      key: "ga4",
      title: "Organic and on-site",
      source: "Google Analytics 4",
      available: true,
      metrics: [
        { label: "Sessions", value: sessions, unit: null },
        { label: "Active users", value: activeUsers, unit: null },
        { label: "Engaged sessions", value: engaged, unit: null },
        { label: "Key events", value: keyEvents, unit: null },
        {
          label: "Engagement rate",
          value: sessions > 0 ? round4((engaged / sessions) * 100) : null,
          unit: "%",
          formula: "engaged sessions / sessions",
        },
        {
          label: "Key event rate",
          value: sessions > 0 ? round4((keyEvents / sessions) * 100) : null,
          unit: "%",
          formula: "key events / sessions",
        },
      ],
    });
  }

  // --- Search ---------------------------------------------------------------
  if (gscRows.length === 0) {
    sections.push({
      key: "gsc",
      title: "Search",
      source: "Google Search Console",
      available: false,
      unavailableReason:
        "No Search Console records have been synced for this period.",
      metrics: [],
    });
  } else {
    const clicks = sum(gscRows, "clicks");
    const impressions = sum(gscRows, "impressions");

    let weightedPosition: number | null = null;
    if (impressions > 0) {
      weightedPosition =
        gscRows.reduce(
          (total, row) =>
            total + Number(row.position ?? 0) * Number(row.impressions ?? 0),
          0,
        ) / impressions;
    }

    sections.push({
      key: "gsc",
      title: "Search",
      source: "Google Search Console",
      available: true,
      metrics: [
        { label: "Clicks", value: clicks, unit: null },
        { label: "Impressions", value: impressions, unit: null },
        {
          label: "CTR",
          value: impressions > 0 ? round4((clicks / impressions) * 100) : null,
          unit: "%",
          formula: "clicks / impressions",
        },
        {
          label: "Average position",
          value: weightedPosition !== null ? round2(weightedPosition) : null,
          unit: null,
          formula: "impression-weighted average position",
        },
      ],
      caveats: [
        "Search Console returns aggregated rows. This is not a complete list of every query.",
      ],
    });
  }

  // --- Alerts ---------------------------------------------------------------
  sections.push({
    key: "alerts",
    title: "Open alerts",
    source: "CCM alert engine",
    available: true,
    metrics: [
      { label: "Open alerts", value: alertRows.length, unit: null },
    ],
    rows: alertRows.slice(0, 10).map((row) => ({
      title: String(row.title ?? ""),
      severity: String(row.severity ?? ""),
      metric: String(row.metric ?? ""),
      openedAt: String(row.opened_at ?? ""),
    })),
  });

  // --- Connections ----------------------------------------------------------
  const stale = connectionRows.filter(
    (row) => row.status !== "connected",
  );

  sections.push({
    key: "connections",
    title: "Connection health",
    source: "CCM connection registry",
    available: true,
    metrics: [
      { label: "Connections", value: connectionRows.length, unit: null },
      { label: "Not connected", value: stale.length, unit: null },
    ],
    rows: connectionRows.map((row) => ({
      provider: String(row.display_label ?? row.provider_key ?? ""),
      status: String(row.status ?? ""),
      lastSuccess: row.last_success_at ? String(row.last_success_at) : null,
    })),
  });

  if (stale.length > 0) {
    caveats.push(
      `${stale.length} connection(s) are not in a connected state, so their figures are missing from this digest rather than zero.`,
    );
  }

  caveats.push(
    "Figures cover the period stated above. A blank is not a zero: a metric that was not reported is left empty.",
  );

  return {
    key: options.key,
    title: options.title,
    description: options.description,
    period: {
      start: period.start,
      end: period.end,
      timezone: options.timezone,
      currency: options.currency,
    },
    generatedAt: new Date().toISOString(),
    sections,
    caveats,
  };
}

/** Sum a numeric column, ignoring nulls. */
function sum(rows: Array<Record<string, unknown>>, column: string): number {
  return rows.reduce((total, row) => total + Number(row[column] ?? 0), 0);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
