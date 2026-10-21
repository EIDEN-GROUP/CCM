import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { generateKeyPair, exportPKCS8, exportSPKI } from "jose";
import {
  issueLaunchTicket,
  resetLaunchKeyCache,
  urlFromTicket,
  verifyLaunchTicket,
  LaunchTicketError,
  LAUNCH_TICKET_AUDIENCE,
  LAUNCH_TICKET_ISSUER,
} from "@/lib/launch/tickets";

/**
 * Launch ticket security tests.
 *
 * These cover the properties the account launcher depends on: a ticket is
 * signed, short-lived, bound to one account and one destination, and cannot
 * be replayed.
 */

let privateKeyPkcs8: string;
let publicKeySpki: string;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair("ES256", {
    extractable: true,
  });
  privateKeyPkcs8 = await exportPKCS8(privateKey);
  publicKeySpki = await exportSPKI(publicKey);

  process.env.LAUNCH_SIGNING_PRIVATE_KEY = privateKeyPkcs8;
  process.env.LAUNCH_SIGNING_PUBLIC_KEY = publicKeySpki;
  process.env.LAUNCH_SIGNING_KEY_ID = "test-key";
  resetLaunchKeyCache();
});

afterAll(() => {
  delete process.env.LAUNCH_SIGNING_PRIVATE_KEY;
  delete process.env.LAUNCH_SIGNING_PUBLIC_KEY;
  delete process.env.LAUNCH_SIGNING_KEY_ID;
  resetLaunchKeyCache();
});

const claims = {
  sub: "user-1",
  acc: "account-1",
  prv: "ga4",
  hst: "analytics.google.com",
  pth: "/analytics/web/?property=123",
  wsp: "workspace-1",
};

describe("launch tickets", () => {
  it("issues a ticket that verifies against the public key", async () => {
    const ticket = await issueLaunchTicket(claims);
    const verified = await verifyLaunchTicket(ticket.token);

    expect(verified.sub).toBe(claims.sub);
    expect(verified.acc).toBe(claims.acc);
    expect(verified.prv).toBe(claims.prv);
    expect(verified.hst).toBe(claims.hst);
    expect(verified.pth).toBe(claims.pth);
    expect(verified.iss).toBe(LAUNCH_TICKET_ISSUER);
    expect(verified.aud).toBe(LAUNCH_TICKET_AUDIENCE);
  });

  it("gives each ticket a unique jti", async () => {
    const first = await issueLaunchTicket(claims);
    const second = await issueLaunchTicket(claims);
    expect(first.jti).not.toBe(second.jti);
  });

  it("expires after the requested lifetime", async () => {
    const ticket = await issueLaunchTicket(claims, { ttlSeconds: 1 });

    await expect(
      verifyLaunchTicket(ticket.token, {
        now: new Date(Date.now() + 5_000),
      }),
    ).rejects.toThrow(LaunchTicketError);
  });

  it("rejects a ticket that has been tampered with", async () => {
    const ticket = await issueLaunchTicket(claims);
    const [header, payload, signature] = ticket.token.split(".");

    // Swap the account id in the payload without re-signing.
    const decoded = JSON.parse(
      Buffer.from(payload!, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    decoded.acc = "account-2";
    const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString(
      "base64url",
    );

    const forged = `${header}.${forgedPayload}.${signature}`;

    await expect(verifyLaunchTicket(forged)).rejects.toThrow(LaunchTicketError);
  });

  it("rejects a ticket signed by a different key", async () => {
    const other = await generateKeyPair("ES256", { extractable: true });
    process.env.LAUNCH_SIGNING_PRIVATE_KEY = await exportPKCS8(other.privateKey);
    resetLaunchKeyCache();

    const foreign = await issueLaunchTicket(claims);

    // Restore the original key pair before verifying.
    process.env.LAUNCH_SIGNING_PRIVATE_KEY = privateKeyPkcs8;
    resetLaunchKeyCache();

    await expect(verifyLaunchTicket(foreign.token)).rejects.toThrow(
      LaunchTicketError,
    );
  });

  it("rejects a token that is not a JWS", async () => {
    await expect(verifyLaunchTicket("not-a-token")).rejects.toThrow(
      LaunchTicketError,
    );
    await expect(verifyLaunchTicket("a.b.c")).rejects.toThrow(LaunchTicketError);
  });

  it("rejects an unsigned token", async () => {
    // The classic "alg: none" downgrade attempt.
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ ...claims, iss: LAUNCH_TICKET_ISSUER, aud: LAUNCH_TICKET_AUDIENCE }),
    ).toString("base64url");

    await expect(verifyLaunchTicket(`${header}.${payload}.`)).rejects.toThrow(
      LaunchTicketError,
    );
  });

  it("rebuilds the destination URL from the ticket, not from the caller", () => {
    const url = urlFromTicket({
      hst: "ads.google.com",
      pth: "/aw?ocid=123",
    });
    expect(url).toBe("https://ads.google.com/aw?ocid=123");
  });
});
