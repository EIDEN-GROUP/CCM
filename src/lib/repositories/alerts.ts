import type { Db } from "@/lib/repositories/types";

export interface AlertRow {
  id: string;
  workspace_id: string;
  rule_id: string | null;
  account_id: string | null;
  website_id: string | null;
  metric: string;
  severity: string;
  title: string;
  reason: string;
  observed: number | null;
  baseline: number | null;
  confidence: number | null;
  status: "open" | "acknowledged" | "snoozed" | "resolved";
  owner_user_id: string | null;
  due_at: string | null;
  source_ref: Record<string, unknown>;
  opened_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
}

export interface ActionItemRow {
  id: string;
  workspace_id: string;
  alert_id: string | null;
  title: string;
  detail: string | null;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "normal" | "high";
  owner_user_id: string | null;
  due_at: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface AlertRuleRow {
  id: string;
  workspace_id: string;
  metric: string;
  direction: "increase" | "decrease";
  threshold: number;
  severity: string;
  min_volume: number;
  hysteresis_windows: number;
  grace_windows: number;
  quiet_hours: unknown;
  min_repeat_hours: number;
  scope: unknown;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function listAlerts(
  db: Db,
  workspaceId: string,
  options: { status?: AlertRow["status"]; limit?: number } = {},
): Promise<AlertRow[]> {
  let query = db
    .from("alerts")
    .select(
      "id, workspace_id, rule_id, account_id, website_id, metric, severity, title, reason, observed, baseline, confidence, status, owner_user_id, due_at, source_ref, opened_at, resolved_at, resolution_note",
    )
    .eq("workspace_id", workspaceId)
    .order("opened_at", { ascending: false })
    .limit(options.limit ?? 100);

  if (options.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not list alerts: ${error.message}`);
  return (data ?? []) as AlertRow[];
}

export async function listActionItems(
  db: Db,
  workspaceId: string,
  limit = 100,
): Promise<ActionItemRow[]> {
  const { data, error } = await db
    .from("action_items")
    .select(
      "id, workspace_id, alert_id, title, detail, status, priority, owner_user_id, due_at, source, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not list action items: ${error.message}`);
  return (data ?? []) as ActionItemRow[];
}

export async function listAlertRules(
  db: Db,
  workspaceId: string,
): Promise<AlertRuleRow[]> {
  const { data, error } = await db
    .from("alert_rules")
    .select(
      "id, workspace_id, metric, direction, threshold, severity, min_volume, hysteresis_windows, grace_windows, quiet_hours, min_repeat_hours, scope, enabled, created_by, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .order("metric", { ascending: true });

  if (error) throw new Error(`Could not list alert rules: ${error.message}`);
  return (data ?? []) as AlertRuleRow[];
}

/**
 * Record an audit event.
 *
 * Callers pass already-redacted details: the audit table is readable by
 * administrators, so it must never contain tokens, message bodies or
 * patient identifiers.
 */
export async function writeAuditEvent(
  db: Db,
  event: {
    workspaceId: string;
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    targetLabel?: string | null;
    severity?: "info" | "warning" | "critical";
    details?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await db.from("audit_events").insert({
    workspace_id: event.workspaceId,
    actor_user_id: event.actorUserId,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    target_label: event.targetLabel ?? null,
    severity: event.severity ?? "info",
    details: event.details ?? {},
  });

  if (error) {
    console.error("audit event write failed", error.message);
  }
}
