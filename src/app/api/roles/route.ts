import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  readRoleTabAccess,
  writeRoleTabAccess,
  levelsFromPermissions,
} from "@/lib/permissions/tabs";
import { TABS, TAB_LEVELS } from "@/domain/tabs";
import { ROLES, ROLE_LABELS, type Role } from "@/domain/permissions";
import { writeAuditEvent } from "@/lib/repositories/alerts";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  role: z.enum(ROLES),
  levels: z.record(z.string(), z.enum(TAB_LEVELS)),
});

/**
 * The roles and their tab access.
 *
 * Only somebody who may change roles can read this, because it is the map
 * of what everybody in the workspace may do.
 */
export async function GET() {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("roles.manage")) {
    return NextResponse.json(
      { error: "You do not have permission to manage roles" },
      { status: 403 },
    );
  }

  const db = createAdminClient();

  try {
    const [levels, { data: permissionRows }] = await Promise.all([
      readRoleTabAccess(db),
      db.from("role_permissions").select("role, permission"),
    ]);

    const byRole = new Map<string, string[]>();
    for (const row of (permissionRows ?? []) as Array<{
      role: string;
      permission: string;
    }>) {
      const list = byRole.get(row.role) ?? [];
      list.push(row.permission);
      byRole.set(row.role, list);
    }

    const roles = ROLES.map((role) => {
      const permissions = byRole.get(role) ?? [];

      // A role that has never been edited through the tab interface is
      // shown from the permissions it already holds.
      const roleLevels =
        levels[role] ??
        levelsFromPermissions(role, permissions as never);

      return {
        key: role,
        label: ROLE_LABELS[role],
        permissions: permissions.sort(),
        levels: roleLevels,
        immutable: role === "owner",
      };
    });

    return NextResponse.json({
      tabs: TABS.map((tab) => ({
        key: tab.key,
        labelKey: tab.labelKey,
        section: tab.section,
        ownerOnly: tab.ownerOnly ?? false,
        immutable: tab.immutable ?? false,
      })),
      roles,
    });
  } catch (error) {
    return NextResponse.json(
      { error: explain(error, "The roles could not be read.") },
      { status: 400 },
    );
  }
}

/**
 * Turn a database failure into something the owner can act on.
 *
 * A missing table is the common case after a deployment that predates the
 * tab map, and "relation does not exist" is not something a person can do
 * anything about on its own.
 */
function explain(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("role_tab_access") &&
    (message.includes("does not exist") || message.includes("schema cache"))
  ) {
    return "The tab map is not installed yet. Apply supabase/repair.sql — it creates the role_tab_access table and seeds the levels for every role.";
  }

  if (message.includes("does not exist")) {
    return `${fallback} The database is missing a table this screen needs. Apply supabase/repair.sql.`;
  }

  return message || fallback;
}

/**
 * Change a role's tab access.
 *
 * The permission set is derived from the levels and written in the same
 * operation, so the two cannot disagree.
 *
 * The owner's own role is refused: reducing it would lock the workspace out
 * of its own administration.
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("roles.manage")) {
    return NextResponse.json(
      { error: "You do not have permission to manage roles" },
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

  if (parsed.data.role === "owner") {
    return NextResponse.json(
      {
        error:
          "The owner's access cannot be reduced — the workspace must always be administrable.",
      },
      { status: 400 },
    );
  }

  // Only the tabs the product knows about may be set.
  const known = new Set(TABS.map((tab) => tab.key));
  const unknown = Object.keys(parsed.data.levels).filter(
    (key) => !known.has(key),
  );
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: `Unknown tab(s): ${unknown.join(", ")}` },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  try {
    const permissions = await writeRoleTabAccess(db, {
      role: parsed.data.role as Role,
      levels: parsed.data.levels,
      actorUserId: session.userId,
    });

    await writeAuditEvent(db, {
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: "role.updated",
      entityType: "role",
      entityId: parsed.data.role,
      targetLabel: ROLE_LABELS[parsed.data.role as Role],
      severity: "warning",
      details: { levels: parsed.data.levels, permissions },
    });

    return NextResponse.json({ ok: true, permissions });
  } catch (error) {
    return NextResponse.json(
      { error: explain(error, "The role could not be changed.") },
      { status: 400 },
    );
  }
}
