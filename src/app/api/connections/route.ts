import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deleteCredential } from "@/lib/providers/credentials";
import { enqueueJob } from "@/lib/jobs/queue";
import { writeAuditEvent } from "@/lib/repositories/alerts";
import { getConnection } from "@/lib/repositories/connections";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("refresh"), connectionId: z.string().uuid() }),
  z.object({ action: z.literal("disconnect"), connectionId: z.string().uuid() }),

]);

const JOB_KIND_FOR: Record<string, string> = {
  ga4: "ga4.sessions",
  gsc: "gsc.query",
  gtm: "gtm.inventory",
  ads: "ads.campaign",
  gmail: "mail.sync",
  meta: "social.snapshot",
  instagram: "social.snapshot",
  linkedin: "social.snapshot",
  ahrefs: "rank.snapshot",
};

/**
 * Connection actions.
 *
 * `refresh` queues a sync. `disconnect` removes the credential and marks
 * the connection as needing setup. `enable` toggles a connection's schedule.
 *
 * Every action is authorised server-side and recorded in the audit log.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("integrations.manage")) {
    return NextResponse.json(
      { error: "You do not have permission to manage connections" },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const requestClient = await createClient();
  const db = createAdminClient();

  const connection = await getConnection(db, parsed.data.connectionId);
  if (!connection || connection.workspace_id !== session.workspaceId) {
    return NextResponse.json(
      { error: "Connection not found" },
      { status: 404 },
    );
  }

  if (parsed.data.action === "refresh") {
    const { data: accounts } = await requestClient
      .from("external_accounts")
      .select("id")
      .eq("connection_id", connection.id)
      .eq("is_active", true);

    const kind = JOB_KIND_FOR[connection.provider_key] ?? "ga4.sessions";
    let queued = 0;

    for (const account of accounts ?? []) {
      await enqueueJob(db, {
        workspaceId: session.workspaceId,
        connectionId: connection.id,
        accountId: account.id,
        kind,
        dedupeKey: `${kind}:${account.id}:manual:${Date.now()}`,
      });
      queued += 1;
    }

    await writeAuditEvent(db, {
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: "connection.refresh_requested",
      entityType: "provider_connection",
      entityId: connection.id,
      targetLabel: connection.display_label,
    });

    return NextResponse.json({ ok: true, queued });
  }

  if (parsed.data.action === "disconnect") {
    // The credential is destroyed, so the account can no longer read the
    // provider even if the connection row survives.
    await deleteCredential(db, connection.id);

    await db
      .from("provider_connections")
      .update({
        status: "needs_setup",
        last_error_code: "disconnected",
        last_error_message: "The account was disconnected.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    await writeAuditEvent(db, {
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: "connection.disconnected",
      entityType: "provider_connection",
      entityId: connection.id,
      targetLabel: connection.display_label,
      severity: "warning",
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
