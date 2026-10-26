import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto";
import { getLaunchableAccount } from "@/lib/repositories/launcher";
import { writeAuditEvent } from "@/lib/repositories/alerts";

export const dynamic = "force-dynamic";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    accountId: z.string().uuid(),
    username: z.string().trim().min(1).max(320),
    password: z.string().min(1).max(2048),
  }),
  z.object({ action: z.literal("delete"), accountId: z.string().uuid() }),
]);

function secretContext(workspaceId: string, accountId: string) {
  return `ccm:account-login:v1:${workspaceId}:${accountId}`;
}

/** Return presence only. Plaintext credentials are never sent to the CCM UI. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("launch.read")) {
    return NextResponse.json({ error: "You may not read launcher accounts" }, { status: 403 });
  }

  const accountId = new URL(request.url).searchParams.get("accountId");
  if (!accountId || !z.string().uuid().safeParse(accountId).success) {
    return NextResponse.json({ error: "Invalid account" }, { status: 400 });
  }
  const scoped = await getLaunchableAccount(await createClient(), accountId);
  if (!scoped || scoped.workspaceId !== session.workspaceId) {
    return NextResponse.json({ error: "Account not found or not accessible" }, { status: 404 });
  }

  const admin = createAdminClient();
  const canManage = session.permissions.has("integrations.manage");
  const { data, error } = await admin
    .from("account_login_credentials")
    .select("account_id, username")
    .eq("account_id", accountId)
    .eq("workspace_id", session.workspaceId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not check saved login" }, { status: 503 });
  return NextResponse.json(
    {
      saved: Boolean(data),
      ...(canManage && data ? { username: data.username } : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Save or remove encrypted account login details. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("integrations.manage")) {
    return NextResponse.json({ error: "Managing saved logins requires Integrations edit access" }, { status: 403 });
  }

  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid username and password" }, { status: 400 });
  }

  const scoped = await getLaunchableAccount(await createClient(), parsed.data.accountId);
  if (!scoped || scoped.workspaceId !== session.workspaceId) {
    return NextResponse.json({ error: "Account not found or not accessible" }, { status: 404 });
  }

  const admin = createAdminClient();
  if (parsed.data.action === "delete") {
    const { error } = await admin
      .from("account_login_credentials")
      .delete()
      .eq("account_id", scoped.id)
      .eq("workspace_id", session.workspaceId);
    if (error) return NextResponse.json({ error: "Could not remove the saved login" }, { status: 503 });
  } else {
    let encryptedPassword: string;
    try {
      encryptedPassword = encryptSecret(
        parsed.data.password,
        secretContext(session.workspaceId, scoped.id),
      );
    } catch {
      return NextResponse.json({ error: "Secure credential storage is not configured" }, { status: 503 });
    }

    const { error } = await admin.from("account_login_credentials").upsert(
      {
        account_id: scoped.id,
        workspace_id: session.workspaceId,
        username: parsed.data.username,
        encrypted_password: encryptedPassword,
        updated_by: session.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id" },
    );
    if (error) return NextResponse.json({ error: "Could not save the login details" }, { status: 503 });
  }

  await writeAuditEvent(admin, {
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: parsed.data.action === "save" ? "launch.credentials_saved" : "launch.credentials_removed",
    entityType: "external_account",
    entityId: scoped.id,
    targetLabel: scoped.displayLabel,
    details: { encryptedAtRest: parsed.data.action === "save" },
  });

  return NextResponse.json(
    { ok: true, saved: parsed.data.action === "save" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
