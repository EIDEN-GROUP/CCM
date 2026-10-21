import type { Db } from "@/lib/repositories/types";
import { readMetricSeries } from "@/lib/jobs/series";

/**
 * Reading the rules and their metric series for evaluation.
 *
 * Kept apart from the alert repository because the evaluation path needs
 * cross-table reads and the alerting path does not.
 */

export interface EvaluatableRule {
  id: string;
  metric: string;
  direction: "increase" | "decrease";
  threshold: number;
  severity: string;
  min_volume: number;
  hysteresis_windows: number;
  grace_windows: number;
  quiet_hours: { startUtcHour: number; endUtcHour: number } | null;
  min_repeat_hours: number;
  scope: { accountId?: string; websiteId?: string; connector?: string } | null;
  connector: string;
  enabled: boolean;
}

export async function readAlertsForEvaluation(
  db: Db,
  workspaceId: string,
): Promise<{
  rules: EvaluatableRule[];
  readings: Record<string, Array<{ day: string; value: number | null }>>;
}> {
  const { data, error } = await db
    .from("alert_rules")
    .select(
      "id, metric, direction, threshold, severity, min_volume, hysteresis_windows, grace_windows, quiet_hours, min_repeat_hours, scope, enabled",
    )
    .eq("workspace_id", workspaceId)
    .eq("enabled", true);

  if (error) {
    console.error("could not read the alert rules", error.message);
    return { rules: [], readings: {} };
  }

  const rules = ((data ?? []) as Array<Record<string, unknown>>).map(
    (row) =>
      ({
        ...row,
        connector:
          typeof row.scope === "object" && row.scope !== null
            ? String((row.scope as { connector?: string }).connector ?? "ccm")
            : "ccm",
      }) as EvaluatableRule,
  );

  const readings: Record<string, Array<{ day: string; value: number | null }>> =
    {};

  for (const rule of rules) {
    if (readings[rule.metric]) continue;
    readings[rule.metric] = await readMetricSeries(
      db,
      workspaceId,
      rule.metric,
      Math.max(rule.grace_windows * 2, 14),
    );
  }

  return { rules, readings };
}
