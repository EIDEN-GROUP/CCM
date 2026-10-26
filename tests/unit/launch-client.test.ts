import { afterEach, describe, expect, it, vi } from "vitest";
import { launchAccount } from "@/lib/launch/client";

describe("account launcher fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("opens the normal browser tab when the mapped helper is unavailable", async () => {
    vi.stubEnv("NEXT_PUBLIC_BRIDGE_EXTENSION_ID", "");
    const ticket = {
      url: "https://analytics.google.com/analytics/web/?property=123",
      ticket: "signed-ticket",
      jti: "ticket-id",
      expiresAt: "2099-01-01T00:00:00.000Z",
      host: "analytics.google.com",
      path: "/analytics/web/?property=123",
      accountLabel: "Main property",
      providerKey: "ga4",
      fingerprint: "fingerprint",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/launch/ticket") {
        return new Response(JSON.stringify(ticket), { status: 200 });
      }
      if (String(input) === "/api/launch/result") {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      throw new Error("The local helper is unavailable");
    });
    const open = vi.fn(() => ({ opener: null }));

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { open });

    const result = await launchAccount("account-id", "account", {
      path: "helper",
    });

    expect(result).toMatchObject({ status: "opened", via: "direct" });
    expect(open).toHaveBeenCalledWith(ticket.url, "_blank", "noopener,noreferrer");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/launch/result",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
