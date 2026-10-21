import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConnection } from "@/lib/repositories/connections";
import { readCredential } from "@/lib/providers/credentials";
import { checkConnection } from "@/lib/providers/check";
import { updateConnectionStatus } from "@/lib/repositories/connections";
import { writeAuditEvent } from "@/lib/repositories/alerts";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  connectionId: z.string().uuid(),
});

/**
 * Check that a connection really works.
 *
 * The provider is asked, with the stored credential, whether it still
 * accepts it. The answer is recorded on the connection, so the Integrations
 * screen shows a connection that has been verified rather than one that
 * merely says "connected".
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("integrations.manage")) {
    return NextResponse.json(
      { error: "You do not have permission to check connections" },
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

  const admin = createAdminClient();
  const userDb = await createClient();

  const connection = await getConnection(admin, parsed.data.connectionId);
  if (!connection || connection.workspace_id !== session.workspaceId) {
    return NextResponse.json(
      { error: "Connection not found" },
      { status: 404 },
    );
  }

  const credential = await readCredential(admin, connection.id);
  if (!credential?.secrets.accessToken) {
    return NextResponse.json(
      {
        error:
          "This connection has no stored credential. Re-authorise it from Integrations.",
      },
      { status: 409 },
    );
  }

  const { data: accounts } = await userDb
    .from("external_accounts")
    .select("id, external_account_id, display_label, identifiers")
    .eq("connection_id", connection.id)
    .limit(1);

  const account = (accounts ?? [])[0] as
    | {
        id: string;
        external_account_id: string | null;
        display_label: string;
        identifiers: Record<string, unknown>;
      }
    | undefined;

  const result = await checkConnection({
    db: admin,
    providerKey: connection.provider_key,
    accessToken: credential.secrets.accessToken,
    account: {
      externalAccountId: account?.external_account_id ?? connection.id,
      displayLabel: account?.display_label ?? connection.display_label,
      identifiers: account?.identifiers ?? {},
      timezone: null,
      currency: null,
    },
  });

  await updateConnectionStatus(admin, connection.id, {
    status: result.ok ? "connected" : "token_refresh_failed",
    errorCode: result.ok ? null : result.code,
    errorMessage: result.ok ? null : result.detail,
  });

  await writeAuditEvent(userDb, {
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: "connection.checked",
    entityType: "provider_connection",
    entityId: connection.id,
    targetLabel: connection.display_label,
    severity: result.ok ? "info" : "warning",
    details: {
      ok: result.ok,
      code: result.code,
      accounts: result.accounts.length,
    },
  });

  return NextResponse.json(result);
}
