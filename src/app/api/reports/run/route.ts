import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueJob } from "@/lib/jobs/queue";
import { writeAuditEvent } from "@/lib/repositories/alerts";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  definitionId: z.string().uuid(),
  /** The period the digest covers. Defaults to today. */
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Queue a digest.
 *
 * The digest is built by the worker, not here: the same code path builds a
 * scheduled digest and a requested one, so a requested digest cannot differ
 * from what the schedule would have produced.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("reports.read")) {
    return NextResponse.json(
      { error: "You do not have permission to run reports" },
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

  const userDb = await createClient();
  const adminDb = createAdminClient();

  const { data: definition, error } = await userDb
    .from("report_definitions")
    .select("id, key, title, cadence, enabled, workspace_id")
    .eq("id", parsed.data.definitionId)
    .eq("workspace_id", session.workspaceId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: `The report definition could not be read: ${error.message}` },
      { status: 400 },
    );
  }

  if (!definition) {
    return NextResponse.json(
      { error: "That report definition is not available to you." },
      { status: 404 },
    );
  }

  const endDate =
    parsed.data.endDate ?? new Date().toISOString().slice(0, 10);

  // The enqueue is wrapped, so a database refusal comes back as a message
  // rather than a 500 with a stack in the response.
  let jobId: string;
  let created: boolean;

  try {
    const queued = await enqueueJob(adminDb, {
      workspaceId: session.workspaceId,
      kind: "reports.generate",
      dedupeKey: `reports.generate:${definition.id}:${endDate}`,
      payload: {
        definitionId: definition.id,
        endDate,
        timezone: session.workspaceTimezone,
        currency: session.workspaceCurrency,
      },
    });

    jobId = queued.id;
    created = queued.created;
  } catch (enqueueError) {
    return NextResponse.json(
      {
        error:
          enqueueError instanceof Error
            ? enqueueError.message
            : "The digest could not be queued.",
      },
      { status: 500 },
    );
  }

  await writeAuditEvent(userDb, {
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: "report.run_requested",
    entityType: "report_definition",
    entityId: definition.id,
    targetLabel: definition.title,
    details: { endDate, jobId, alreadyQueued: !created },
  });

  return NextResponse.json({
    ok: true,
    jobId,
    queued: created,
    message: created
      ? "The digest has been queued and will appear here once it is built."
      : "That digest is already queued for this period.",
  });
}
