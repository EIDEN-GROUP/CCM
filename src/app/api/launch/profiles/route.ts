import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/repositories/alerts";
import { getLaunchableAccount } from "@/lib/repositories/launcher";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  accountId: z.string().uuid(),
  launchMode: z.enum(["direct", "extension", "helper"]),
  browserProfileLabel: z.string().max(120).nullable().optional(),
  browserProfileDirectory: z.string().max(120).nullable().optional(),
  extensionInstanceId: z.string().max(120).nullable().optional(),
});

/**
 * Save the account → browser profile mapping.
 *
 * The mapping decides which browser profile a launch targets, so a change is
 * recorded in the audit log. It never stores a cookie, a token or a URL
 * parameter.
 */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (
    !session.permissions.has("integrations.manage") &&
    !session.permissions.has("launch.execute")
  ) {
    return NextResponse.json(
      { error: "You do not have permission to change launch mappings" },
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
  if (!account || account.workspaceId !== session.workspaceId) {
    return NextResponse.json(
      { error: "Account not found or not accessible" },
      { status: 404 },
    );
  }

  const status =
    parsed.data.launchMode === "extension"
      ? parsed.data.extensionInstanceId
        ? "ready"
        : "extension_not_paired"
      : parsed.data.launchMode === "helper"
        ? parsed.data.browserProfileDirectory
          ? "ready"
          : "profile_unmapped"
        : parsed.data.browserProfileLabel
          ? "ready"
          : "profile_unmapped";

  const { error } = await supabase.from("account_launch_profiles").upsert(
    {
      account_id: account.id,
      workspace_id: account.workspaceId,
      launch_mode: parsed.data.launchMode,
      status,
      browser_profile_label: parsed.data.browserProfileLabel ?? null,
      browser_profile_directory: parsed.data.browserProfileDirectory ?? null,
      extension_instance_id: parsed.data.extensionInstanceId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id" },
  );

  if (error) {
    return NextResponse.json(
      { error: `Could not save the mapping: ${error.message}` },
      { status: 400 },
    );
  }

  await writeAuditEvent(supabase, {
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: "launch.profile_mapped",
    entityType: "external_account",
    entityId: account.id,
    targetLabel: account.displayLabel,
    details: {
      launchMode: parsed.data.launchMode,
      browserProfileLabel: parsed.data.browserProfileLabel ?? null,
      // The instance id is an opaque browser identifier, not a credential.
      extensionPaired: Boolean(parsed.data.extensionInstanceId),
    },
  });

  return NextResponse.json({ ok: true, status });
}
