/**
 * CCM local helper.
 *
 * A small, explicitly installed companion that opens an account in a
 * *specific* browser profile — the case a web page and the browser bridge
 * extension both cannot cover.
 *
 * Its rules, which are the whole point of it existing:
 *
 *   - It binds to 127.0.0.1 only. It is not reachable from the network.
 *   - It accepts a request only from a paired CCM origin.
 *   - It accepts only a **signed launch ticket**. It never accepts a URL.
 *   - It verifies the ticket with the CCM server's public key.
 *   - It checks the destination against its own provider allowlist.
 *   - It opens the browser with the browser's own profile machinery. It never
 *     reads, exports or modifies cookies, passwords or session data.
 *
 * The flow:
 *
 *   1. The owner runs the helper and opens its options page.
 *   2. They enter the CCM origin; the helper fetches the public key from
 *      `<origin>/api/launch/public-key` and pins it.
 *   3. They paste the helper's instance id into CCM, which records the pair.
 *   4. CCM sends the browser a ticket; the browser posts it to
 *      `http://127.0.0.1:8787/launch`; the helper verifies and launches.
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { webcrypto } from "node:crypto";

const { subtle } = webcrypto;

const PORT = Number(process.env.CCM_HELPER_PORT ?? 8787);
const HOST = "127.0.0.1";
const CONFIG_PATH =
  process.env.CCM_HELPER_CONFIG ??
  join(homedir(), ".ccm-helper", "config.json");

/** The provider allowlist, mirroring the main application's registry. */
const PROVIDER_HOSTS = {
  google_ads: ["ads.google.com", "adwords.google.com"],
  ga4: ["analytics.google.com"],
  gsc: ["search.google.com"],
  gtm: ["tagmanager.google.com"],
  youtube: ["studio.youtube.com", "www.youtube.com"],
  gmail: ["mail.google.com"],
  meta: [
    "www.facebook.com",
    "business.facebook.com",
    "graph.facebook.com",
    "www.instagram.com",
  ],
  instagram: ["www.instagram.com", "graph.facebook.com"],
  linkedin: ["www.linkedin.com"],
  ahrefs: ["app.ahrefs.com", "docs.ahrefs.com"],
  clarity: ["clarity.microsoft.com"],
  pagespeed: ["pagespeed.web.dev", "www.googleapis.com"],
  uptime: ["www.google.com"],
};

/**
 * A one-time pairing code.
 *
 * It is printed when the helper starts, so pairing has to be done from the
 * helper's own console. Without it, any page could re-point the helper's
 * trust anchor at a site of its choosing.
 */
const pairingToken = process.env.CCM_HELPER_PAIRING_TOKEN ?? randomBytes(12).toString("base64url");

/** A constant-time comparison of two tokens. */
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

const LAUNCHER = process.env.CCM_HELPER_LAUNCHER ?? defaultLauncher();

function defaultLauncher() {
  const system = platform();
  if (system === "win32") {
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }
  if (system === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  return "/usr/bin/google-chrome";
}

// --- Configuration -----------------------------------------------------------

function readConfig() {
  try {
    if (!existsSync(CONFIG_PATH)) return null;
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeConfig(config) {
  // The configuration directory may not exist yet — this is the first run.
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

/**
 * The instance id is derived from the helper's own public key, so the two
 * sides agree on identity without a shared secret being written down twice.
 */
function instanceIdFromPublicKey(jwk) {
  const material = `${jwk.x}.${jwk.y}`;
  return Buffer.from(material).toString("base64url").slice(0, 32);
}

// --- Ticket verification -----------------------------------------------------

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return Uint8Array.from(Buffer.from(padded, "base64"));
}

/**
 * Verify an ES256 launch ticket with the pinned CCM public key.
 *
 * The signature covers the header and payload segments of the JWS, exactly
 * as JWS specifies.
 */
async function verifyTicket(token, pinnedJwk) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) {
    throw new Error("The launch ticket is malformed.");
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts;

  const header = JSON.parse(
    Buffer.from(base64UrlToBytes(headerSegment)).toString("utf8"),
  );
  if (header.alg !== "ES256") {
    throw new Error(`Unsupported signature algorithm: ${header.alg}`);
  }

  const key = await subtle.importKey(
    "jwk",
    { kty: pinnedJwk.kty, crv: pinnedJwk.crv, x: pinnedJwk.x, y: pinnedJwk.y },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );

  const signed = new TextEncoder().encode(
    `${headerSegment}.${payloadSegment}`,
  );
  const signature = base64UrlToBytes(signatureSegment);

  const valid = await subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    signature,
    signed,
  );
  if (!valid) {
    throw new Error("The launch ticket signature is not valid.");
  }

  const claims = JSON.parse(
    Buffer.from(base64UrlToBytes(payloadSegment)).toString("utf8"),
  );

  if (claims.iss !== "ccm") {
    throw new Error("The launch ticket has the wrong issuer.");
  }
  if (claims.aud !== "ccm-launcher") {
    throw new Error("The launch ticket has the wrong audience.");
  }
  if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) {
    throw new Error("The launch ticket has expired.");
  }

  return claims;
}

// --- Launching ---------------------------------------------------------------

function isHostAllowed(providerKey, host) {
  const hosts = PROVIDER_HOSTS[providerKey];
  if (!hosts) return false;
  return hosts.includes(String(host).toLowerCase());
}

