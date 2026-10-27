import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto";
import { writeAuditEvent } from "@/lib/repositories/alerts";
import { verifyCustomMail } from "@/lib/mailbox/custom-mail";
import type { CustomMailSettings } from "@/lib/mailbox/custom-mail";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().email().max(320),
  displayLabel: z.string().trim().min(1).max(120),
  imapHost: z.string().trim().min(1).max(253),
  imapPort: z.union([z.literal(993), z.literal(143)]),
  imapUsername: z.string().trim().min(1).max(320),
  imapPassword: z.string().min(1).max(2048),
  smtpHost: z.string().trim().min(1).max(253),
  smtpPort: z.union([z.literal(465), z.literal(587)]),
  smtpUsername: z.string().trim().min(1).max(320),
  smtpPassword: z.string().min(1).max(2048),
});

/** Connect a custom-domain mailbox after testing IMAP (receive) and SMTP (send). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!session.permissions.has("integrations.manage")) return NextResponse.json({ error: "You do not have permission to add mailboxes." }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the mailbox address, server settings and passwords." }, { status: 400 });

  const input = parsed.data;
  const settings: CustomMailSettings = {
    email: input.email,
    imapHost: input.imapHost,
    imapPort: input.imapPort,
    imapUsername: input.imapUsername,
    imapPassword: input.imapPassword,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpUsername: input.smtpUsername,
    smtpPassword: input.smtpPassword,
  };

  try {
    await verifyCustomMail(settings);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json({ error: `Could not connect to both mail servers: ${reason}` }, { status: 422 });
  }

  const admin = createAdminClient();
  const connectionId = randomUUID();
  const accountId = randomUUID();
  const mailboxId = randomUUID();
  const context = `provider_connection_credentials:${connectionId}`;
  try {
    // Re-encrypt against the final immutable connection id as authenticated data.
    const envelope = encryptSecret(JSON.stringify({
      imapPassword: input.imapPassword,
      smtpUsername: input.smtpUsername,
      smtpPassword: input.smtpPassword,
    }), context);

    const { error: connectionError } = await admin.from("provider_connections").insert({
      id: connectionId,
      workspace_id: session.workspaceId,
      provider_key: "gmail",
      display_label: `Custom mail — ${input.email}`,
      status: "connected",
      auth_mode: "imap",
      scopes: ["imap.read", "smtp.send"],
    });
    if (connectionError) throw new Error("Could not create the mail connection.");

    const { error: accountError } = await admin.from("external_accounts").insert({
      id: accountId,
      workspace_id: session.workspaceId,
      connection_id: connectionId,
      provider_key: "gmail",
      external_account_id: input.email.toLowerCase(),
      display_label: input.displayLabel,
      identifiers: { gmail: { mailboxEmail: input.email.toLowerCase() } },
      is_active: true,
    });
    if (accountError) throw new Error("Could not create the mailbox account.");

    const { error: grantsError } = await admin.from("external_account_grants").upsert([
      { external_account_id: accountId, user_id: session.userId, permission: "inbox.read", granted_by: session.userId },
      { external_account_id: accountId, user_id: session.userId, permission: "inbox.send", granted_by: session.userId },
    ], { onConflict: "external_account_id,user_id,permission" });
    if (grantsError) throw new Error("Could not grant access to the new mailbox.");

    const { error: secretError } = await admin.from("provider_connection_credentials").insert({
      connection_id: connectionId,
      encrypted_secrets: envelope,
    });
    if (secretError) throw new Error("Could not store encrypted mail server credentials.");

    const { error: mailboxError } = await admin.from("mailbox_connections").insert({
      id: mailboxId,
      workspace_id: session.workspaceId,
      account_id: accountId,
      provider_key: "gmail",
      mailbox_email: input.email.toLowerCase(),
      display_label: input.displayLabel,
      auth_method: "imap",
      host: input.imapHost.toLowerCase(),
      port: input.imapPort,
      username: input.imapUsername,
      smtp_host: input.smtpHost.toLowerCase(),
      smtp_port: input.smtpPort,
      status: "connected",
      scopes: ["imap.read", "smtp.send"],
    });
    if (mailboxError) throw new Error("Could not add the mailbox to the inbox.");

    await writeAuditEvent(admin, {
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: "mailbox.custom_connected",
      entityType: "mailbox",
      entityId: mailboxId,
      targetLabel: input.email.toLowerCase(),
      details: { authMethod: "imap+smtp", credentialsEncrypted: true },
    });
    return NextResponse.json({ ok: true, mailboxId }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await admin.from("mailbox_connections").delete().eq("id", mailboxId);
    await admin.from("external_accounts").delete().eq("id", accountId);
    await admin.from("provider_connections").delete().eq("id", connectionId);
    console.error("could not set up custom mailbox", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not set up this mailbox." }, { status: 503 });
  }
}
