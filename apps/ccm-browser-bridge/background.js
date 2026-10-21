/**
 * CCM Browser Bridge — background service worker.
 *
 * The extension is deliberately narrow. It accepts exactly one kind of
 * message: "open this signed launch ticket". It:
 *
 *   1. checks the message came from a pinned CCM origin,
 *   2. verifies the ticket signature with the CCM public key,
 *   3. checks the ticket is unexpired, addressed to this audience, and not
 *      already used,
 *   4. checks the destination host is on the provider allowlist,
 *   5. reconstructs the URL from the ticket's host + path, and
 *   6. opens it in a new tab in *this* browser profile.
 *
 * It never accepts a URL from a message. It never asks for cookie,
 * history, password or form-data permissions. It never signs in to anything.
 */

import { verifyEs256, importVerificationKey, JwsError } from "./lib/jws.js";
import { isHostAllowed } from "./lib/allowlist.js";
import {
  ALLOWED_SENDER_ORIGINS,
  AUDIENCE,
  ISSUER,
  TICKET_TTL_SECONDS,
  ensureInstanceId,
  getConfig,
  refreshPublicKey,
} from "./lib/config.js";

const REPLAY_KEY = "ccm.usedTickets";
const MAX_REPLAY_ENTRIES = 200;

class LaunchError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "LaunchError";
    this.code = code;
  }
}

/** Ticket ids already used, so a replayed ticket is refused. */
async function loadReplaySet() {
  const stored = await chrome.storage.session.get(REPLAY_KEY);
  return new Set(stored[REPLAY_KEY] ?? []);
}

async function rememberUsedTicket(jti) {
  const used = await loadReplaySet();
  used.add(jti);
  const trimmed = [...used].slice(-MAX_REPLAY_ENTRIES);
  await chrome.storage.session.set({ [REPLAY_KEY]: trimmed });
}

function senderOriginIsAllowed(sender) {
  const origin = sender?.origin;
  if (!origin) return false;
  return ALLOWED_SENDER_ORIGINS.includes(origin);
}

/**
 * Verify a launch ticket and return its claims.
 */
async function verifyTicket(token) {
  const config = await getConfig();
  if (!config.origin) {
    throw new LaunchError(
      "This extension is not paired with a CCM deployment yet.",
      "not_configured",
    );
  }

  let jwk = config.publicKey;
  if (!jwk) {
    jwk = await refreshPublicKey();
  }

  const key = await importVerificationKey(jwk);
  let claims;
  try {
    claims = await verifyEs256(token, key);
  } catch (error) {
    if (error instanceof JwsError) {
      throw new LaunchError(error.message, error.code);
    }
    throw new LaunchError("The launch ticket could not be verified.", "invalid_ticket");
  }

  if (claims.iss !== ISSUER) {
    throw new LaunchError("The launch ticket has the wrong issuer.", "wrong_issuer");
  }
  if (claims.aud !== AUDIENCE) {
    throw new LaunchError(
      "The launch ticket is addressed to a different audience.",
      "wrong_audience",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp <= now) {
    throw new LaunchError("The launch ticket has expired.", "expired");
  }
  if (typeof claims.iat === "number" && now - claims.iat > TICKET_TTL_SECONDS * 5) {
    throw new LaunchError("The launch ticket is too old to be trusted.", "expired");
  }

  if (typeof claims.jti !== "string" || claims.jti.length === 0) {
    throw new LaunchError("The launch ticket has no identifier.", "invalid_ticket");
  }

  const used = await loadReplaySet();
  if (used.has(claims.jti)) {
    throw new LaunchError("The launch ticket has already been used.", "replayed");
  }

  if (typeof claims.prv !== "string" || !isHostAllowed(claims.prv, claims.hst)) {
    throw new LaunchError(
      "The launch destination is not on the allowlist for this provider.",
      "host_not_allowed",
    );
  }

  return claims;
}

/**
 * Rebuild the destination from the ticket. The URL is never taken from the
 * message body.
 */
function urlFromClaims(claims) {
  if (typeof claims.hst !== "string" || typeof claims.pth !== "string") {
    throw new LaunchError("The launch ticket has no destination.", "invalid_ticket");
  }
  if (!claims.pth.startsWith("/")) {
    throw new LaunchError("The launch ticket has an invalid path.", "invalid_ticket");
  }
  const url = new URL(`https://${claims.hst}${claims.pth}`);
  if (url.protocol !== "https:") {
    throw new LaunchError("Only https destinations are allowed.", "host_not_allowed");
  }
  if (!isHostAllowed(claims.prv, url.hostname)) {
    throw new LaunchError(
      "The launch destination is not on the allowlist for this provider.",
      "host_not_allowed",
    );
  }
  return url.toString();
}

async function handleLaunch(message, sender) {
  if (!senderOriginIsAllowed(sender)) {
    throw new LaunchError(
      "This message did not come from a trusted CCM origin.",
      "unapproved_origin",
    );
  }

  if (typeof message?.ticket !== "string" || message.ticket.length === 0) {
    throw new LaunchError("No launch ticket was supplied.", "invalid_ticket");
  }

  const claims = await verifyTicket(message.ticket);
  const url = urlFromClaims(claims);

  const tab = await chrome.tabs.create({ url, active: true });
  await rememberUsedTicket(claims.jti);

  return {
    ok: true,
    host: claims.hst,
    provider: claims.prv,
    accountId: claims.acc,
    tabId: tab?.id ?? null,
    openedAt: new Date().toISOString(),
    jti: claims.jti,
  };
}

async function handleIdentity(sender) {
  if (!senderOriginIsAllowed(sender)) {
    throw new LaunchError(
      "This message did not come from a trusted CCM origin.",
      "unapproved_origin",
    );
  }
  const instanceId = await ensureInstanceId();
  const config = await getConfig();
  return { ok: true, instanceId, origin: config.origin, pairedAt: config.pairedAt };
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message?.type) {
        case "ccm.launch":
          sendResponse(await handleLaunch(message, sender));
          break;
        case "ccm.identity":
          sendResponse(await handleIdentity(sender));
          break;
        case "ccm.ping":
          sendResponse({ ok: true, instanceId: await ensureInstanceId() });
          break;
        default:
          sendResponse({
            ok: false,
            error: "Unsupported message type.",
            code: "unsupported_message",
          });
      }
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "The launch failed.",
        code: error instanceof LaunchError ? error.code : "unknown_error",
      });
    }
  })();

  // Keep the message channel open for the asynchronous response.
  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  await ensureInstanceId();
});
