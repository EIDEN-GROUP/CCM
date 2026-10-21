/**
 * Derived KPI math.
 *
 * Every derived number CCM shows is computed here, never inside a React
 * component. Two reasons:
 *  1. The formulas are unit-tested and reviewable (see tests/unit/kpi.test.ts).
 *  2. A KPI shows its provenance. A value can be *reported* by a provider,
 *     *derived* by CCM from reported values, or *modelled*. Users are told
 *     which, and a missing input yields `null`, never a zero.
 */

import type { Money } from "./currency";

export type MetricSource = "provider" | "derived" | "modelled";

export type MetricGrain = "day" | "total";

/**
 * A single metric reading.
 *
 * `value` is `null` when the provider has no value for the window. That is
 * different from a provider-reported zero (e.g. a day with no impressions),
 * which is a legitimate `0`.
 */
export interface MetricValue {
  value: number | null;
  source: MetricSource;
  grain: MetricGrain;
  /** ISO timestamp of the moment the source data was fetched. */
  fetchedAt: string | null;
  /** Provider-native identifier (metric id, report name, field path). */
  sourceField?: string;
}

export function reported(
  value: number | null,
  fetchedAt: string | null,
  sourceField?: string,
): MetricValue {
  return { value, source: "provider", grain: "day", fetchedAt, sourceField };
}

export function derived(
  value: number | null,
  fetchedAt: string | null,
  sourceField?: string,
): MetricValue {
  return { value, source: "derived", grain: "day", fetchedAt, sourceField };
}

export interface AggregationResult {
  value: number | null;
  /** Fraction of contributing slots that had a value (0..1). */
  coverage: number;
  /** Number of contributing slots with no value. */
  missing: number;
  /** Total number of contributing slots considered. */
  total: number;
  source: MetricSource;
  fetchedAt: string | null;
}

/**
 * Sum a series of daily values.
 *
 * Missing days reduce `coverage` but do not silently become zero. When
 * *every* day is missing the aggregate is `null`.
 */
export function sumSeries(values: MetricValue[]): AggregationResult {
  const present = values.filter((v) => v.value !== null);
  const missing = values.length - present.length;
  if (present.length === 0) {
    return {
    value: null,
    coverage: 0,
    missing,
    total: values.length,
    source: "provider",
    fetchedAt: null,
  };
  }
  const total = present.reduce((acc, v) => acc + (v.value ?? 0), 0);
  const source = present.some((v) => v.source === "derived") ? "derived" : "provider";
  const fetchedAt = present
    .map((v) => v.fetchedAt)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1) ?? null;
  return {
    value: total,
    coverage: values.length === 0 ? 0 : present.length / values.length,
    total: values.length,
    missing,
    source,
    fetchedAt,
  };
}

/**
 * How much of a period a figure actually covers.
 *
 * A total that covers thirteen of thirty days is not the total for the
 * period, and a person reading a KPI card has no way of knowing that
 * unless the card says so. This is the pair the card renders.
 */
export function coverageOf(result: {
  missing: number;
  total: number;
}): { present: number; total: number } {
  return { present: result.total - result.missing, total: result.total };
}

/**
 * Average a series, ignoring missing values but reporting the coverage.
 */
export function averageSeries(values: MetricValue[]): AggregationResult {
  const present = values.filter((v) => v.value !== null);
  const missing = values.length - present.length;
  if (present.length === 0) {
    return {
    value: null,
    coverage: 0,
    missing,
    total: values.length,
    source: "provider",
    fetchedAt: null,
  };
  }
  const total = present.reduce((acc, v) => acc + (v.value ?? 0), 0);
  return {
    value: total / present.length,
    coverage: values.length === 0 ? 0 : present.length / values.length,
    total: values.length,
    missing,
    source: present.some((v) => v.source === "derived") ? "derived" : "provider",
    fetchedAt:
      present
        .map((v) => v.fetchedAt)
        .filter((v): v is string => Boolean(v))
        .sort()
        .at(-1) ?? null,
  };
}

/**
 * Impression-weighted average position (Search Console).
 *
 * A plain arithmetic mean of positions is misleading: a page ranking #1 for
 * one impression would otherwise outrank a page ranking #8 for 10,000. The
 * documented calculation is impressions-weighted, matching how Google itself
 * reports a blended average position.
 */
export function weightedAveragePosition(
  rows: Array<{ position: number | null; impressions: number | null }>,
): AggregationResult {
  const usable = rows.filter(
    (r) => r.position !== null && r.impressions !== null && r.impressions > 0,
  );
  if (usable.length === 0) {
    return {
      value: null,
      coverage: 0,
      missing: rows.length,
      total: rows.length,
      source: "provider",
      fetchedAt: null,
    };
  }
  let weightedSum = 0;
  let totalImpressions = 0;
  for (const row of usable) {
    weightedSum += (row.position ?? 0) * (row.impressions ?? 0);
    totalImpressions += row.impressions ?? 0;
  }
  return {
    value: weightedSum / totalImpressions,
    coverage: rows.length === 0 ? 0 : usable.length / rows.length,
    missing: rows.length - usable.length,
    total: rows.length,
    source: "derived",
    fetchedAt: null,
  };
}

