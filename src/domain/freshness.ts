/**
 * Data freshness.
 *
 * A connector that failed silently is worse than one that is visibly broken.
 * Every number CCM shows carries the moment its source was last refreshed, and
 * the UI states plainly when that data has aged past the connector's target.
 */

export type FreshnessState =
  | "fresh"
  | "aging"
  | "stale"
  | "failing"
  | "never";

export interface FreshnessInput {
  /** ISO timestamp of the last successful sync, if any. */
  lastSuccessAt: string | null;
  /** ISO timestamp of the last attempt, successful or not. */
  lastAttemptAt: string | null;
  /** Whether the most recent attempt failed. */
  lastAttemptFailed: boolean;
  /** Target seconds between successful syncs. */
  targetIntervalSeconds: number;
  /** Current time. Supplied by the caller so the function stays pure. */
  now: Date;
}

export interface Freshness {
  state: FreshnessState;
  /** Age of the newest good data in seconds, or null when there is none. */
  ageSeconds: number | null;
  /** True when the connector has never completed a successful sync. */
  neverSynced: boolean;
  /** Human-readable explanation used in tooltips and status chips. */
  label: string;
}

const AGING_FACTOR = 2;

export function computeFreshness(input: FreshnessInput): Freshness {
  const { lastSuccessAt, lastAttemptAt, lastAttemptFailed, targetIntervalSeconds, now } =
    input;

  if (!lastSuccessAt) {
    return {
      state: lastAttemptFailed ? "failing" : "never",
      ageSeconds: null,
      neverSynced: true,
      label: lastAttemptFailed
        ? "Sync failing — no successful run yet"
        : "Not connected — no data yet",
    };
  }

  const ageSeconds = Math.max(
    0,
    (now.getTime() - Date.parse(lastSuccessAt)) / 1000,
  );

  if (lastAttemptFailed && lastAttemptAt && Date.parse(lastAttemptAt) >= Date.parse(lastSuccessAt)) {
    return {
      state: "failing",
      ageSeconds,
      neverSynced: false,
      label: "Last sync failed — showing last good data",
    };
  }

  const agingAfter = targetIntervalSeconds * AGING_FACTOR;
  const staleAfter = targetIntervalSeconds * 4;

  if (ageSeconds > staleAfter) {
    return {
      state: "stale",
      ageSeconds,
      neverSynced: false,
      label: "Data is stale",
    };
  }
  if (ageSeconds > agingAfter) {
    return {
      state: "aging",
      ageSeconds,
      neverSynced: false,
      label: "Refresh overdue",
    };
  }
  return {
    state: "fresh",
    ageSeconds,
    neverSynced: false,
    label: "Up to date",
  };
}

/** Compact relative time, e.g. "4 min ago", "2 h ago", "3 d ago". */
export function formatAge(ageSeconds: number | null): string {
  if (ageSeconds === null) return "never";
  if (ageSeconds < 60) return `${Math.max(1, Math.round(ageSeconds))} s ago`;
  const minutes = ageSeconds / 60;
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} h ago`;
  const days = hours / 24;
  return `${Math.round(days)} d ago`;
}

/** Default sync cadence per connector kind, in seconds. */
export const SYNC_INTERVALS = {
  google_ads: 3 * 3600,
  ga4: 3 * 3600,
  gsc: 12 * 3600,
  gtm: 24 * 3600,
  youtube: 6 * 3600,
  gmail: 15 * 60,
  meta: 6 * 3600,
  linkedin: 12 * 3600,
  ahrefs: 24 * 3600,
  clarity: 24 * 3600,
  pagespeed: 24 * 3600,
  uptime: 5 * 60,
} as const;
