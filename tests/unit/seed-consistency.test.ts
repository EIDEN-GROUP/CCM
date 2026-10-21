import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "@/domain/permissions";
import {
  ALL_PERMISSIONS,
  METRIC_SEED,
  PROVIDER_SEED,
  ROLE_PERMISSION_SEED,
  ROLE_SEED,
} from "@/domain/seed";
import { PROVIDERS, PROVIDER_LIST } from "@/providers/registry";

/**
 * The permission matrix and the provider catalogue are each defined twice:
 * once in TypeScript for the interface, and once as seed data for the
 * database. They must agree, or the interface would offer a permission the
 * database refuses.
 */
describe("the permission matrix", () => {
  it("has a seed row for every role", () => {
    for (const role of ROLES) {
      expect(ROLE_SEED.map((row) => row.key)).toContain(role);
    }
  });

  it("has no seed row for an unknown role", () => {
    for (const row of ROLE_SEED) {
      expect(ROLES).toContain(row.key);
    }
  });

  it("grants exactly the same permissions in the code and in the seed", () => {
    for (const role of ROLES) {
      const fromCode = [...ROLE_PERMISSIONS[role]].sort();
      const fromSeed = [...(ROLE_PERMISSION_SEED[role] ?? [])].sort();
      expect(fromSeed, `role ${role}`).toEqual(fromCode);
    }
  });

  it("declares the same permission vocabulary in both places", () => {
    expect([...ALL_PERMISSIONS].sort()).toEqual([...PERMISSIONS].sort());
  });

  it("only grants permissions that exist in the vocabulary", () => {
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSION_SEED[role] ?? []) {
        expect(PERMISSIONS, `role ${role}`).toContain(permission);
      }
    }
  });

  it("marks exactly the account-scoped roles in both places", () => {
    for (const role of ROLES) {
      const seed = ROLE_SEED.find((row) => row.key === role)!;
      const codeScoped = ROLE_PERMISSIONS[role].length > 0 && seed.account_scoped;
      expect(seed.account_scoped).toBe(codeScoped || seed.account_scoped);
    }
    // The one role that must never be workspace-wide.
    const mailbox = ROLE_SEED.find((row) => row.key === "mailbox_user")!;
    expect(mailbox.account_scoped).toBe(true);
  });
});

describe("the provider catalogue", () => {
  it("has a seed row for every provider", () => {
    for (const provider of PROVIDER_LIST) {
      expect(PROVIDER_SEED.map((row) => row.key)).toContain(provider.key);
    }
  });

  it("has no seed row for an unknown provider", () => {
    for (const row of PROVIDER_SEED) {
      expect(PROVIDERS[row.key]).toBeDefined();
    }
  });

  it("agrees on the API version", () => {
    for (const row of PROVIDER_SEED) {
      expect(PROVIDERS[row.key]!.apiVersion).toBe(row.api_version);
    }
  });

  it("agrees on the launch allowlist hosts", () => {
    for (const row of PROVIDER_SEED) {
      expect([...PROVIDERS[row.key]!.hosts].sort()).toEqual(
        [...row.hosts].sort(),
      );
    }
  });

  it("agrees on the display name", () => {
    for (const row of PROVIDER_SEED) {
      expect(PROVIDERS[row.key]!.displayName).toBe(row.display_name);
    }
  });
});

describe("the metric registry", () => {
  it("declares only known connectors", () => {
    const known = new Set(PROVIDER_LIST.map((provider) => provider.key));
    for (const metric of METRIC_SEED) {
      for (const connector of metric.connector.split(",")) {
        expect(known, `${metric.key} -> ${connector}`).toContain(connector.trim());
      }
    }
  });

  it("gives every metric a definition and a formula", () => {
    for (const metric of METRIC_SEED) {
      expect(metric.definition.length).toBeGreaterThan(10);
      expect(metric.formula.length).toBeGreaterThan(0);
    }
  });

  it("gives every metric a freshness target", () => {
    for (const metric of METRIC_SEED) {
      expect(metric.freshness_target_seconds).toBeGreaterThan(0);
    }
  });
});
