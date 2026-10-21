import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openState, sealState } from "@/lib/oauth/state";
import {
  base64Url,
  createPkcePair,
  googleScopesFor,
  safeEqual,
} from "@/lib/oauth/google";

/**
 * The OAuth state and PKCE helpers.
 *
 * These protect the authorisation round trip: the `state` nonce stops a
 * callback being replayed into the wrong request, and PKCE stops an
 * intercepted authorisation code from being redeemed.
 */

const KEY = Buffer.alloc(32, 7).toString("base64");

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = KEY;
});

afterAll(() => {
  delete process.env.APP_ENCRYPTION_KEY;
});

describe("PKCE", () => {
  it("produces a verifier and a matching challenge", () => {
    const pair = createPkcePair();
    expect(pair.method).toBe("S256");
    expect(pair.verifier.length).toBeGreaterThan(40);
    expect(pair.challenge).not.toBe(pair.verifier);
    expect(pair.challenge.length).toBe(43);
  });

  it("produces a different pair each time", () => {
    expect(createPkcePair().verifier).not.toBe(createPkcePair().verifier);
  });
});

describe("constant-time comparison", () => {
  it("matches equal values", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
  });

  it("rejects different values", () => {
    expect(safeEqual("abc", "abd")).toBe(false);
  });

  it("rejects different lengths", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("sealed OAuth state", () => {
  const payload = {
    state: "nonce-123",
    codeVerifier: "verifier-abc",
    products: ["ga4", "gsc"],
    workspaceId: "workspace-1",
    startedAt: Math.floor(Date.now() / 1000),
  };

  it("round-trips a payload", () => {
    const sealed = sealState(payload);
    const opened = openState(sealed);
    expect(opened).not.toBeNull();
    expect(opened!.state).toBe(payload.state);
    expect(opened!.codeVerifier).toBe(payload.codeVerifier);
    expect(opened!.products).toEqual(payload.products);
    expect(opened!.workspaceId).toBe(payload.workspaceId);
  });

  it("produces a different ciphertext each time", () => {
    expect(sealState(payload)).not.toBe(sealState(payload));
  });

  it("refuses a tampered value", () => {
    const sealed = sealState(payload);
    const tampered = `${sealed.slice(0, -4)}AAAA`;
    expect(openState(tampered)).toBeNull();
  });

  it("refuses an empty or absent value", () => {
    expect(openState(undefined)).toBeNull();
    expect(openState("")).toBeNull();
    expect(openState("not-sealed-at-all")).toBeNull();
  });

  it("refuses a payload that is too old", () => {
    const sealed = sealState({
      ...payload,
      startedAt: Math.floor(Date.now() / 1000) - 3600,
    });
    expect(openState(sealed)).toBeNull();
  });
});

describe("scopes", () => {
  it("asks only for the products that were requested", () => {
    const scopes = googleScopesFor(["gsc"]);
    expect(scopes).toEqual(["https://www.googleapis.com/auth/webmasters.readonly"]);
  });

  it("unions the scopes for several products without duplicates", () => {
    const scopes = googleScopesFor(["ga4", "gsc", "gtm"]);
    expect(new Set(scopes).size).toBe(scopes.length);
    expect(scopes).toContain("https://www.googleapis.com/auth/webmasters.readonly");
    expect(scopes).toContain("https://www.googleapis.com/auth/tagmanager.readonly");
  });

  it("requests the Gmail scopes together", () => {
    const scopes = googleScopesFor(["gmail"]);
    expect(scopes).toContain("https://www.googleapis.com/auth/gmail.readonly");
    expect(scopes).toContain("https://www.googleapis.com/auth/gmail.send");
  });
});

describe("base64url", () => {
  it("produces a url-safe value without padding", () => {
    const value = base64Url(Buffer.from([251, 255, 190, 0]));
    expect(value).not.toContain("+");
    expect(value).not.toContain("/");
    expect(value).not.toContain("=");
  });
});
