import { NextResponse } from "next/server";
import { z } from "zod";
import { decryptSecret } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditEvent } from "@/lib/repositories/alerts";
import { verifyLaunchTicket } from "@/lib/launch/tickets";
import { providerSupportsCredentialFill } from "@/lib/launch/credential-hosts";
import type { ProviderKey } from "@/providers/registry";
import { BRIDGE_EXTENSION_ID } from "@/lib/launch/bridge-config";

export const dynamic = "force-dynamic";

function extensionOrigin() {
  return `chrome-extension://${BRIDGE_EXTENSION_ID}`;
}

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "300",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== extensionOrigin()) {
    return new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(null, { status: 204, headers: cors(origin) });
}

/**
 * One-use handoff for the paired extension. A launch ticket is a narrow,
 * short-lived bearer grant; it cannot be used to read the credential twice.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== extensionOrigin()) {
    return NextResponse.json({ error: "Untrusted extension origin" }, { status: 403 });
  }
  const corsHeaders = cors(origin);
  const parsed = z.object({ ticket: z.string().min(1).max(4096) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credential ticket" }, { status: 400, headers: corsHeaders });
  }

  let ticket;
  try {
    ticket = await verifyLaunchTicket(parsed.data.ticket);
  } catch {
    return NextResponse.json({ error: "Launch ticket is invalid or expired" }, { status: 401, headers: corsHeaders });
  }
  if (!providerSupportsCredentialFill(ticket.prv as ProviderKey)) {
    return NextResponse.json({ error: "Credential fill is not supported for this provider" }, { status: 403, headers: corsHeaders });
  }

  const admin = createAdminClient();
  const { data: grant } = await admin
    .from("account_login_access_tickets")
    .update({ consumed_at: new Date().toISOString() })
    .eq("jti", ticket.jti)
    .eq("account_id", ticket.acc)
    .eq("workspace_id", ticket.wsp)
    .eq("user_id", ticket.sub)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("jti")
    .maybeSingle();
  if (!grant) {
    return NextResponse.json({ error: "Credential ticket was already used or expired" }, { status: 409, headers: corsHeaders });
  }

  const { data: membership } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", ticket.wsp)
    .eq("user_id", ticket.sub)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Workspace access has changed" }, { status: 403, headers: corsHeaders });
  }
  const { data: launchGrant } = await admin
    .from("role_permissions")
    .select("permission")
    .eq("workspace_id", ticket.wsp)
    .eq("role", membership.role)
    .eq("permission", "launch.execute")
    .maybeSingle();
  if (!launchGrant) {
    return NextResponse.json({ error: "Account launch permission is required" }, { status: 403, headers: corsHeaders });
  }

  const { data: account } = await admin
    .from("external_accounts")
    .select("id, workspace_id, provider_key, is_active")
    .eq("id", ticket.acc)
    .eq("workspace_id", ticket.wsp)
    .eq("provider_key", ticket.prv)
    .eq("is_active", true)
    .maybeSingle();
  if (!account) {
    return NextResponse.json({ error: "Account is no longer available" }, { status: 404, headers: corsHeaders });
  }
  const { data: role } = await admin
    .from("roles")
    .select("account_scoped")
    .eq("key", membership.role)
    .maybeSingle();
  if (role?.account_scoped) {
    const { data: accountGrant } = await admin
      .from("external_account_grants")
      .select("external_account_id")
      .eq("external_account_id", ticket.acc)
      .eq("user_id", ticket.sub)
      .eq("permission", "launch.execute")
      .maybeSingle();
    if (!accountGrant) {
      return NextResponse.json({ error: "Account launch access has changed" }, { status: 403, headers: corsHeaders });
    }
  }

  const { data: saved } = await admin
    .from("account_login_credentials")
    .select("username, encrypted_password")
    .eq("account_id", ticket.acc)
    .eq("workspace_id", ticket.wsp)
    .maybeSingle();
  if (!saved) {
    return NextResponse.json({ error: "No saved login is available" }, { status: 404, headers: corsHeaders });
  }

  try {
    const password = decryptSecret(
      saved.encrypted_password,
      `ccm:account-login:v1:${ticket.wsp}:${ticket.acc}`,
    );
    await writeAuditEvent(admin, {
      workspaceId: ticket.wsp,
      actorUserId: ticket.sub,
      action: "launch.credentials_autofill_requested",
      entityType: "external_account",
      entityId: ticket.acc,
      details: { provider: ticket.prv, ticketJti: ticket.jti },
    });
    return NextResponse.json(
      { username: saved.username, password },
      { headers: { ...corsHeaders, "Cache-Control": "no-store, private", Pragma: "no-cache" } },
    );
  } catch {
    return NextResponse.json({ error: "Saved login could not be opened" }, { status: 503, headers: corsHeaders });
  }
}
