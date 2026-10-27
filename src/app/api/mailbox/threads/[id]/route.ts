import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mailboxErrorMessage,
  resolveMailbox,
} from "@/lib/mailbox/access";
import { readCustomThread } from "@/lib/mailbox/custom-mail";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  mailboxId: z.string().uuid(),
  /** Whether to read the message bodies from the provider. */
  bodies: z
    .enum(["0", "1"])
    .default("0"),
});

/**
 * Read one thread.
 *
 * The message bodies are fetched from the provider only when they are asked
 * for, and are returned to the caller — never written to Postgres. The
 * metadata is mirrored into `mailbox_threads` so the inbox list can be drawn
 * without a provider round trip, but the preview never leaves the mailbox
 * tables.
 */
export async function GET(
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
  const parsed = querySchema.safeParse({
    mailboxId: url.searchParams.get("mailboxId") ?? undefined,
    bodies: url.searchParams.get("bodies") ?? undefined,
  });

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

  try {
    if (resolution.access.kind === "imap") {
      const result = await readCustomThread(resolution.access.settings, id);
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store, private" } });
    }
    const { connector, accessToken, mailbox } = resolution.access;
    const { thread, messages } = await connector.getThread(id, {
      accessToken,
    });

    const withBodies =
      parsed.data.bodies === "1"
        ? await Promise.all(
            messages.map(async (message) => {
              try {
                const body = await connector.getMessageBody(message.id, {
                  accessToken,
                });
                return { ...message, body: body.text, hasAttachments: body.hasAttachments };
              } catch {
                // A body that cannot be read is reported as unreadable, not
                // silently blank.
                return { ...message, body: null, hasAttachments: false };
              }
            }),
          )
        : messages.map((message) => ({
            ...message,
            body: null,
            hasAttachments: message.hasAttachments,
          }));

    // Mirror the metadata so the list view stays fast. Only metadata is
    // written: no body, no snippet beyond the provider's own short preview.
    await userDb
      .from("mailbox_threads")
      .upsert(
        {
          workspace_id: session.workspaceId,
          mailbox_id: mailbox.id,
          provider_thread_id: thread.id,
          subject: thread.subject,
          snippet: thread.snippet,
          participant_count: thread.participantCount,
          message_count: thread.messageCount,
          is_unread: thread.isUnread,
          is_starred: thread.isStarred,
          has_attachments: thread.labels.includes("ATTACHMENT"),
          last_message_at: thread.lastMessageAt,
          labels: thread.labels,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "mailbox_id,provider_thread_id" },
      );

    return NextResponse.json({
      thread,
      messages: withBodies,
      bodiesIncluded: parsed.data.bodies === "1",
    });
  } catch (error) {
    return NextResponse.json(
      { error: mailboxErrorMessage(error) },
      { status: 502 },
    );
  }
}
