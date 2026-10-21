/**
 * Alert evaluation.
 *
 * Naive threshold alerting on marketing data is noisy: Google Ads conversion
 * counts dip every weekend, Search Console impressions dip in August, and
 * GA4 volumes swing on launch days. To keep the action queue useful CCM
 * applies four controls:
 *
 *  1. **Minimum volume** — a metric below a floor never raises an alert.
 *  2. **Relative threshold** — the rule is expressed against the metric's own
 *     baseline, not an absolute number that only fits one account.
 *  3. **Hysteresis** — the alert must breach the threshold, and must stay
 *     clear of it for a number of consecutive windows before it resolves.
 *  4. **Grace period** — a newly connected source is never alerted on until
 *     it has enough history to have a baseline.
 */

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertMetricKind =
  | "ads_spend"
  | "ads_conversions"
  | "ads_cpa"
  | "ga4_sessions"
  | "ga4_key_events"
  | "gsc_clicks"
  | "gsc_impressions"
  | "gsc_position"
  | "social_engagement"
  | "site_uptime"
  | "site_response_time"
  | "sync_failure"
  | "mailbox_unread";

export interface AlertRule {
  id: string;
  workspaceId: string;
  metric: AlertMetricKind;
  /** Direction that constitutes a breach. */
  direction: "increase" | "decrease";
  /** Fractional threshold, e.g. 0.25 = 25% change. */
  threshold: number;
  severity: AlertSeverity;
  /** Minimum metric value required before the rule can fire. */
  minVolume: number;
  /** Consecutive clear windows required to auto-resolve. */
  hysteresisWindows: number;
  /** Windows of history required before the rule is armed. */
  graceWindows: number;
  /** Optional quiet period in UTC hours, e.g. skip 22:00-07:00 local. */
  quietHours?: { startUtcHour: number; endUtcHour: number } | null;
  /** Minimum interval between repeat alerts for the same rule. */
  minRepeatHours: number;
  enabled: boolean;
  /** Optional scope, e.g. a specific website or account. */
  scope?: { websiteId?: string; externalAccountId?: string } | null;
}

export interface MetricReading {
  /** ISO day the reading belongs to. */
  day: string;
  value: number | null;
}

export interface AlertEvaluationInput {
  rule: AlertRule;
  /** Most recent reading last. */
  history: MetricReading[];
  /** How many consecutive windows the metric has been below/above threshold. */
  consecutiveBreaches?: number;
  /** How many consecutive windows the metric has been back inside threshold. */
  consecutiveClears?: number;
  /** Hours since the last alert fired for this rule. */
  hoursSinceLastAlert?: number | null;
  /** Current UTC hour, used for quiet periods. */
  utcHour?: number;
}

export type AlertDecision =
  | { action: "none"; reason: string }
  | { action: "raise"; severity: AlertSeverity; reason: string; observed: number; baseline: number }
  | { action: "auto_resolve"; reason: string };

/**
 * Compare the latest reading against the baseline (median of the trailing
 * window, excluding the latest reading itself).
 *
 * A median is used rather than a mean so a single spike in the baseline
 * window does not permanently raise the bar.
 */
export function computeBaseline(
  history: MetricReading[],
  window = 7,
): number | null {
  const values = history
    .slice(0, -1)
    .map((r) => r.value)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  if (values.length === 0) return null;
  const slice = values.slice(-window);
  const mid = Math.floor(slice.length / 2);
  return slice.length % 2 === 0
    ? ((slice[mid - 1] ?? 0) + (slice[mid] ?? 0)) / 2
    : (slice[mid] ?? 0);
}

/**
 * Relative movement against the baseline.
 *
 * Returns `null` when the baseline is zero (percentage movement from zero is
 * undefined) so the caller can fall back to absolute comparison rules.
 */
export function relativeChange(
  current: number,
  baseline: number,
): number | null {
  if (baseline === 0) return null;
  return (current - baseline) / baseline;
}

function inQuietPeriod(rule: AlertRule, utcHour: number): boolean {
  const quiet = rule.quietHours;
  if (!quiet) return false;
  const { startUtcHour, endUtcHour } = quiet;
  if (startUtcHour === endUtcHour) return false;
  if (startUtcHour < endUtcHour) {
    return utcHour >= startUtcHour && utcHour < endUtcHour;
  }
  // Window wraps past midnight (e.g. 22 -> 07).
  return utcHour >= startUtcHour || utcHour < endUtcHour;
}

/**
 * Decide whether an alert rule should fire, and why.
 *
 * The returned `reason` is surfaced to the user verbatim — an alert must
 * always explain the evidence that produced it.
 */
export function evaluateRule(input: AlertEvaluationInput): AlertDecision {
  const { rule, history } = input;
  if (!rule.enabled) return { action: "none", reason: "Rule is disabled" };

  const latest = history.at(-1);
  if (!latest) return { action: "none", reason: "No readings yet" };
  if (latest.value === null) {
    return {
      action: "none",
      reason: "Latest reading is unavailable (not zero)",
    };
  }

  const usableHistory = history.filter((r) => r.value !== null);
  if (usableHistory.length < rule.graceWindows) {
    return {
      action: "none",
      reason: `Collecting baseline (${usableHistory.length}/${rule.graceWindows} windows)`,
    };
  }

  const baseline = computeBaseline(history);
  if (baseline === null) {
    return { action: "none", reason: "No baseline available yet" };
  }

  if (latest.value < rule.minVolume) {
    return {
      action: "none",
      reason: `Below minimum volume (${latest.value} < ${rule.minVolume})`,
    };
  }

  const change = relativeChange(latest.value, baseline);
  if (change === null) {
    return {
      action: "none",
      reason: "Baseline is zero; relative change undefined",
    };
  }

  const breach =
    rule.direction === "increase" ? change >= rule.threshold : change <= -rule.threshold;

  if (!breach) {
    const clears = input.consecutiveClears ?? 0;
    if (
      clears >= rule.hysteresisWindows &&
      rule.hysteresisWindows > 0
    ) {
      return {
        action: "auto_resolve",
        reason: `Back within threshold for ${clears} consecutive windows`,
      };
    }
    return { action: "none", reason: "Within threshold" };
  }

  const breaches = input.consecutiveBreaches ?? 1;
  if (breaches < 1) {
    return { action: "none", reason: "Not yet a confirmed breach" };
  }

  if (input.utcHour !== undefined && inQuietPeriod(rule, input.utcHour)) {
    return { action: "none", reason: "Inside the configured quiet period" };
  }

  if (
    input.hoursSinceLastAlert !== null &&
    input.hoursSinceLastAlert !== undefined &&
    input.hoursSinceLastAlert < rule.minRepeatHours
  ) {
    return {
      action: "none",
      reason: `Repeat suppressed (${Math.round(input.hoursSinceLastAlert)}h < ${rule.minRepeatHours}h)`,
    };
  }

  const percent = Math.round(Math.abs(change) * 100);
  const directionWord = rule.direction === "increase" ? "above" : "below";
  return {
    action: "raise",
    severity: rule.severity,
    reason: `${percent}% ${directionWord} baseline`,
    observed: latest.value,
    baseline,
  };
}

/**
 * Severity escalation: a large deviation on a high-value metric is critical.
 */
export function escalateSeverity(
  base: AlertSeverity,
  observedChange: number,
): AlertSeverity {
  const magnitude = Math.abs(observedChange);
  if (base === "info") return magnitude >= 0.5 ? "warning" : "info";
  if (base === "warning") return magnitude >= 0.75 ? "critical" : "warning";
  return "critical";
}
