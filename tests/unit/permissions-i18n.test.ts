import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  isAccountScoped,
  permissionsForRoles,
  roleHasPermission,
} from "@/domain/permissions";
import { MESSAGES, LOCALES, directionFor } from "@/lib/i18n";
import { en } from "@/messages/en";

describe("the permission matrix", () => {
  it("grants every permission to the owner", () => {
    for (const permission of PERMISSIONS) {
      expect(roleHasPermission("owner", permission)).toBe(true);
    }
  });

  it("gives read-only roles no write permission", () => {
    for (const permission of PERMISSIONS) {
      if (permission.endsWith(".read") || permission === "launch.read") {
        continue;
      }
      expect(roleHasPermission("read_only", permission)).toBe(false);
    }
  });

  it("scopes the mailbox role to the inbox only", () => {
    expect(roleHasPermission("mailbox_user", "inbox.read")).toBe(true);
    expect(roleHasPermission("mailbox_user", "inbox.send")).toBe(true);
    expect(roleHasPermission("mailbox_user", "overview.read")).toBe(false);
    expect(roleHasPermission("mailbox_user", "ads.read")).toBe(false);
    expect(roleHasPermission("mailbox_user", "audit.read")).toBe(false);
  });

  it("marks the mailbox role as account scoped", () => {
    expect(isAccountScoped("mailbox_user")).toBe(true);
    expect(isAccountScoped("marketing_analyst")).toBe(false);
  });

  it("does not give the read-only role the ability to launch an account", () => {
    expect(roleHasPermission("read_only", "launch.execute")).toBe(false);
    expect(roleHasPermission("read_only", "launch.read")).toBe(true);
  });

  it("gives the analyst the reporting and launch permissions", () => {
    for (const permission of [
      "reports.read",
      "reports.export",
      "launch.execute",
      "ai.query",
    ] as const) {
      expect(roleHasPermission("marketing_analyst", permission)).toBe(true);
    }
  });

  it("does not give the analyst permission to manage connections", () => {
    expect(roleHasPermission("marketing_analyst", "integrations.manage")).toBe(
      false,
    );
  });

  it("unions the permissions of several roles", () => {
    const permissions = permissionsForRoles(["read_only", "ads_manager"]);
    expect(permissions.has("overview.read")).toBe(true);
    expect(permissions.has("ads.read")).toBe(true);
    expect(permissions.has("inbox.read")).toBe(false);
  });

  it("only lists permissions that exist in the registry", () => {
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  it("gives no role a permission that is not declared", () => {
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });
});

/**
 * Collect every dotted path in a message tree.
 */
function collectPaths(
  value: unknown,
  prefix = "",
): string[] {
  if (typeof value === "string") return [prefix];
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    collectPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("the message catalogues", () => {
  it("defines the same keys in every locale", () => {
    const reference = collectPaths(en).sort();
    for (const locale of LOCALES) {
      const paths = collectPaths(MESSAGES[locale]).sort();
      expect(paths, `locale ${locale}`).toEqual(reference);
    }
  });

  it("has no empty string in any locale", () => {
    for (const locale of LOCALES) {
      for (const path of collectPaths(MESSAGES[locale])) {
        const value = path
          .split(".")
          .reduce<unknown>(
            (node, key) =>
              (node as Record<string, unknown>)[key],
            MESSAGES[locale],
          );
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("marks Arabic as right-to-left and the others as left-to-right", () => {
    expect(directionFor("ar")).toBe("rtl");
    expect(directionFor("en")).toBe("ltr");
    expect(directionFor("fr")).toBe("ltr");
  });
});
