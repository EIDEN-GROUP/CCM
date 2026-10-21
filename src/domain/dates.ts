/**
 * Date range and comparison helpers.
 *
 * Rules that the rest of CCM depends on:
 *  - All provider-facing dates are ISO calendar days (`YYYY-MM-DD`), never
 *    timestamps. Google Ads, GA4 and Search Console all report on day
 *    boundaries in the account/property timezone.
 *  - Arithmetic happens on plain calendar days. That sidesteps DST entirely:
 *    a "28 day" window is 28 calendar days regardless of how many hours it
 *    actually contains.
 *  - `today` is always supplied by the caller as the *provider's* current
 *    date. We never read the server clock here, so the same function can
 *    reproduce a range for a property in Casablanca and one in Paris.
 */

export const RANGE_PRESETS = ["7d", "28d", "90d", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export interface DateRange {
  /** Inclusive ISO day, `YYYY-MM-DD`. */
  start: string;
  /** Inclusive ISO day, `YYYY-MM-DD`. */
  end: string;
  preset: RangePreset;
}

export interface ResolvedRange {
  current: { start: string; end: string };
  previous: { start: string; end: string };
  /** Number of inclusive days in the current window. */
  days: number;
  /** True when `previous` is not a real window (e.g. 1-day custom range). */
  comparisonAvailable: boolean;
}

export const MS_PER_DAY = 86_400_000;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Throws on malformed input rather than silently producing a bad range. */
export function assertIsoDay(value: string, label = "date"): string {
  if (!ISO_DAY.test(value)) {
    throw new Error(`Expected ${label} as YYYY-MM-DD, received "${value}"`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${label}: "${value}"`);
  }
  // Reject values like 2026-02-31 that Date would silently roll over.
  if (parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ${label}: "${value}" is not a real calendar day`);
  }
  return value;
}

function toUtcMs(day: string): number {
  return Date.parse(`${assertIsoDay(day)}T00:00:00.000Z`);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: string, delta: number): string {
  return fromUtcMs(toUtcMs(day) + delta * MS_PER_DAY);
}

export function diffDaysInclusive(start: string, end: string): number {
  return Math.floor((toUtcMs(end) - toUtcMs(start)) / MS_PER_DAY) + 1;
}

export function isIsoDayBeforeOrEqual(a: string, b: string): boolean {
  return toUtcMs(a) <= toUtcMs(b);
}

export function clampRange(range: DateRange, maxDays = 400): DateRange {
  const start = assertIsoDay(range.start, "range.start");
  const end = assertIsoDay(range.end, "range.end");
  if (toUtcMs(end) < toUtcMs(start)) {
    throw new Error(`range.end (${end}) is before range.start (${start})`);
  }
  const days = diffDaysInclusive(start, end);
  if (days > maxDays) {
    throw new Error(
      `Range of ${days} days exceeds the maximum supported window of ${maxDays} days`,
    );
  }
  return { ...range, start, end };
}

const PRESET_DAYS: Record<Exclude<RangePreset, "custom">, number> = {
  "7d": 7,
  "28d": 28,
  "90d": 90,
};

/**
 * Resolve a preset or custom range plus its immediately preceding comparison
 * window.
 *
 * `today` is the provider's current day. The current window ends on `today`
 * inclusive; the previous window is the same number of days ending the day
 * before the current window starts.
 */
export function resolveRange(
  preset: RangePreset,
  today: string,
  custom?: { start: string; end: string },
): ResolvedRange {
  assertIsoDay(today, "today");

  if (preset === "custom") {
    if (!custom) {
      throw new Error("A custom range requires both start and end dates");
    }
    const current = clampRange({
      start: custom.start,
      end: custom.end,
      preset: "custom",
    });
    const days = diffDaysInclusive(current.start, current.end);
    // The comparison window sits entirely before the current window.
    const previousEnd = addDays(current.start, -1);
    const previousStart = addDays(previousEnd, -(days - 1));
    return {
      current: { start: current.start, end: current.end },
      previous: { start: previousStart, end: previousEnd },
      days,
      comparisonAvailable: days > 1,
    };
  }

  const days = PRESET_DAYS[preset];
  const end = today;
  const start = addDays(end, -(days - 1));
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(days - 1));
  return {
    current: { start, end },
    previous: { start: previousStart, end: previousEnd },
    days,
    comparisonAvailable: true,
  };
}

/** Every ISO day in an inclusive range. Used to expand sparse daily facts. */
export function eachDay(start: string, end: string): string[] {
  const total = diffDaysInclusive(start, end);
  const days: string[] = [];
  for (let i = 0; i < total; i += 1) {
    days.push(addDays(start, i));
  }
  return days;
}

/**
 * Whether a provider can be expected to have data for a given day.
 *
 * Google Ads and GA4 both report with a delay (typically a few hours for
 * GA4, up to ~24h for Ads conversion data). Search Console is slower still
 * (commonly 2-3 days). Asking for a day that has not landed yet must not be
 * rendered as zero — it must be rendered as "not yet available".
 */
export interface ReportingLag {
  /** Days of lag after the fact day before the provider reports it. */
  lagDays: number;
  /** Human label used in freshness tooltips. */
  label: string;
}

export const REPORTING_LAG = {
  ga4: { lagDays: 1, label: "GA4 reports typically within ~24 hours" },
  googleAds: { lagDays: 2, label: "Google Ads conversion data lags ~24-48 hours" },
  searchConsole: {
    lagDays: 3,
    label: "Search Console data typically lags 2-3 days",
  },
  meta: { lagDays: 2, label: "Meta insights lag ~24-48 hours" },
  linkedin: { lagDays: 2, label: "LinkedIn analytics lag ~24-48 hours" },
  youtube: { lagDays: 2, label: "YouTube Analytics lag ~48 hours" },
  ahrefs: { lagDays: 3, label: "Ahrefs rank snapshots refresh every ~3 days" },
  clarity: { lagDays: 1, label: "Clarity exports lag ~24 hours" },
} as const satisfies Record<string, ReportingLag>;

export type ReportingLagKey = keyof typeof REPORTING_LAG;

/**
 * The first day a provider can be expected to have reported for `today`.
 * Data before this boundary is "pending", not zero.
 *
 * `lagDays` is the number of days the provider is behind, so the most
 * recent available day is `today - lagDays`. A GA4 property with a one-day
 * lag last reported yesterday; a Search Console property with a three-day lag
 * last reported three days ago.
 */
export function firstAvailableDay(
  today: string,
  lag: ReportingLag,
): string {
  return addDays(today, -lag.lagDays);
}

/**
 * Whether a fact for `day` is expected to have landed yet.
 */
export function isDayReportable(
  day: string,
  today: string,
  lag: ReportingLag,
): boolean {
  return toUtcMs(day) <= toUtcMs(firstAvailableDay(today, lag));
}

/**
 * A provider "day" can be reported in the caller's timezone. Google Ads
 * accounts report in the account timezone; GA4 properties in the property
 * timezone. We keep the timezone on the connection so the UI can always show
 * which one a number belongs to.
 */
export function describeTimezone(timezone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "UTC";
  }
}

/** Format an ISO day for display, e.g. "12 Mar 2026". */
export function formatDay(day: string, locale = "en-GB"): string {
  assertIsoDay(day);
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00.000Z`));
}

/** Human label for the active range, used in page headers and exports. */
export function describeRange(range: DateRange, locale = "en-GB"): string {
  if (range.preset === "custom") {
    return `${formatDay(range.start, locale)} – ${formatDay(range.end, locale)}`;
  }
  const days = PRESET_DAYS[range.preset];
  return `Last ${days} days`;
}
