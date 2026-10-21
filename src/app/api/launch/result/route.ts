import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import {
  consumeLaunchTicket,
  recordLaunchEvent,
} from "@/lib/repositories/launcher";
import { verifyLaunchTicket } from "@/lib/launch/tickets";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  jti: z.string().uuid(),
  /**
   * The signed ticket itself. The browser bridge extension always sends it so
   * the server can verify the signature cryptographically. A plain web tab
   * reports the outcome without it, and that report is trusted only as far as
   * "the browser said a tab was requested".
   */
  token: z.string().optional(),
  outcome: z.enum([
    "opened",
    "blocked",
    "rejected_expired",
    "rejected_replayed",
    "rejected_host_not_allowed",
    "rejected_invalid_ticket",
    "rejected_wrong_account",
  ]),
  host: z.string().max(253).optional(),
  reason: z.string().max(500).optional(),
  viaExtension: z.boolean().default(false),
});

/**
 * Report the outcome of a launch.
 *
 * Two callers use this endpoint:
 *   - the web app, reporting that a tab was opened (or that the browser
 *     blocked the popup);
 *   - the browser bridge extension, reporting that it received the ticket,
 *     validated it and opened the mapped target.
 *
 * The extension's report is the stronger evidence, because the extension
 * verified the ticket signature and the host allowlist before opening
 * anything. A web-app report says only that a tab was requested.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("launch.execute")) {
    return NextResponse.json(
      { error: "You do not have permission to open accounts" },
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

  const { jti, token, outcome, host, reason, viaExtension } = parsed.data;
  const supabase = await createClient();

  // Verify the ticket cryptographically when the token is supplied. The
  // extension always supplies it; a plain web tab may not, in which case the
  // report is only trusted as far as "the browser requested a tab".
  let signatureVerified = false;
  let ticketAccountId: string | null = null;
  let ticketHost: string | null = null;

  if (token) {
    try {
      const ticket = await verifyLaunchTicket(token);
      signatureVerified = true;
      ticketAccountId = ticket.acc;
      ticketHost = ticket.hst;
    } catch {
      await recordLaunchEvent(supabase, {
        workspaceId: session.workspaceId,
        accountId: null,
        userId: session.userId,
        ticketJti: jti,
        mode: "direct",
        outcome: "rejected_invalid_ticket",
        host: host ?? null,
        reason: "The launch ticket failed signature verification.",
        viaExtension,
      });
      return NextResponse.json(
        { error: "Launch ticket failed verification", code: "rejected_invalid_ticket" },
        { status: 400 },
      );
    }
  }

  // Look up the stored ticket to bind the report to the account and to detect
  // a replay.
  const { data: stored } = await supabase
    .from("launch_tickets")
    .select("jti, account_id, host, user_id, consumed_at, expires_at")
    .eq("jti", jti)
    .maybeSingle();

  if (!stored || stored.user_id !== session.userId) {
    return NextResponse.json(
      { error: "Unknown launch ticket" },
      { status: 404 },
    );
  }

  // When the signature was verified, the ticket's account must match the
  // stored row. A mismatch means the ticket was minted for a different
  // account than the one it is being used against.
  if (signatureVerified && ticketAccountId !== stored.account_id) {
    await recordLaunchEvent(supabase, {
      workspaceId: session.workspaceId,
      accountId: stored.account_id,
      userId: session.userId,
      ticketJti: jti,
      mode: "direct",
      outcome: "rejected_wrong_account",
      host: stored.host,
      reason: "The launch ticket was issued for a different account.",
      viaExtension,
    });
    return NextResponse.json(
      { error: "Launch ticket does not match this account", code: "rejected_wrong_account" },
      { status: 409 },
    );
  }

  // The reported host must be one the provider allows.
  if (host && ticketHost && host !== ticketHost) {
    await recordLaunchEvent(supabase, {
      workspaceId: session.workspaceId,
      accountId: stored.account_id,
      userId: session.userId,
      ticketJti: jti,
      mode: "direct",
      outcome: "rejected_host_not_allowed",
      host,
      reason: `Host "${host}" does not match the ticketed destination.`,
      viaExtension,
    });
    return NextResponse.json(
      { error: "Host does not match the ticketed destination", code: "rejected_host_not_allowed" },
      { status: 400 },
    );
  }

  if (stored.expires_at && Date.parse(stored.expires_at) < Date.now()) {
    await recordLaunchEvent(supabase, {
      workspaceId: session.workspaceId,
      accountId: stored.account_id,
      userId: session.userId,
      ticketJti: jti,
      mode: "direct",
      outcome: "rejected_expired",
      host: stored.host,
      reason: "The launch ticket expired before the outcome was reported.",
      viaExtension,
    });
    return NextResponse.json(
      { error: "Launch ticket expired", code: "rejected_expired" },
      { status: 409 },
    );
  }

  if (stored.consumed_at) {
    await recordLaunchEvent(supabase, {
      workspaceId: session.workspaceId,
      accountId: stored.account_id,
      userId: session.userId,
      ticketJti: jti,
      mode: "direct",
      outcome: "rejected_replayed",
      host: stored.host,
      reason: "The launch ticket was already used.",
      viaExtension,
    });
    return NextResponse.json(
      { error: "Launch ticket already used", code: "rejected_replayed" },
      { status: 409 },
    );
  }

  // A single-use ticket: the first outcome report consumes it.
  const consumed = await consumeLaunchTicket(supabase, jti);
  if (!consumed) {
    return NextResponse.json(
      { error: "Launch ticket already used", code: "rejected_replayed" },
      { status: 409 },
    );
  }

  await recordLaunchEvent(supabase, {
    workspaceId: session.workspaceId,
    accountId: stored.account_id,
    userId: session.userId,
    ticketJti: jti,
    mode: "direct",
    outcome,
    host: host ?? stored.host,
    reason: reason ?? null,
    viaExtension,
  });

  // Update the account's last-known launch state.
  await supabase
    .from("account_launch_profiles")
    .update({ last_launch_result: outcome, last_opened_at: new Date().toISOString() })
    .eq("account_id", stored.account_id);

  return NextResponse.json({
    ok: true,
    signatureVerified,
    ticketAccountId,
    ticketHost,
  });
}
