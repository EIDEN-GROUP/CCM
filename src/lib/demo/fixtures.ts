/**
 * Demo mode.
 *
 * When `CCM_DEMO_MODE=1`, the metric repositories return synthetic
 * fixtures so the interface can be demonstrated without a connected
 * provider. The fixtures are **clearly labelled everywhere they appear**:
 * the demo banner in the shell, a "Demo data" chip on every KPI card, and a
 * note in every export.
 *
 * Demo mode is off by default and must never be on in production: the
 * `doctor` script reports it, and the flag is refused when the environment
 * says production.
 */

export const DEMO_MODE_ENV = "CCM_DEMO_MODE";

export function isDemoMode(): boolean {
  return process.env[DEMO_MODE_ENV] === "1";
}

/** Demo mode is refused when the deployment says it is production. */
export function demoModeIsUnsafe(): boolean {
  return isDemoMode() && process.env.NODE_ENV === "production";
}

/**
 * A small deterministic pseudo-random generator, so the fixtures are stable
 * between reloads and a screenshot taken twice looks the same.
 */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function isoDays(end: string, count: number): string[] {
  const days: string[] = [];
  const endMs = Date.parse(`${end}T00:00:00Z`);
  for (let i = count - 1; i >= 0; i -= 1) {
    days.push(new Date(endMs - i * 86_400_000).toISOString().slice(0, 10));
  }
  return days;
}

export interface DemoAdsRow {
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

export interface DemoGa4Row {
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

export interface DemoGscRow {
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

const CAMPAIGNS = [
  { id: "c1", label: "Dentistry — Agadir" },
  { id: "c2", label: "Hair transplant — Agadir" },
  { id: "c3", label: "Medical tourism — Morocco" },
  { id: "c4", label: "Brand — Medical Bay" },
  { id: "c5", label: "Retargeting — visitors" },
];

const QUERIES = [
  "dentiste esthetique agadir",
  "greffe de cheveux agadir",
  "dentiste agadir",
  "clinique medicale agadir",
  "tourisme medical maroc",
  "implants dentaire agadir",
];

/** Synthetic ads facts. */
export function demoAdsRows(
  start: string,
  end: string,
): DemoAdsRow[] {
  const random = seeded(20260320);
  // Deterministic, so two calls produce identical fixtures. The timestamp is
  // derived from the end of the window rather than the clock.
  const fetchedAt = `${end}T23:59:59.000Z`;
  const rows: DemoAdsRow[] = [];

  for (const day of isoDays(end, 28)) {
    if (day < start) continue;
    for (const campaign of CAMPAIGNS) {
      const impressions = Math.round(800 + random() * 2400);
      const clicks = Math.round(impressions * (0.02 + random() * 0.03));
      const cost = Math.round(clicks * (12 + random() * 30) * 100);
      const conversions = Math.round(clicks * (0.03 + random() * 0.05));
      rows.push({
        metric_date: day,
        dimension: "campaign",
        dimension_id: campaign.id,
        dimension_label: campaign.label,
        impressions,
        clicks,
        cost_micros: cost,
        conversions,
        conversion_value_micros: conversions * Math.round(300_000 + random() * 400_000),
        currency: "MAD",
        source_fetched_at: fetchedAt,
      });
    }
  }
  return rows;
}

/** Synthetic GA4 facts. */
export function demoGa4Rows(start: string, end: string): DemoGa4Row[] {
  const random = seeded(20260321);
  // Deterministic, so two calls produce identical fixtures. The timestamp is
  // derived from the end of the window rather than the clock.
  const fetchedAt = `${end}T23:59:59.000Z`;
  const rows: DemoGa4Row[] = [];

  for (const day of isoDays(end, 28)) {
    if (day < start) continue;
    const sessions = Math.round(120 + random() * 260);
    rows.push({
      metric_date: day,
      dimension: "total",
      dimension_id: "total",
      dimension_label: "All sessions",
      sessions,
      active_users: Math.round(sessions * (0.72 + random() * 0.15)),
      new_users: Math.round(sessions * (0.78 + random() * 0.15)),
      engaged_sessions: Math.round(sessions * (0.48 + random() * 0.22)),
      screen_page_views: Math.round(sessions * (1.6 + random() * 1.4)),
      key_events: Math.round(sessions * (0.04 + random() * 0.05)),
      event_name: null,
      event_count: null,
      revenue: null,
      currency: "MAD",
      source_fetched_at: fetchedAt,
    });
  }
  return rows;
}

/** Synthetic Search Console facts. */
export function demoGscRows(start: string, end: string): DemoGscRow[] {
  const random = seeded(20260322);
  // Deterministic, so two calls produce identical fixtures. The timestamp is
  // derived from the end of the window rather than the clock.
  const fetchedAt = `${end}T23:59:59.000Z`;
  const rows: DemoGscRow[] = [];

  for (const day of isoDays(end, 28)) {
    if (day < start) continue;
    for (const [index, query] of QUERIES.entries()) {
      const impressions = Math.round(60 + random() * 180);
      const clicks = Math.round(impressions * (0.04 + random() * 0.09));
      rows.push({
        metric_date: day,
        dimension: "query",
        dimension_id: query,
        dimension_label: query,
        clicks,
        impressions,
        ctr: impressions > 0 ? clicks / impressions : null,
        position: Math.round((3 + index * 2.5 + random() * 3) * 10) / 10,
        country: "MA",
        device: random() > 0.5 ? "mobile" : "desktop",
        search_type: "web",
        source_fetched_at: fetchedAt,
      });
    }
  }
  return rows;
}
