import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mailboxErrorMessage,
  resolveMailbox,
} from "@/lib/mailbox/access";
import { open } from "@/lib/sealed";
import { writeAuditEvent } from "@/lib/repositories/alerts";
import {
  SEND_CONFIRMATION_PURPOSE,
  SEND_CONFIRMATION_TTL_SECONDS,
} from "@/app/api/mailbox/messages/route";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  confirmation: z.string().min(20).max(4000),
});

type SendConfirmation = {
  draftId: string;
  threadId: string;
  mailboxId: string;
  userId: string;
  workspaceId: string;
  to: string[];
  cc: string[];
  subject: string;
  issuedAt?: number;
};

/**
 * Confirm and send.
 *
 * This is the only route that sends. It requires a confirmation that was
 * sealed by the prepare route, that names this user and this workspace, and
 * that is less than five minutes old. The mailbox is re-resolved through
 * Row Level Security, so a mailbox the user has since lost access to cannot
 * be sent from.
 *
 * Every send is written to the audit log with the recipient, so the trail
 * shows who sent what and from where.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("inbox.send")) {
    return NextResponse.json(
      { error: "You do not have permission to send mail" },
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

  const confirmation = open<SendConfirmation>(
    SEND_CONFIRMATION_PURPOSE,
    parsed.data.confirmation,
    SEND_CONFIRMATION_TTL_SECONDS,
  );

  if (!confirmation) {
    return NextResponse.json(
      {
        error:
          "The confirmation has expired or is not valid. Prepare the message again.",
      },
      { status: 400 },
    );
  }

  // The confirmation is bound to the person who prepared it and to the
  // workspace it was prepared in.
  if (confirmation.userId !== session.userId) {
    return NextResponse.json(
      { error: "This confirmation belongs to another user." },
      { status: 403 },
    );
  }
  if (confirmation.workspaceId !== session.workspaceId) {
    return NextResponse.json(
      { error: "This confirmation belongs to another workspace." },
      { status: 403 },
    );
  }

  const userDb = await createClient();
  const adminDb = createAdminClient();

  const resolution = await resolveMailbox(
    userDb,
    adminDb,
    confirmation.mailboxId,
    session.workspaceId,
  );

  if (!resolution.ok) {
    return NextResponse.json(
      { error: resolution.error },
      { status: resolution.status },
    );
  }

  const { connector, accessToken, mailbox } = resolution.access;

  try {
    const sent = await connector.sendDraft(confirmation.draftId, {
      accessToken,
    });

    // The local mirror of the draft is replaced by the sent message.
    await userDb
      .from("mailbox_messages")
      .update({
        provider_message_id: sent.id,
        is_draft: false,
        labels: ["SENT"],
        sent_at: new Date().toISOString(),
        source_fetched_at: new Date().toISOString(),
      })
      .eq("mailbox_id", mailbox.id)
      .eq("provider_message_id", `draft:${confirmation.draftId}`);

    await writeAuditEvent(userDb, {
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: "mailbox.sent",
      entityType: "mailbox",
      entityId: mailbox.id,
      targetLabel: mailbox.mailbox_email,
      details: {
        to: confirmation.to,
        cc: confirmation.cc,
        // The subject is **not** recorded. A subject line is mailbox content
        // and can carry a patient's name; the audit log is not the place for
        // it. The recipient and the provider's message id are enough to trace
        // the send.
        providerMessageId: sent.id,
        providerThreadId: sent.threadId,
      },
    });

    return NextResponse.json({
      ok: true,
      messageId: sent.id,
      threadId: sent.threadId,
      from: mailbox.mailbox_email,
      to: confirmation.to,
      subject: confirmation.subject,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: mailboxErrorMessage(error) },
      { status: 502 },
    );
  }
}
