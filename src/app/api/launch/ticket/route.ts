import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import {
  getLaunchableAccount,
  recordLaunchEvent,
} from "@/lib/repositories/launcher";
import { prepareLaunch } from "@/lib/launch/service";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  accountId: z.string().uuid(),
  mode: z.enum(["account", "management"]).default("account"),
});

/**
 * Issue a launch ticket for one account.
 *
 * The client sends only an account id and a mode. The server loads the
 * account's stored identifiers, builds the destination itself, validates the
 * host against the provider allowlist and mints a short-lived signed ticket.
 *
 * A client can therefore never ask CCM to open an arbitrary address.
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

  const supabase = await createClient();
  const account = await getLaunchableAccount(supabase, parsed.data.accountId);

  if (!account) {
    // Deliberately the same response as "no permission": the endpoint must not
    // reveal whether an account id exists.
    return NextResponse.json(
      { error: "Account not found or not accessible" },
      { status: 404 },
    );
  }

  const result = await prepareLaunch(
    {
      accountId: account.id,
      mode: parsed.data.mode,
      userId: session.userId,
      workspaceId: session.workspaceId,
    },
    {
      id: account.id,
      workspaceId: account.workspaceId,
      providerKey: account.providerKey,
      identifiers: account.identifiers,
      displayLabel: account.displayLabel,
    },
  );

  if (!result.ok) {
    await recordLaunchEvent(supabase, {
      workspaceId: session.workspaceId,
      accountId: account.id,
      userId: session.userId,
      ticketJti: null,
      mode: "direct",
      outcome: `rejected_${result.code}`,
      host: null,
      reason: result.message,
      viaExtension: false,
    });

    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: 400 },
    );
  }

  // Persist the ticket so it can be consumed exactly once.
  const { error: ticketError } = await supabase.from("launch_tickets").insert({
    jti: result.jti,
    workspace_id: session.workspaceId,
    account_id: account.id,
    user_id: session.userId,
    provider_key: account.providerKey,
    host: result.host,
    path: result.path,
    mode: "direct",
    expires_at: result.expiresAt,
  });

  if (ticketError) {
    console.error("could not persist launch ticket", ticketError.message);
  }

  await recordLaunchEvent(supabase, {
    workspaceId: session.workspaceId,
    accountId: account.id,
    userId: session.userId,
    ticketJti: result.jti,
    mode: "direct",
    outcome: "issued",
    host: result.host,
    reason: null,
    viaExtension: false,
  });

  return NextResponse.json({
    url: result.url,
    ticket: result.ticket,
    jti: result.jti,
    expiresAt: result.expiresAt,
    host: result.host,
    path: result.path,
    accountLabel: account.displayLabel,
    providerKey: account.providerKey,
    // A fingerprint of the ticket lets the client correlate its launch
    // report with the ticket without sending the ticket itself.
    fingerprint: createHash("sha256")
      .update(result.ticket)
      .digest("hex")
      .slice(0, 12),
  });
}