/** Click-through rate = clicks / impressions. */
export function computeCtr(
  clicks: MetricValue | null,
  impressions: MetricValue | null,
): MetricValue | null {
  if (!clicks || !impressions) return null;
  if (clicks.value === null || impressions.value === null) return null;
  if ((impressions.value ?? 0) === 0) {
    // A provider-reported zero impression count means the ratio is undefined,
    // not 0%. We still surface 0 clicks as a reported zero elsewhere.
    return derived(0, clicks.fetchedAt, "clicks/impressions");
  }
  return derived(
    (clicks.value ?? 0) / (impressions.value ?? 0),
    clicks.fetchedAt,
    "clicks/impressions",
  );
}

/** Average cost per click = spend / clicks. */
export function computeCpc(
  spend: Money | null,
  clicks: MetricValue | null,
): MetricValue | null {
  if (!spend || !clicks || clicks.value === null) return null;
  if ((clicks.value ?? 0) === 0) return null;
  return derived(spend.amount / (clicks.value ?? 0), null, "spend/clicks");
}

/** Cost per conversion = spend / conversions. */
export function computeCpa(
  spend: Money | null,
  conversions: MetricValue | null,
): MetricValue | null {
  if (!spend || !conversions || conversions.value === null) return null;
  if ((conversions.value ?? 0) === 0) return null;
  return derived(spend.amount / (conversions.value ?? 0), null, "spend/conversions");
}

/**
 * Return on ad spend = conversion value / spend.
 *
 * Only meaningful when the provider actually reports conversion *value*. When
 * it does not, ROAS is unavailable — it is never approximated from revenue
 * pulled from another source.
 */
export function computeRoas(
  spend: Money | null,
  conversionValue: Money | null,
): MetricValue | null {
  if (!spend || !conversionValue) return null;
  if (spend.amount === 0) return null;
  if (!isSameCurrencyUnit(spend, conversionValue)) {
    throw new Error(
      `ROAS requires matching currencies (${spend.currency} vs ${conversionValue.currency})`,
    );
  }
  return derived(conversionValue.amount / spend.amount, null, "conversionValue/spend");
}

function isSameCurrencyUnit(a: Money, b: Money): boolean {
  return a.currency.toUpperCase() === b.currency.toUpperCase();
}

/**
 * Period-over-period change.
 *
 * Returns `null` when the comparison is not meaningful: no previous value, or
 * a previous value of zero (where "growth from zero" is undefined rather than
 * infinite).
 */
export function percentChange(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) return null;
  return (current - previous) / previous;
}

/** Absolute change between two readings. */
export function absoluteChange(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}

export interface KpiChange {
  /** Fractional change, e.g. 0.12 for +12%. */
  ratio: number | null;
  direction: "up" | "down" | "flat" | "unknown";
  /** True when the metric moved but we refuse to express it as a percentage. */
  magnitudeOnly: boolean;
}

/**
 * Build the "vs previous period" figure shown on KPI cards.
 *
 * When the previous value is zero but the current value is not, the card shows
 * an absolute movement instead of a percentage, because "new activity" is not
 * "+Infinity%".
 */
export function describeChange(
  current: number | null,
  previous: number | null,
): KpiChange {
  if (current === null || previous === null) {
    return { ratio: null, direction: "unknown", magnitudeOnly: false };
  }
  if (previous === 0) {
    return {
      ratio: null,
      direction: current === 0 ? "flat" : current > 0 ? "up" : "down",
      magnitudeOnly: current !== 0,
    };
  }
  const ratio = (current - previous) / previous;
  const direction =
    Math.abs(ratio) < 0.0005 ? "flat" : ratio > 0 ? "up" : "down";
  return { ratio, direction, magnitudeOnly: false };
}

/**
 * Session-to-key-event conversion rate.
 */
export function computeKeyEventRate(
  keyEvents: MetricValue | null,
  sessions: MetricValue | null,
): MetricValue | null {
  if (!keyEvents || !sessions) return null;
  if (keyEvents.value === null || sessions.value === null) return null;
  if ((sessions.value ?? 0) === 0) return null;
  return derived(
    (keyEvents.value ?? 0) / (sessions.value ?? 0),
    keyEvents.fetchedAt,
    "keyEvents/sessions",
  );
}

/**
 * Bounce rate from GA4. GA4 defines a bounce as a session with no engagement.
 */
export function computeBounceRate(
  engagedSessions: MetricValue | null,
  sessions: MetricValue | null,
): MetricValue | null {
  if (!engagedSessions || !sessions) return null;
  if (engagedSessions.value === null || sessions.value === null) return null;
  if ((sessions.value ?? 0) === 0) return null;
  return derived(
    1 - (engagedSessions.value ?? 0) / (sessions.value ?? 0),
    engagedAt(engagedSessions),
    "1 - engagedSessions/sessions",
  );
}

function engagedAt(v: MetricValue): string | null {
  return v.fetchedAt;
}
