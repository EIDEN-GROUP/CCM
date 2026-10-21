import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES, ROLE_LABELS, type Role } from "@/domain/permissions";
import { writeAuditEvent } from "@/lib/repositories/alerts";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(ROLES),
});

const updateSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(ROLES).optional(),
  status: z.enum(["active", "invited", "suspended"]).optional(),
});

/**
 * The people in the workspace.
 *
 * Only somebody who may change roles can read this: it is the list of who
 * can do what.
 */
export async function GET() {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("roles.manage")) {
    return NextResponse.json(
      { error: "You do not have permission to manage people" },
      { status: 403 },
    );
  }

  const db = createAdminClient();

  try {
    const { data: members, error } = await db
      .from("workspace_members")
      .select("id, user_id, role, status, invited_at, created_at")
      .eq("workspace_id", session.workspaceId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: `The members could not be read: ${error.message}` },
        { status: 400 },
      );
    }

    // The email addresses come from the auth service, which the application
    // cannot read directly through PostgREST.
    const ids = (members ?? []).map(
      (member) => (member as { user_id: string }).user_id,
    );

    const emails = new Map<string, string>();
    if (ids.length > 0) {
      const { data: users } = await db.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      for (const user of users?.users ?? []) {
        if (user.email) emails.set(user.id, user.email);
      }
    }

    return NextResponse.json({
      members: (members ?? []).map((member) => {
        const row = member as {
          id: string;
          user_id: string;
          role: string;
          status: string;
          invited_at: string | null;
          created_at: string;
        };
        return {
          id: row.id,
          userId: row.user_id,
          email: emails.get(row.user_id) ?? null,
          role: row.role,
          roleLabel: ROLE_LABELS[row.role as Role] ?? row.role,
          status: row.status,
          invitedAt: row.invited_at,
          createdAt: row.created_at,
        };
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The members could not be read.",
      },
      { status: 400 },
    );
  }
}

/**
 * Create a person and give them a role.
 *
 * The account is confirmed so the person can sign in with the password
 * that is shown **once**. The password is never stored, never logged and
 * never sent anywhere.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("roles.manage")) {
    return NextResponse.json(
      { error: "You do not have permission to manage people" },
      { status: 403 },
    );
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  // The owner role is not handed out through this screen: there is one
  // owner, and it is the person who made the workspace.
  if (parsed.data.role === "owner") {
    return NextResponse.json(
      { error: "The owner role cannot be assigned here." },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const email = parsed.data.email.trim().toLowerCase();

  const password = generatePassword();

  try {
    const { data: created, error: createError } =
      await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError || !created?.user) {
      const alreadyThere = /already|registered|exists/i.test(
        createError?.message ?? "",
      );
      return NextResponse.json(
        {
          error: alreadyThere
            ? "An account with that email already exists."
            : `The account could not be created: ${createError?.message ?? "unknown"}`,
        },
        { status: 400 },
      );
    }

    const { error: memberError } = await db
      .from("workspace_members")
      .insert({
        workspace_id: session.workspaceId,
        user_id: created.user.id,
        role: parsed.data.role,
        status: "active",
        invited_by: session.userId,
      });

    if (memberError) {
      // The account exists but the membership does not. Say so, so the owner
      // can retry rather than create a second account.
      return NextResponse.json(
        {
          error: `The account was created but the membership failed: ${memberError.message}`,
          userId: created.user.id,
        },
        { status: 400 },
      );
    }

    await writeAuditEvent(db, {
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: "member.created",
      entityType: "workspace_member",
      entityId: created.user.id,
      targetLabel: email,
      severity: "warning",
      details: { role: parsed.data.role },
    });

    return NextResponse.json({
      ok: true,
      userId: created.user.id,
      email,
      password,
      role: parsed.data.role,
      roleLabel: ROLE_LABELS[parsed.data.role],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The person could not be added.",
      },
      { status: 400 },
    );
  }
}

/**
 * Change somebody's role or status.
 *
 * The owner cannot be suspended, and the last owner cannot be removed —
 * a workspace with no owner cannot be administered at all.
 */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("roles.manage")) {
    return NextResponse.json(
      { error: "You do not have permission to manage people" },
      { status: 403 },
    );
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  const { data: target } = await db
    .from("workspace_members")
    .select("id, role, status")
    .eq("workspace_id", session.workspaceId)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json(
      { error: "That person is not in this workspace." },
      { status: 404 },
    );
  }

  const currentRole = (target as { role: string }).role;
  const currentStatus = (target as { status: string }).status;

  // The owner is not removable and not suspendable, and the last owner
  // cannot be demoted.
  if (currentRole === "owner") {
    const isDemoting =
      parsed.data.role !== undefined && parsed.data.role !== "owner";
    const isSuspending = parsed.data.status === "suspended";

    if (isDemoting || isSuspending) {
      return NextResponse.json(
        {
          error:
            "The owner's access cannot be reduced — the workspace must always be administrable.",
        },
        { status: 400 },
      );
    }
  }

  if (
    currentRole === "owner" &&
    parsed.data.role !== undefined &&
    parsed.data.role !== "owner"
  ) {
    return NextResponse.json(
      { error: "The owner role cannot be changed." },
      { status: 400 },
    );
  }

  if (parsed.data.role === "owner") {
    return NextResponse.json(
      { error: "The owner role cannot be assigned here." },
      { status: 400 },
    );
  }

  // The owner may not suspend themselves.
  if (
    parsed.data.userId === session.userId &&
    parsed.data.status === "suspended"
  ) {
    return NextResponse.json(
      { error: "You cannot suspend your own access." },
      { status: 400 },
    );
  }

  const update: {
    role?: string;
    status?: "invited" | "active" | "suspended";
  } = {};
  if (parsed.data.role) update.role = parsed.data.role;
  if (parsed.data.status) update.status = parsed.data.status;

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Nothing to change." },
      { status: 400 },
    );
  }

  const { error } = await db
    .from("workspace_members")
    .update(update)
    .eq("id", (target as { id: string }).id);

  if (error) {
    return NextResponse.json(
      { error: `The membership could not be changed: ${error.message}` },
      { status: 400 },
    );
  }

  await writeAuditEvent(db, {
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: "member.updated",
    entityType: "workspace_member",
    entityId: (target as { id: string }).id,
    targetLabel: parsed.data.userId,
    severity: "warning",
    details: { update, from: { role: currentRole, status: currentStatus } },
  });

  return NextResponse.json({ ok: true, update });
}

/**
 * A strong password.
 *
 * A cryptographic RNG, and an alphabet without the characters that are easy
 * to confuse when it is copied off a screen.
 */
function generatePassword(): string {
  const alphabet =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const size = 20;

  const bytes = randomBytes(size);
  let password = "";
  for (const byte of bytes) {
    password += alphabet[byte % alphabet.length];
  }

  return (
    password.slice(0, 4) +
    "aZ" +
    password.slice(6, 12) +
    "7" +
    password.slice(13)
  );
}
