import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mailboxErrorMessage,
  resolveMailbox,
} from "@/lib/mailbox/access";
import { setCustomRead, setCustomStar } from "@/lib/mailbox/custom-mail";
import { writeAuditEvent } from "@/lib/repositories/alerts";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  mailboxId: z.string().uuid(),
});

const bodySchema = z.object({
  read: z.boolean().optional(),
  starred: z.boolean().optional(),
});

/**
 * Change a message's state — read or unread, starred or not.
 *
 * The change is applied in the provider, so the mailbox stays consistent
 * whether it is read in CCM or in Gmail.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("inbox.read")) {
    return NextResponse.json(
      { error: "You do not have permission to read mailboxes" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    mailboxId: url.searchParams.get("mailboxId") ?? undefined,
  });
  const parsedBody = bodySchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsedQuery.success || !parsedBody.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const userDb = await createClient();
  const adminDb = createAdminClient();

  const resolution = await resolveMailbox(
    userDb,
    adminDb,
    parsedQuery.data.mailboxId,
    session.workspaceId,
  );

  if (!resolution.ok) {
    return NextResponse.json(
      { error: resolution.error },
      { status: resolution.status },
    );
  }

  if (resolution.access.kind === "imap") {
    try {
      if (parsedBody.data.read !== undefined) await setCustomRead(resolution.access.settings, id, parsedBody.data.read);
      if (parsedBody.data.starred !== undefined) await setCustomStar(resolution.access.settings, id, parsedBody.data.starred);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json({ error: mailboxErrorMessage(error) }, { status: 502 });
    }
  }

  const { connector, accessToken } = resolution.access;

  const add: string[] = [];
  const remove: string[] = [];

  if (parsedBody.data.read === true) remove.push("UNREAD");
  if (parsedBody.data.read === false) add.push("UNREAD");
  if (parsedBody.data.starred === true) add.push("STARRED");
  if (parsedBody.data.starred === false) remove.push("STARRED");

  try {
    await connector.modifyLabels(id, { add, remove }, { accessToken });

    await writeAuditEventSafe(userDb, {
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: "mailbox.message_updated",
      entityType: "mailbox",
      entityId: resolution.access.mailbox.id,
      targetLabel: resolution.access.mailbox.mailbox_email,
      details: { messageId: id, add, remove },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: mailboxErrorMessage(error) },
      { status: 502 },
    );
  }
}

/**
 * The audit write is best effort: a failure to record it must not stop the
 * user's own action from completing, but it is logged.
 */
async function writeAuditEventSafe(
  db: Awaited<ReturnType<typeof createClient>>,
  event: Parameters<typeof writeAuditEvent>[1],
): Promise<void> {
  try {
    await writeAuditEvent(db, event);
  } catch (error) {
    console.error(
      "could not write the audit event",
      error instanceof Error ? error.message : String(error),
    );
  }
}
