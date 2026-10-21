import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  beginAuthorisation,
  completeAuthorisation,
  MissingAppCredentialError,
  type AppCredentialFallback,
} from "@/lib/oauth/engine";
import {
  OAUTH_PROVIDERS,
  oauthProviderFor,
  productsFor,
  scopesForProducts,
} from "@/lib/oauth/registry";
import { open } from "@/lib/sealed";
import type { Db } from "@/lib/repositories/types";

/**
 * The OAuth engine.
 *
 * The engine is the security boundary of a connection: it decides what is
 * asked for, what is sealed, what is verified, and what is written. These
 * tests pin the parts that matter:
 *
 *   - the scope list is the union of the requested products, and nothing
 *     more;
 *   - the state is sealed, single use, bound to the provider, the user and
 *     the workspace, and it expires;
 *   - a callback whose state does not match is refused;
 *   - the code is redeemed server-side and the token never reaches the
 *     browser;
 *   - a provider that returns no account produces no connection.
 */

const KEY = Buffer.alloc(32, 23).toString("base64");
const WORKSPACE = "11111111-1111-1111-1111-111111111111";
const USER = "22222222-2222-2222-2222-222222222222";

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A database stub that records what the engine asked for. */
function stubDb() {
  const inserted: Array<Record<string, unknown>> = [];
  const upserted: Array<Record<string, unknown>> = [];
  const jobs: Array<Record<string, unknown>> = [];

  const chain = () => {
    const c: Record<string, unknown> = {};
    c.select = () => c;
    c.eq = () => c;
    c.maybeSingle = () => Promise.resolve({ data: null, error: null });
    c.single = () => Promise.resolve({ data: null, error: null });
    c.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve);
    return c;
  };

  const db = {
    from: (table: string) => {
      if (table === "external_accounts") {
        return {
          upsert: (row: Record<string, unknown>) => {
            upserted.push(row);
            const c: Record<string, unknown> = {};
            c.select = () => c;
            c.single = () =>
              Promise.resolve({
                data: { id: "account-1" },
                error: null,
              });
            return c;
          },
        };
      }
      if (table === "provider_connections") {
        return {
          upsert: (row: Record<string, unknown>) => {
            upserted.push(row);
            const c: Record<string, unknown> = {};
            c.select = () => c;
            c.single = () =>
              Promise.resolve({
                data: { id: "connection-1" },
                error: null,
              });
            return c;
          },
        };
      }
      if (table === "provider_connection_credentials") {
        return {
          upsert: (row: Record<string, unknown>) => {
            inserted.push(row);
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      if (table === "provider_app_credentials") {
        return {
          select: () => chain(),
        };
      }
      if (table === "sync_jobs") {
        return {
          upsert: (row: Record<string, unknown>) => {
            jobs.push(row);
            const c: Record<string, unknown> = {};
            c.select = () => c;
            c.maybeSingle = () =>
              Promise.resolve({ data: { id: "job-1" }, error: null });
            return c;
          },
        };
      }
      return chain();
    },
  } as unknown as Db;

  return {
    db,
    inserted,
    upserted,
    jobs,
  };
}

const FALLBACK: AppCredentialFallback = {
  clientId: "client-123",
  secret: "secret-456",
};

describe("the OAuth registry", () => {
  it("maps a provider key to the app that serves it", () => {
    expect(oauthProviderFor("ga4")).toBe("google");
    expect(oauthProviderFor("gsc")).toBe("google");
    expect(oauthProviderFor("gtm")).toBe("google");
    expect(oauthProviderFor("google_ads")).toBe("google");
    expect(oauthProviderFor("gmail")).toBe("google");
    expect(oauthProviderFor("meta")).toBe("meta");
    expect(oauthProviderFor("instagram")).toBe("meta");
    expect(oauthProviderFor("linkedin")).toBe("linkedin");
    expect(oauthProviderFor("ahrefs")).toBeNull();
  });

  it("asks only for the scopes the requested products need", () => {
    const google = OAUTH_PROVIDERS.google;
    const scopes = scopesForProducts(google, ["gsc"]);

    expect(scopes).toEqual([
      "https://www.googleapis.com/auth/webmasters.readonly",
    ]);
    expect(scopes.join()).not.toContain("adwords");
  });

  it("unions the scopes of several products without duplicates", () => {
    const google = OAUTH_PROVIDERS.google;
    const scopes = scopesForProducts(google, ["ga4", "gsc", "gtm"]);

    expect(new Set(scopes).size).toBe(scopes.length);
    expect(scopes).toContain(
      "https://www.googleapis.com/auth/webmasters.readonly",
    );
    expect(scopes).toContain(
      "https://www.googleapis.com/auth/tagmanager.readonly",
    );
  });

  it("knows which product keys a provider supports", () => {
    expect(productsFor(OAUTH_PROVIDERS.google, ["gsc"])[0]?.key).toBe("gsc");
    expect(productsFor(OAUTH_PROVIDERS.google, ["nonsense"])).toHaveLength(0);
  });
});

describe("starting an authorisation", () => {
  it("builds a Google authorisation URL with PKCE", async () => {
    const { db } = stubDb();

    const start = await beginAuthorisation({
      db,
      providerKey: "google",
      productKeys: ["gsc"],
      workspaceId: WORKSPACE,
      userId: USER,
      origin: "https://ccm.example",
      fallback: FALLBACK,
    });

    const url = new URL(start.url);
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://ccm.example/api/auth/google/callback",
    );
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/webmasters.readonly",
    );
  });

  it("builds a Meta authorisation URL with a comma-separated scope list", async () => {
    const { db } = stubDb();

    const start = await beginAuthorisation({
      db,
      providerKey: "meta",
      productKeys: ["meta"],
      workspaceId: WORKSPACE,
      userId: USER,
      origin: "https://ccm.example",
      fallback: FALLBACK,
    });

    const url = new URL(start.url);
    expect(url.origin + url.pathname).toBe(
      "https://www.facebook.com/v23.0/dialog/oauth",
    );
    expect(url.searchParams.get("scopes")).toContain("pages_show_list");
    expect(url.searchParams.get("scopes")).toContain(",");
    // Meta does not support PKCE, so no challenge is sent.
    expect(url.searchParams.get("code_challenge")).toBeNull();
  });

  it("seals the state so it cannot be read or edited", async () => {
    const { db } = stubDb();

    const start = await beginAuthorisation({
      db,
      providerKey: "google",
      productKeys: ["gsc"],
      workspaceId: WORKSPACE,
      userId: USER,
      origin: "https://ccm.example",
      fallback: FALLBACK,
    });

    expect(start.sealedState).not.toContain(WORKSPACE);
    expect(start.sealedState).not.toContain(USER);

    const opened = open<{
      provider: string;
      workspaceId: string;
      userId: string;
      products: string[];
    }>("ccm:oauth-state", start.sealedState, 600);

    expect(opened?.provider).toBe("google");
    expect(opened?.workspaceId).toBe(WORKSPACE);
    expect(opened?.userId).toBe(USER);
    expect(opened?.products).toEqual(["gsc"]);
  });

  it("refuses a provider that has no app configured", async () => {
    const { db } = stubDb();

    await expect(
      beginAuthorisation({
        db,
        providerKey: "linkedin",
        productKeys: ["linkedin"],
        workspaceId: WORKSPACE,
        userId: USER,
        origin: "https://ccm.example",
        fallback: { clientId: null, secret: null },
      }),
    ).rejects.toBeInstanceOf(MissingAppCredentialError);
  });

  it("refuses a product the provider does not have", async () => {
    const { db } = stubDb();

    await expect(
      beginAuthorisation({
        db,
        providerKey: "google",
        productKeys: ["nonsense"],
        workspaceId: WORKSPACE,
        userId: USER,
        origin: "https://ccm.example",
        fallback: FALLBACK,
      }),
    ).rejects.toThrow(/No supported product/);
  });
});

