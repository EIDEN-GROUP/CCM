import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { open, seal } from "@/lib/sealed";

/**
 * The sealed token.
 *
 * This is the primitive behind the confirm-before-send flow, so its
 * properties are the security properties of sending mail: a token cannot be
 * forged, edited, replayed at another purpose, or used after it expires.
 */

const KEY = Buffer.alloc(32, 11).toString("base64");

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = KEY;
});

afterAll(() => {
  delete process.env.APP_ENCRYPTION_KEY;
});

describe("sealed tokens", () => {
  it("round-trips a payload", () => {
    const token = seal("ccm:test", { draftId: "d1", to: ["a@b.ma"] });
    const opened = open<{ draftId: string; to: string[] }>(
      "ccm:test",
      token,
      300,
    );
    expect(opened?.draftId).toBe("d1");
    expect(opened?.to).toEqual(["a@b.ma"]);
  });

  it("produces a different ciphertext each time", () => {
    const payload = { draftId: "d1" };
    expect(seal("ccm:test", payload)).not.toBe(seal("ccm:test", payload));
  });

  it("does not leak the payload in clear text", () => {
    const token = seal("ccm:test", { subject: "a private subject" });
    expect(token).not.toContain("private");
  });

  it("refuses a token minted for another purpose", () => {
    const token = seal("ccm:one", { draftId: "d1" });
    expect(open("ccm:two", token, 300)).toBeNull();
  });

  it("refuses a tampered token", () => {
    const token = seal("ccm:test", { draftId: "d1" });
    expect(open("ccm:test", `${token.slice(0, -6)}AAAAAA`, 300)).toBeNull();
  });

  it("refuses an absent or malformed token", () => {
    expect(open("ccm:test", undefined, 300)).toBeNull();
    expect(open("ccm:test", "", 300)).toBeNull();
    expect(open("ccm:test", "not-a-token", 300)).toBeNull();
  });

  it("refuses a token that has expired", () => {
    const token = seal("ccm:test", {
      draftId: "d1",
      issuedAt: Math.floor(Date.now() / 1000) - 3600,
    });
    expect(open("ccm:test", token, 300)).toBeNull();
  });

  it("accepts a token inside its window", () => {
    const token = seal("ccm:test", {
      draftId: "d1",
      issuedAt: Math.floor(Date.now() / 1000) - 10,
    });
    expect(open("ccm:test", token, 300)).not.toBeNull();
  });
});
