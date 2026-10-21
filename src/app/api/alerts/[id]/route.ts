import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { writeAuditEvent } from "@/lib/repositories/alerts";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["acknowledge", "snooze", "resolve"]),
  note: z.string().max(1000).optional(),
});

/**
 * Update an alert.
 *
 * The status change and the audit record are written together, so the
 * resolution history can never disagree with the alert's own state.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("alerts.manage")) {
    return NextResponse.json(
      { error: "You do not have permission to manage alerts" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {};

  if (parsed.data.action === "acknowledge") {
    update.status = "acknowledged";
    update.owner_user_id = session.userId;
  } else if (parsed.data.action === "snooze") {
    update.status = "snoozed";
    update.owner_user_id = session.userId;
    update.due_at = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  } else {
    update.status = "resolved";
    update.resolved_at = now;
    update.resolution_note = parsed.data.note ?? null;
  }

  const { data, error } = await supabase
    .from("alerts")
    .update(update)
    .eq("id", id)
    .eq("workspace_id", session.workspaceId)
    .select("id, title, status")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: `Could not update the alert: ${error.message}` },
      { status: 400 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  await writeAuditEvent(supabase, {
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: `alert.${parsed.data.action}`,
    entityType: "alert",
    entityId: id,
    targetLabel: data.title,
    details: parsed.data.note ? { note: parsed.data.note } : {},
  });

  return NextResponse.json({ ok: true, status: data.status });
}
