import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteAppCredential,
  listAppCredentials,
  readAppCredential,
  writeAppCredential,
} from "@/lib/providers/app-credentials";
import type { Db } from "@/lib/repositories/types";

/**
 * The provider app credential store.
 *
 * The secret is the owner's app secret. It is encrypted before it is
 * stored, it is never returned by a listing, and it is bound to its row so
 * it cannot be moved to another provider.
 */

const KEY = Buffer.alloc(32, 41).toString("base64");
const WORKSPACE = "44444444-4444-4444-4444-444444444444";

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = KEY;
});

afterAll(() => {
  delete process.env.APP_ENCRYPTION_KEY;
});

interface StoredRow {
  id: string;
  workspace_id: string;
  provider_key: string;
  client_id: string;
  encrypted_secret: string | null;
  key_fingerprint: string | null;
  redirect_uri: string | null;
  scopes: string[];
  notes: string | null;
  updated_at: string;
}

/** A database stub that behaves like the table. */
function stubDb() {
  const rows = new Map<string, StoredRow>();
  let counter = 0;

  const db = {
    from: (table: string) => {
      if (table !== "provider_app_credentials") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
      }

      return {
        select: () => {
          const chain: Record<string, unknown> = {};
          chain.eq = (column: string, value: unknown) => {
            chain._filters = [
              ...((chain._filters as Array<[string, unknown]>) ?? []),
              [column, value],
            ];
            return chain;
          };
          chain.order = () => chain;
          chain.maybeSingle = () => {
            const filters = (chain._filters ?? []) as Array<[string, unknown]>;
            const match = [...rows.values()].find((row) =>
              filters.every(([column, value]) => row[column as keyof StoredRow] === value),
            );
            return Promise.resolve({ data: match ?? null, error: null });
          };
          chain.then = (resolve: (value: unknown) => unknown) => {
            const filters = (chain._filters ?? []) as Array<[string, unknown]>;
            const data = [...rows.values()].filter((row) =>
              filters.every(([column, value]) => row[column as keyof StoredRow] === value),
            );
            return Promise.resolve({ data, error: null }).then(resolve);
          };
          return chain;
        },

        insert: (row: Record<string, unknown>) => {
          counter += 1;
          const created: StoredRow = {
            id: `row-${counter}`,
            workspace_id: String(row.workspace_id),
            provider_key: String(row.provider_key),
            client_id: String(row.client_id),
            encrypted_secret: null,
            key_fingerprint: null,
            redirect_uri: (row.redirect_uri as string) ?? null,
            scopes: (row.scopes as string[]) ?? [],
            notes: (row.notes as string) ?? null,
            updated_at: String(row.updated_at),
          };
          rows.set(created.id, created);
          const c: Record<string, unknown> = {};
          c.select = () => c;
          c.single = () => Promise.resolve({ data: created, error: null });
          return c;
        },

        update: (patch: Record<string, unknown>) => {
          const chain: Record<string, unknown> = {};
          chain.eq = (column: string, value: unknown) => {
            const match = [...rows.values()].find(
              (row) => row[column as keyof StoredRow] === value,
            );
            if (match) Object.assign(match, patch);
            return Promise.resolve({ data: match ?? null, error: null });
          };
          return chain;
        },

        delete: () => {
          const chain: Record<string, unknown> = {};
          chain.eq = (column: string, value: unknown) => {
            for (const [id, row] of [...rows.entries()]) {
              if (row[column as keyof StoredRow] === value) rows.delete(id);
            }
            return chain;
          };
          chain.then = (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null }).then(resolve);
          return chain;
        },
      };
    },
  } as unknown as Db;

  return { db, rows };
}

