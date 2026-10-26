import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto";
import { CREDENTIAL_LOGIN_URLS, providerSupportsCredentialFill } from "@/lib/launch/credential-hosts";
import type { ProviderKey } from "@/providers/registry";
import { getProvider } from "@/providers/registry";
import { writeAuditEvent } from "@/lib/repositories/alerts";

export const dynamic = "force-dynamic";

const credentialProviders = Object.keys(CREDENTIAL_LOGIN_URLS) as [
  ProviderKey,
  ...ProviderKey[],
];

const bodySchema = z.object({
  providerKey: z.enum(credentialProviders),
  displayLabel: z.string().trim().min(1).max(120),
  username: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(2048),
});

/** Create a browser-only launcher account and store its password encrypted. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("integrations.manage")) {
    return NextResponse.json(
      { error: "Adding saved logins requires Integrations edit access" },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose a supported provider and enter an account name, username and password" },
      { status: 400 },
    );
  }

  const { providerKey, displayLabel, username, password } = parsed.data;
  if (!providerSupportsCredentialFill(providerKey) || !CREDENTIAL_LOGIN_URLS[providerKey]) {
    return NextResponse.json(
      { error: "Saved sign-in is not supported for this provider" },
      { status: 400 },
    );
  }

  const accountId = randomUUID();
  let encryptedPassword: string;
  try {
    encryptedPassword = encryptSecret(
      password,
      `ccm:account-login:v1:${session.workspaceId}:${accountId}`,
    );
  } catch {
    return NextResponse.json(
      { error: "Secure credential storage is not configured" },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  const { data: account, error: accountError } = await admin
    .from("external_accounts")
    .insert({
      id: accountId,
      workspace_id: session.workspaceId,
      connection_id: null,
      provider_key: providerKey,
      external_account_id: null,
      display_label: displayLabel,
      identifiers: {},
      is_active: true,
    })
    .select("id")
    .single();

  if (accountError || !account) {
    console.error("could not create browser-only launcher account", accountError?.message);
    return NextResponse.json({ error: "Could not add this account" }, { status: 503 });
  }

  const { error: credentialsError } = await admin
    .from("account_login_credentials")
    .insert({
      account_id: account.id,
      workspace_id: session.workspaceId,
      username,
      encrypted_password: encryptedPassword,
      updated_by: session.userId,
    });

  if (credentialsError) {
    await admin.from("external_accounts").delete().eq("id", account.id);
    console.error("could not save browser-only launcher login", credentialsError.message);
    return NextResponse.json({ error: "Could not save the secure sign-in" }, { status: 503 });
  }

  await writeAuditEvent(admin, {
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: "launch.credentials_account_created",
    entityType: "external_account",
    entityId: account.id,
    targetLabel: displayLabel,
    details: { provider: providerKey, encryptedAtRest: true },
  });

  return NextResponse.json(
    { ok: true, accountId: account.id, provider: getProvider(providerKey).displayName },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
