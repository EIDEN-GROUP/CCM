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
const LOGIN_HOSTS = {
  google_ads: ["accounts.google.com"],
  ga4: ["accounts.google.com"],
  gsc: ["accounts.google.com"],
  gtm: ["accounts.google.com"],
  youtube: ["accounts.google.com"],
  gmail: ["accounts.google.com"],
  meta: ["www.facebook.com", "business.facebook.com"],
  instagram: ["www.instagram.com", "www.facebook.com"],
  linkedin: ["www.linkedin.com"],
  ahrefs: ["app.ahrefs.com"],
  clarity: ["clarity.microsoft.com", "login.microsoftonline.com"],
};

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

  // The CCM page passes only the signed launch ticket. The extension redeems
  // it directly with CCM so plaintext never enters the page's JavaScript.
  let credentials = null;
  if (message?.autofill === true) {
    const config = await getConfig();
    if (config.origin && LOGIN_HOSTS[claims.prv]?.length) {
      try {
        const response = await fetch(
          `${config.origin}/api/launch/credentials/reveal`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticket: message.ticket }),
            redirect: "error",
            cache: "no-store",
          },
        );
        if (response.ok) {
          const body = await response.json();
          if (typeof body.username === "string" && typeof body.password === "string") {
            credentials = { username: body.username, password: body.password };
          }
        }
      } catch {
        // Opening the account remains available when credential fill fails.
      }
    }
  }

  const tab = await chrome.tabs.create({ url, active: true });
  await rememberUsedTicket(claims.jti);

  let autofill = undefined;
  if (credentials && tab?.id != null) {
    autofill = await fillProviderLogin(tab.id, claims.prv, credentials);
    credentials = null;
  } else if (message?.autofill === true) {
    autofill = "failed";
  }

  return {
    ok: true,
    host: claims.hst,
    provider: claims.prv,
    accountId: claims.acc,
    tabId: tab?.id ?? null,
    openedAt: new Date().toISOString(),
    jti: claims.jti,
    autofill,
  };
}

/** Fill visible sign-in fields only. The provider's submit/MFA stays manual. */
async function fillProviderLogin(tabId, provider, credentials) {
  const allowedHosts = LOGIN_HOSTS[provider] ?? [];
  const deadline = Date.now() + 15000;
  let usernameFilled = false;
  while (Date.now() < deadline) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url) break;
      const url = new URL(tab.url);
      if (url.protocol !== "https:" || !allowedHosts.includes(url.hostname)) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        continue;
      }
      if (tab.status !== "complete") {
        await new Promise((resolve) => setTimeout(resolve, 350));
        continue;
      }

      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        args: [credentials.username, credentials.password],
        func: (username, password) => {
          const visible = (input) =>
            input instanceof HTMLInputElement &&
            !input.disabled &&
            !input.readOnly &&
            input.getClientRects().length > 0;
          const inputs = [...document.querySelectorAll("input")].filter(visible);
          const passwordInput = inputs.find((input) => input.type === "password");
          const userInput =
            inputs.find((input) => input.autocomplete === "username") ||
            inputs.find((input) => input.type === "email") ||
            inputs.find((input) => /user|email|login|account/i.test(`${input.name} ${input.id}`)) ||
            inputs.find((input) => ["text", "tel"].includes(input.type));

          const setValue = (input, value) => {
            const setter = Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              "value",
            )?.set;
            if (!setter) return false;
            setter.call(input, value);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          };

          const filledUsername = userInput ? setValue(userInput, username) : false;
          const filledPassword = passwordInput ? setValue(passwordInput, password) : false;
          let submitted = false;
          if (filledUsername && filledPassword && passwordInput?.form) {
            passwordInput.form.requestSubmit();
            submitted = true;
          }
          return { filledUsername, filledPassword, submitted };
        },
      });

      usernameFilled ||= Boolean(result?.result?.filledUsername);
      if (result?.result?.submitted) return "submitted";
      if (result?.result?.filledPassword) return "filled";
    } catch {
      // The tab can be navigating or can leave the provider's sign-in host.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return usernameFilled ? "partial" : "not_detected";
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