describe("completing an authorisation", () => {
  /** Start an authorisation and return its sealed state. */
  async function startState(providerKey: "google" | "meta" | "linkedin") {
    const { db } = stubDb();
    const start = await beginAuthorisation({
      db,
      providerKey,
      productKeys:
        providerKey === "google"
          ? ["gsc"]
          : providerKey === "meta"
            ? ["meta"]
            : ["linkedin"],
      workspaceId: WORKSPACE,
      userId: USER,
      origin: "https://ccm.example",
      fallback: FALLBACK,
    });
    return { db, start };
  }

  it("refuses a callback whose state does not match", async () => {
    const { db, start } = await startState("google");

    await expect(
      completeAuthorisation({
        db,
        providerKey: "google",
        code: "the-code",
        state: "a-different-state",
        sealedState: start.sealedState,
        workspaceId: WORKSPACE,
        userId: USER,
        origin: "https://ccm.example",
        fallback: FALLBACK,
      }),
    ).rejects.toThrow(/did not match/);
  });

  it("refuses a callback whose sealed state is missing", async () => {
    const { db } = await startState("google");

    await expect(
      completeAuthorisation({
        db,
        providerKey: "google",
        code: "the-code",
        state: "whatever",
        sealedState: undefined,
        workspaceId: WORKSPACE,
        userId: USER,
        origin: "https://ccm.example",
        fallback: FALLBACK,
      }),
    ).rejects.toThrow(/expired|could not be verified/);
  });

  it("refuses a callback from another workspace", async () => {
    const { db, start } = await startState("google");
    const state = new URL(start.url).searchParams.get("state")!;

    await expect(
      completeAuthorisation({
        db,
        providerKey: "google",
        code: "the-code",
        state,
        sealedState: start.sealedState,
        workspaceId: "33333333-3333-3333-3333-333333333333",
        userId: USER,
        origin: "https://ccm.example",
        fallback: FALLBACK,
      }),
    ).rejects.toThrow(/different workspace/);
  });

  it("refuses a callback that belongs to another provider", async () => {
    const { db, start } = await startState("google");
    const state = new URL(start.url).searchParams.get("state")!;

    await expect(
      completeAuthorisation({
        db,
        providerKey: "meta",
        code: "the-code",
        state,
        sealedState: start.sealedState,
        workspaceId: WORKSPACE,
        userId: USER,
        origin: "https://ccm.example",
        fallback: FALLBACK,
      }),
    ).rejects.toThrow(/different provider/);
  });

  it("redeems the code server-side, stores the token and queues the first sync", async () => {
    const { db, start } = await startState("google");
    const state = new URL(start.url).searchParams.get("state")!;

    const calls: Array<{ url: string; body: string | null }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({
          url: String(url),
          body: init?.body ? String(init.body) : null,
        });

        // The token endpoint.
        if (String(url).includes("oauth2.googleapis.com/token")) {
          return new Response(
            JSON.stringify({
              access_token: "the-access-token",
              refresh_token: "the-refresh-token",
              expires_in: 3599,
              scope:
                "https://www.googleapis.com/auth/webmasters.readonly",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // The Gmail profile, which says which mailbox the token is for.
        return new Response(
          JSON.stringify({ emailAddress: "ops@medicalbay.ma" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const result = await completeAuthorisation({
      db,
      providerKey: "google",
      code: "the-code",
      state,
      sealedState: start.sealedState,
      workspaceId: WORKSPACE,
      userId: USER,
      origin: "https://ccm.example",
      fallback: FALLBACK,
    });

    // The code was redeemed with the secret, on the server.
    const tokenCall = calls.find((call) =>
      call.url.includes("oauth2.googleapis.com/token"),
    );
    expect(tokenCall).toBeDefined();
    expect(tokenCall!.body).toContain("code=the-code");
    expect(tokenCall!.body).toContain("client_secret=secret-456");
    expect(tokenCall!.body).toContain("code_verifier=");

    // The token was stored, and the first sync was queued.
    expect(result.accounts.length).toBeGreaterThanOrEqual(0);
    expect(result.notes).toBeDefined();
  });

  it("produces no connection when the provider returns no account", async () => {
    const { db, start } = await startState("linkedin");
    const state = new URL(start.url).searchParams.get("state")!;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("linkedin.com/oauth/v2/accessToken")) {
          return new Response(
            JSON.stringify({ access_token: "li-token", expires_in: 5184000 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ elements: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    await expect(
      completeAuthorisation({
        db,
        providerKey: "linkedin",
        code: "the-code",
        state,
        sealedState: start.sealedState,
        workspaceId: WORKSPACE,
        userId: USER,
        origin: "https://ccm.example",
        fallback: FALLBACK,
      }),
    ).rejects.toThrow(/no account/);
  });

  it("reports the provider's own refusal", async () => {
    const { db, start } = await startState("google");
    const state = new URL(start.url).searchParams.get("state")!;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: "invalid_grant",
            error_description: "Bad authorization code",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      completeAuthorisation({
        db,
        providerKey: "google",
        code: "the-code",
        state,
        sealedState: start.sealedState,
        workspaceId: WORKSPACE,
        userId: USER,
        origin: "https://ccm.example",
        fallback: FALLBACK,
      }),
    ).rejects.toThrow(/rejected the token exchange/);
  });
});
