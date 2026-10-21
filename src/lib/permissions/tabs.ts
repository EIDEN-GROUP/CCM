import type { Db } from "@/lib/repositories/types";
import {
  TABS,
  permissionsForLevel,
  type TabLevel,
} from "@/domain/tabs";
import {
  PERMISSIONS,
  type Permission,
  type Role,
} from "@/domain/permissions";

/**
 * Turning tab levels into the permissions the database enforces.
 *
 * The owner edits **tabs**; the database authorises on **permissions**. This
 * module is the bridge: it derives the permission set from the tab levels
 * and writes it into `role_permissions`.
 *
 * Two rules protect the workspace from a mistake:
 *
 *   - the owner's own role is never derived. It always holds every
 *     permission, so the workspace can always be administered.
 *   - the owner-only tab grants nothing by derivation. `roles.manage`
 *     belongs to the owner as a role, so handing that tab to the
 *     administrator cannot hand over the authority to change roles.
 */

/** The tab levels of one role, keyed by tab. */
export type TabLevels = Record<string, TabLevel>;

/** Every permission, so the owner role can be built from it. */
const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

/**
 * The permissions a role holds, given its tab levels.
 */
export function derivePermissions(
  role: Role,
  levels: TabLevels,
): Permission[] {
  // The owner is never reduced.
  if (role === "owner") return ALL_PERMISSIONS;

  const permissions = new Set<Permission>();

  for (const tab of TABS) {
    const level = levels[tab.key] ?? "none";
    for (const permission of permissionsForLevel(tab, level)) {
      permissions.add(permission);
    }
  }

  // The owner-only permission is granted by the role, never derived.
  if (role !== "admin") {
    // Any role other than the administrator may be given the people tab,
    // and the people tab's permission is the owner's alone.
    if (levels.people && levels.people !== "none") {
      permissions.add("roles.manage");
    }
  }

  return [...permissions].sort();
}

/**
 * The tab levels of every role.
 */
export async function readRoleTabAccess(
  db: Db,
): Promise<Record<string, TabLevels>> {
  const { data, error } = await db
    .from("role_tab_access")
    .select("role, tab, level");

  if (error) {
    throw new Error(`Could not read the tab access: ${error.message}`);
  }

  const levels: Record<string, TabLevels> = {};

  for (const row of (data ?? []) as Array<{
    role: string;
    tab: string;
    level: TabLevel;
  }>) {
    levels[row.role] = levels[row.role] ?? {};
    levels[row.role]![row.tab] = row.level;
  }

  return levels;
}

/**
 * Save a role's tab levels, and derive its permissions.
 *
 * The two writes are one operation: the tab levels are the input and the
 * permission set is the output, so they must not be able to disagree.
 */
export async function writeRoleTabAccess(
  db: Db,
  options: {
    role: Role;
    levels: TabLevels;
    actorUserId: string | null;
  },
): Promise<Permission[]> {
  const { role, levels, actorUserId } = options;

  // The owner's role is immutable.
  if (role === "owner") {
    throw new Error(
      "The owner's access cannot be reduced — the workspace must always be administrable.",
    );
  }

  const rows = TABS.map((tab) => ({
    role,
    tab: tab.key,
    level: levels[tab.key] ?? ("none" as TabLevel),
    updated_by: actorUserId,
    updated_at: new Date().toISOString(),
  }));

  const { error: accessError } = await db
    .from("role_tab_access")
    .upsert(rows, { onConflict: "role,tab" });

  if (accessError) {
    throw new Error(
      `Could not save the tab access: ${accessError.message}`,
    );
  }

  const permissions = derivePermissions(role, levels);

  // The derived set replaces the old one. The owner's rows are left alone.
  const { error: deleteError } = await db
    .from("role_permissions")
    .delete()
    .eq("role", role);

  if (deleteError) {
    throw new Error(
      `Could not replace the permissions for ${role}: ${deleteError.message}`,
    );
  }

  if (permissions.length > 0) {
    const { error: insertError } = await db
      .from("role_permissions")
      .insert(permissions.map((permission) => ({ role, permission })));

    if (insertError) {
      throw new Error(
        `Could not write the permissions for ${role}: ${insertError.message}`,
      );
    }
  }

  return permissions;
}

/**
 * The levels of a role, read back from the permissions it holds.
 *
 * This is used to show the owner the current state of a role that has never
 * been edited through the tab interface.
 */
export function levelsFromPermissions(
  role: Role,
  permissions: readonly Permission[],
): TabLevels {
  const held = new Set<Permission>(permissions);
  const levels: TabLevels = {};

  for (const tab of TABS) {
    if (tab.ownerOnly) {
      levels[tab.key] = held.has(tab.read) ? "edit" : "none";
      continue;
    }

    const hasRead = held.has(tab.read);
    if (!hasRead) {
      levels[tab.key] = "none";
      continue;
    }

    const hasUse = tab.use.every((permission) => held.has(permission));
    const hasEdit = tab.edit.every((permission) => held.has(permission));

    if (tab.edit.length > 0 && hasEdit && hasUse) levels[tab.key] = "edit";
    else if (tab.use.length > 0 && hasUse) levels[tab.key] = "use";
    else if (tab.use.length === 0 && tab.edit.length === 0) levels[tab.key] = "view";
    else levels[tab.key] = "view";
  }

  return levels;
}