describe("the provider app credential store", () => {
  it("stores a credential and reads it back", async () => {
    const { db } = stubDb();

    await writeAppCredential(db, {
      workspaceId: WORKSPACE,
      providerKey: "meta",
      clientId: "app-123",
      secret: "the-app-secret",
      redirectUri: "https://ccm.example/api/auth/meta/callback",
    });

    const stored = await readAppCredential(db, WORKSPACE, "meta");

    expect(stored).not.toBeNull();
    expect(stored!.clientId).toBe("app-123");
    expect(stored!.secret).toBe("the-app-secret");
    expect(stored!.redirectUri).toBe(
      "https://ccm.example/api/auth/meta/callback",
    );
  });

  it("encrypts the secret at rest", async () => {
    const { db, rows } = stubDb();

    await writeAppCredential(db, {
      workspaceId: WORKSPACE,
      providerKey: "meta",
      clientId: "app-123",
      secret: "the-app-secret",
    });

    const row = [...rows.values()][0]!;
    expect(row.encrypted_secret).toBeTruthy();
    expect(row.encrypted_secret).not.toContain("the-app-secret");
    expect(row.key_fingerprint).toBeTruthy();
  });

  it("never returns a secret from a listing", async () => {
    const { db } = stubDb();

    await writeAppCredential(db, {
      workspaceId: WORKSPACE,
      providerKey: "linkedin",
      clientId: "client-999",
      secret: "the-linkedin-secret",
    });

    const listed = await listAppCredentials(db, WORKSPACE);

    expect(listed).toHaveLength(1);
    expect(listed[0]?.clientId).toBe("client-999");
    expect(listed[0]?.hasSecret).toBe(true);
    // The secret itself is not in the listing.
    expect(JSON.stringify(listed)).not.toContain("the-linkedin-secret");
  });

  it("leaves the stored secret alone when none is given", async () => {
    const { db } = stubDb();

    await writeAppCredential(db, {
      workspaceId: WORKSPACE,
      providerKey: "meta",
      clientId: "app-123",
      secret: "the-app-secret",
    });

    await writeAppCredential(db, {
      workspaceId: WORKSPACE,
      providerKey: "meta",
      clientId: "app-456",
    });

    const stored = await readAppCredential(db, WORKSPACE, "meta");
    expect(stored!.clientId).toBe("app-456");
    expect(stored!.secret).toBe("the-app-secret");
  });

  it("clears the secret when an empty one is given", async () => {
    const { db } = stubDb();

    await writeAppCredential(db, {
      workspaceId: WORKSPACE,
      providerKey: "meta",
      clientId: "app-123",
      secret: "the-app-secret",
    });

    await writeAppCredential(db, {
      workspaceId: WORKSPACE,
      providerKey: "meta",
      clientId: "app-123",
      secret: null,
    });

    const stored = await readAppCredential(db, WORKSPACE, "meta");
    expect(stored!.secret).toBeNull();
  });

  it("removes a credential", async () => {
    const { db } = stubDb();

    await writeAppCredential(db, {
      workspaceId: WORKSPACE,
      providerKey: "meta",
      clientId: "app-123",
      secret: "the-app-secret",
    });

    await deleteAppCredential(db, WORKSPACE, "meta");

    expect(await readAppCredential(db, WORKSPACE, "meta")).toBeNull();
    expect(await listAppCredentials(db, WORKSPACE)).toHaveLength(0);
  });

  it("keeps one provider's secret out of another's row", async () => {
    const { db, rows } = stubDb();

    await writeAppCredential(db, {
      workspaceId: WORKSPACE,
      providerKey: "meta",
      clientId: "app-123",
      secret: "the-meta-secret",
    });

    await writeAppCredential(db, {
      workspaceId: WORKSPACE,
      providerKey: "linkedin",
      clientId: "client-999",
      secret: "the-linkedin-secret",
    });

    const [metaRow, linkedInRow] = [...rows.values()] as [StoredRow, StoredRow];
    expect(metaRow.encrypted_secret).not.toBe(linkedInRow.encrypted_secret);

    // And the wrong provider's secret does not decrypt this row.
    const stored = await readAppCredential(db, WORKSPACE, "linkedin");
    expect(stored!.secret).toBe("the-linkedin-secret");
  });
});
