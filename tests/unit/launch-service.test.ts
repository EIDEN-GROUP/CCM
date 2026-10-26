import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { prepareLaunch } from "@/lib/launch/service";
import { resetLaunchKeyCache } from "@/lib/launch/tickets";

let privateKey: string;

beforeAll(async () => {
  const pair = await generateKeyPair("ES256", { extractable: true });
  privateKey = await exportPKCS8(pair.privateKey);
  process.env.LAUNCH_SIGNING_PRIVATE_KEY = privateKey;
  process.env.LAUNCH_SIGNING_PUBLIC_KEY = await exportSPKI(pair.publicKey);
  process.env.LAUNCH_SIGNING_KEY_ID = "launch-service-test";
  resetLaunchKeyCache();
});

afterAll(() => {
  delete process.env.LAUNCH_SIGNING_PRIVATE_KEY;
  delete process.env.LAUNCH_SIGNING_PUBLIC_KEY;
  delete process.env.LAUNCH_SIGNING_KEY_ID;
  resetLaunchKeyCache();
});

describe("prepareLaunch", () => {
  const request = {
    accountId: "account-1",
    mode: "account" as const,
    userId: "user-1",
    workspaceId: "workspace-1",
  };
  const disconnectedAccount = {
    id: "account-1",
    workspaceId: "workspace-1",
    providerKey: "tiktok" as const,
    identifiers: { tiktok: { username: "clinic" } },
    displayLabel: "Clinic TikTok",
    // A disconnected API connection does not remove the saved browser account.
    loginOnly: false,
  };

  it("keeps the account destination available after the API connection is disconnected", async () => {
    const result = await prepareLaunch(request, disconnectedAccount);
    expect(result).toMatchObject({
      ok: true,
      url: "https://www.tiktok.com/@clinic",
      host: "www.tiktok.com",
    });
  });

  it("opens the provider sign-in page before filling a saved login", async () => {
    const result = await prepareLaunch(
      { ...request, credentialLogin: true },
      disconnectedAccount,
    );
    expect(result).toMatchObject({
      ok: true,
      url: "https://www.tiktok.com/login",
      host: "www.tiktok.com",
    });
  });
});
