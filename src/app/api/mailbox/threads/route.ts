import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mailboxErrorMessage,
  resolveMailbox,
} from "@/lib/mailbox/access";
import { searchCustomThreads } from "@/lib/mailbox/custom-mail";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  mailboxId: z.string().uuid(),
  /** Gmail's own search syntax. */
  q: z.string().max(500).optional(),
  cursor: z.string().max(2000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  label: z.enum(["inbox", "unread", "sent", "drafts", "starred", "spam"]).optional(),
});

/**
 * Search a mailbox.
 *
 * The provider does the searching and the paging; CCM passes the query
 * through and holds nothing but the cursor. The result is never cached, and
 * the snippets that come back are not written to the database by this route.
 */
export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    mailboxId: url.searchParams.get("mailboxId") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
    label: url.searchParams.get("label") ?? undefined,
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
      const page = await searchCustomThreads(resolution.access.settings, {
        query: parsed.data.q?.trim() || undefined,
        cursor: parsed.data.cursor ?? null,
        pageSize: parsed.data.pageSize,
        label: parsed.data.label ?? "inbox",
      });
      return NextResponse.json({
        ...page,
        mailbox: {
          id: resolution.access.mailbox.id,
          email: resolution.access.mailbox.mailbox_email,
          displayLabel: resolution.access.mailbox.display_label,
        },
      }, { headers: { "Cache-Control": "no-store, private" } });
    }
    const { connector, accessToken } = resolution.access;
    const page = await connector.searchThreads(
      {
        query: parsed.data.q?.trim() || undefined,
        cursor: parsed.data.cursor ?? null,
        pageSize: parsed.data.pageSize,
        label: parsed.data.label,
      },
      { accessToken },
    );

    return NextResponse.json({
      threads: page.threads,
      nextCursor: page.nextCursor,
      resultSizeEstimate: page.resultSizeEstimate,
      mailbox: {
        id: resolution.access.mailbox.id,
        email: resolution.access.mailbox.mailbox_email,
        displayLabel: resolution.access.mailbox.display_label,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: mailboxErrorMessage(error) },
      { status: 502 },
    );
  }
}
