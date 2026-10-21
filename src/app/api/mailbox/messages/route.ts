import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mailboxErrorMessage,
  resolveMailbox,
} from "@/lib/mailbox/access";
import { seal } from "@/lib/sealed";

export const dynamic = "force-dynamic";

/** The purpose the send confirmation is sealed under. */
export const SEND_CONFIRMATION_PURPOSE = "ccm:mailbox-send";

/** How long a prepared send stays confirmable. */
export const SEND_CONFIRMATION_TTL_SECONDS = 300;

const bodySchema = z.object({
  mailboxId: z.string().uuid(),
  to: z.array(z.string().email()).min(1).max(20),
  cc: z.array(z.string().email()).max(20).optional(),
  subject: z.string().min(1).max(500),
  body: z.string().max(50_000),
  /** Set when replying, so the reply lands in the same thread. */
  threadId: z.string().max(500).optional(),
});

/**
 * Prepare a message.
 *
 * Nothing is sent here. A **draft** is created in the provider, and the
 * response carries a sealed confirmation that binds the draft to this user,
 * this mailbox and this recipient for five minutes.
 *
 * The confirmation exists so the interface can show the resolved recipient
 * and the sending identity, and so a send cannot be triggered by a stray
 * request from elsewhere.
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

  const userDb = await createClient();
  const adminDb = createAdminClient();

  const resolution = await resolveMailbox(
    userDb,
    adminDb,
    parsed.data.mailboxId,
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
    const draft = await connector.createDraft(
      {
        to: parsed.data.to,
        cc: parsed.data.cc ?? [],
        subject: parsed.data.subject,
        body: parsed.data.body,
        threadId: parsed.data.threadId ?? null,
      },
      { accessToken },
    );

    const confirmation = seal(SEND_CONFIRMATION_PURPOSE, {
      draftId: draft.id,
      threadId: draft.threadId,
      mailboxId: mailbox.id,
      userId: session.userId,
      workspaceId: session.workspaceId,
      to: parsed.data.to,
      cc: parsed.data.cc ?? [],
      subject: parsed.data.subject,
      issuedAt: Math.floor(Date.now() / 1000),
    });

    // The prepared message is mirrored locally so the interface can show
    // "ready to send" without a provider round trip. The body is **not**
    // stored — only the recipient, the subject and the provider's draft id.
    await userDb.from("mailbox_messages").upsert(
      {
        workspace_id: session.workspaceId,
        mailbox_id: mailbox.id,
        thread_id: draft.threadId,
        provider_message_id: `draft:${draft.id}`,
        subject: parsed.data.subject,
        from_address: mailbox.mailbox_email,
        to_addresses: parsed.data.to,
        cc_addresses: parsed.data.cc ?? [],
        body_storage: "none",
        snippet: null,
        is_unread: false,
        is_draft: true,
        labels: ["DRAFT"],
        source_fetched_at: new Date().toISOString(),
      },
      { onConflict: "mailbox_id,provider_message_id" },
    );

    return NextResponse.json({
      // The interface must show this before anything is sent.
      confirmation,
      draftId: draft.id,
      threadId: draft.threadId,
      from: mailbox.mailbox_email,
      fromLabel: mailbox.display_label,
      to: parsed.data.to,
      cc: parsed.data.cc ?? [],
      subject: parsed.data.subject,
      expiresInSeconds: SEND_CONFIRMATION_TTL_SECONDS,
    });
  } catch (error) {
    return NextResponse.json(
      { error: mailboxErrorMessage(error) },
      { status: 502 },
    );
  }
}
