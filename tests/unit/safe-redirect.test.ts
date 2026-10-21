import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/safe-redirect";

/**
 * The redirect guard.
 *
 * The sign-in form carries a `next` parameter so a person lands back where
 * they were. Without a check, `/login?next=https://evil.test` would send a
 * person who has just typed their password to somebody else's site — a
 * phishing primitive that costs them their session.
 */

describe("the redirect guard", () => {
  it("allows a path within the application", () => {
    expect(safeInternalPath("/overview")).toBe("/overview");
    expect(safeInternalPath("/websites?site=medicalbay.ma")).toBe(
      "/websites?site=medicalbay.ma",
    );
    expect(safeInternalPath("/launcher/setup")).toBe("/launcher/setup");
  });

  it("refuses an absolute address", () => {
    expect(safeInternalPath("https://evil.test")).toBe("/overview");
    expect(safeInternalPath("http://evil.test/steal")).toBe("/overview");
    expect(safeInternalPath("javascript:alert(1)")).toBe("/overview");
  });

  it("refuses a protocol-relative address", () => {
    expect(safeInternalPath("//evil.test")).toBe("/overview");
    expect(safeInternalPath("//evil.test/path")).toBe("/overview");
  });

  it("refuses a backslash, which some browsers normalise to a slash", () => {
    expect(safeInternalPath("/\\evil.test")).toBe("/overview");
    expect(safeInternalPath("\\\\evil.test")).toBe("/overview");
  });

  it("refuses a value with a control character", () => {
    expect(safeInternalPath("/overview\nLocation: https://evil.test")).toBe(
      "/overview",
    );
  });

  it("refuses an empty or missing value", () => {
    expect(safeInternalPath("")).toBe("/overview");
    expect(safeInternalPath("   ")).toBe("/overview");
    expect(safeInternalPath(null)).toBe("/overview");
    expect(safeInternalPath(undefined)).toBe("/overview");
  });

  it("uses the caller's fallback when one is given", () => {
    expect(safeInternalPath("https://evil.test", "/login")).toBe("/login");
    expect(safeInternalPath(null, "/")).toBe("/");
  });
});
