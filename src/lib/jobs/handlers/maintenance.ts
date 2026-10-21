import type { JobHandler } from "@/lib/jobs/runner";
import { evaluateRule, type AlertRule, type MetricReading } from "@/domain/alerts";
import { readAlertsForEvaluation } from "@/lib/repositories/alerts-eval";
import { summariseSeries } from "@/lib/jobs/series";

/**
 * The maintenance handlers: alert evaluation and data retention.
 *
 * These run on the same queue as the provider syncs, so they are bounded,
 * retried and observable in exactly the same way.
 */

export const alertsEvaluateHandler: JobHandler = async (context) => {
  const { rules, readings } = await readAlertsForEvaluation(
    context.db,
    context.job.workspace_id,
  );

  let raised = 0;
  const now = new Date().toISOString();

  for (const rule of rules) {
    const history = readings[rule.metric] ?? [];
    if (history.length === 0) continue;

    // The rule row is stored in the database's column names; the alert engine
    // works in the domain's names. Map explicitly rather than casting.
    const domainRule: AlertRule = {
      id: rule.id,
      workspaceId: context.job.workspace_id,
      metric: rule.metric as AlertRule["metric"],
      direction: rule.direction,
      threshold: Number(rule.threshold),
      severity: rule.severity as AlertRule["severity"],
      minVolume: Number(rule.min_volume),
      hysteresisWindows: Number(rule.hysteresis_windows),
      graceWindows: Number(rule.grace_windows),
      quietHours: rule.quiet_hours,
      minRepeatHours: Number(rule.min_repeat_hours),
      enabled: rule.enabled,
      scope: rule.scope,
    };

    const decision = evaluateRule({
      rule: domainRule,
      history: history as MetricReading[],
      consecutiveBreaches: 1,
      consecutiveClears: 0,
      hoursSinceLastAlert: null,
      utcHour: new Date().getUTCHours(),
    });

    if (decision.action !== "raise") continue;

    // One open alert per rule and metric, so a rule that keeps breaching does
    // not fill the queue.
    const { error } = await context.db.from("alerts").upsert(
      {
        workspace_id: context.job.workspace_id,
        rule_id: rule.id,
        account_id: rule.scope?.accountId ?? null,
        metric: rule.metric,
        severity: decision.severity,
        title: `${rule.metric} moved ${decision.reason}`,
        reason: decision.reason,
        observed: decision.observed,
        baseline: decision.baseline,
        confidence: 0.8,
        status: "open",
        source_ref: {
          provider: rule.connector,
          metric: rule.metric,
          observed: decision.observed,
          baseline: decision.baseline,
        },
        opened_at: now,
      },
      {
        onConflict: "workspace_id,rule_id,metric",
        ignoreDuplicates: true,
      },
    );

    if (error) {
      console.error("could not raise the alert", error.message);
      continue;
    }
    raised += 1;
  }

  return {
    rowsWritten: raised,
    notes: [
      `Evaluated ${rules.length} rule(s) against ${Object.keys(readings).length} metric series.`,
    ],
  };
};

export const retentionPruneHandler: JobHandler = async (context) => {
  const days = Number(
    (context.job.payload as { retentionDays?: number }).retentionDays ?? 730,
  );
  const cutoff = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const tables = [
    "daily_ads_metrics",
    "daily_ga4_metrics",
    "daily_gsc_metrics",
    "social_account_metrics",
  ];

  let removed = 0;
  for (const table of tables) {
    const { error, count } = await context.db
      .from(table)
      .delete({ count: "exact" })
      .eq("workspace_id", context.job.workspace_id)
      .lt("metric_date", cutoff);
    if (error) {
      console.error(`could not prune ${table}`, error.message);
      continue;
    }
    removed += count ?? 0;
  }

  return {
    rowsWritten: removed,
    notes: [
      `Pruned ${removed} metric row(s) older than ${cutoff} (${days} days).`,
      "Audit events, launch events and mailbox metadata are not pruned here: their retention is a compliance decision and is set in Settings.",
    ],
  };
};

/**
 * A helper that turns a raw metric series into the shape the alert engine
 * expects. Exported so the evaluation logic can be unit-tested.
 */
export function toReading(day: string, value: number | null): MetricReading {
  return { day, value };
}

export { summariseSeries };