function launchBrowser(url, profileDirectory) {
  const args = [];
  if (profileDirectory) {
    args.push(`--profile-directory=${profileDirectory}`);
  }
  args.push("--new-tab", url);

  const child = spawn(LAUNCHER, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return child.pid ?? null;
}

// --- HTTP server -------------------------------------------------------------

function corsHeaders(origin) {
  const config = readConfig();
  const allowed = config?.origin;
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  if (allowed && origin === allowed) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

function send(response, status, body, origin) {
  response.writeHead(status, corsHeaders(origin));
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin ?? "";
  const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders(origin));
    response.end();
    return;
  }

  // --- Pairing --------------------------------------------------------------
  if (request.method === "GET" && url.pathname === "/pair") {
    const config = readConfig();
    if (!config) {
      send(
        response,
        503,
        { error: "The helper is not paired with a CCM deployment yet." },
        origin,
      );
      return;
    }
    send(
      response,
      200,
      {
        instanceId: config.instanceId,
        origin: config.origin,
        pairedAt: config.pairedAt,
        publicKey: config.publicKey,
      },
      origin,
    );
    return;
  }

  if (request.method === "POST" && url.pathname === "/pair") {
    try {
      const body = JSON.parse((await readBody(request)) || "{}");
      const ccmOrigin = String(body.origin ?? "");
      const presentedToken = String(body.pairingToken ?? "");

      // The pairing code is printed by the helper when it starts and is
      // shown only on its own console. Without it, any page in any browser
      // tab could re-point the helper's trust anchor at a site of its
      // choosing, and the helper would then fetch and pin that site's
      // public key.
      if (!pairingToken || !safeEqual(presentedToken, pairingToken)) {
        send(
          response,
          403,
          {
            error:
              "The pairing code is wrong. It is printed by the helper when it starts.",
          },
          origin,
        );
        return;
      }

      let parsed;
      try {
        parsed = new URL(ccmOrigin);
      } catch {
        send(response, 400, { error: "That is not a valid origin." }, origin);
        return;
      }
      if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
        send(
          response,
          400,
          { error: "The CCM origin must be https (or localhost in development)." },
          origin,
        );
        return;
      }

      // Fetch and pin the CCM public key.
      const keyResponse = await fetch(
        `${ccmOrigin}/api/launch/public-key`,
        { headers: { Accept: "application/json" } },
      );
      if (!keyResponse.ok) {
        send(
          response,
          502,
          { error: "CCM did not return a public key." },
          origin,
        );
        return;
      }
      const publicKey = await keyResponse.json();

      const keyPair = await subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
      );
      const ownJwk = await subtle.exportKey("jwk", keyPair.publicKey);

      const config = {
        origin: ccmOrigin,
        publicKey,
        instanceId: instanceIdFromPublicKey(ownJwk),
        pairedAt: new Date().toISOString(),
      };
      writeConfig(config);

      send(response, 200, config, origin);
    } catch (error) {
      send(
        response,
        500,
        { error: error instanceof Error ? error.message : "Pairing failed." },
        origin,
      );
    }
    return;
  }

  // --- Launch ---------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/launch") {
    const config = readConfig();
    if (!config) {
      send(response, 503, { error: "The helper is not paired." }, origin);
      return;
    }
    if (origin !== config.origin) {
      // A request with **no** Origin header — curl, any local process — is
      // refused too. Only the paired origin may launch anything.
      send(
        response,
        403,
        { error: "This request did not come from the paired CCM deployment." },
        origin,
      );
      return;
    }

    try {
      const body = JSON.parse((await readBody(request)) || "{}");
      const claims = await verifyTicket(body.ticket, config.publicKey);

      const host = String(claims.hst ?? "").toLowerCase();
      if (!isHostAllowed(claims.prv, host)) {
        send(
          response,
          400,
          { error: "The destination is not on the provider allowlist." },
          origin,
        );
        return;
      }

      const path = String(claims.pth ?? "/");
      if (!path.startsWith("/")) {
        send(response, 400, { error: "The launch path is invalid." }, origin);
        return;
      }

      const profileDirectory =
        typeof body.profile === "string" && body.profile.length > 0
          ? body.profile
          : config.defaultProfile ?? "Default";

      const target = `https://${host}${path}`;
      const pid = launchBrowser(target, profileDirectory);

      send(
        response,
        200,
        {
          ok: true,
          host,
          provider: claims.prv,
          accountId: claims.acc,
          profile: profileDirectory,
          pid,
          openedAt: new Date().toISOString(),
        },
        origin,
      );
    } catch (error) {
      send(
        response,
        400,
        { error: error instanceof Error ? error.message : "The launch failed." },
        origin,
      );
    }
    return;
  }

  send(response, 404, { error: "Not found" }, origin);
});

server.listen(PORT, HOST, () => {
  const config = readConfig();
  console.log(`CCM helper listening on http://${HOST}:${PORT}`);
  console.log("");
  console.log(`  Pairing code: ${pairingToken}`);
  console.log(
    "  Pass it with the origin when pairing:",
  );
  console.log(
    `    curl -X POST http://${HOST}:${PORT}/pair -H "Content-Type: application/json" -d '{"origin":"https://your-ccm-origin","pairingToken":"${pairingToken}"}'`,
  );
  console.log("");
  console.log(
    config
      ? `Paired with ${config.origin} (instance ${config.instanceId}).`
      : "Not paired yet.",
  );
});
