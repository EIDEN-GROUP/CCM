"use client";

import { BRIDGE_EXTENSION_ID } from "@/lib/launch/bridge-config";

/**
 * The browser half of the account launcher.
 *
 * Launch order:
 *   1. Ask the server for a signed ticket and the destination URL. The URL
 *      is built on the server; this module never constructs one.
 *   2. If the CCM browser bridge extension answers, hand it the ticket. The
 *      extension verifies the signature and opens the tab in its own profile.
 *   3. Otherwise open the URL directly with `window.open`.
 *   4. Report the outcome so the workspace has an honest audit trail.
 *
 * A successful launch means "a tab was opened". It never means the provider
 * session was authenticated — CCM cannot know that, and says so.
 */

export type LaunchResult =
  | {
      status: "opened";
      via: "extension" | "direct";
      host: string;
      accountLabel: string;
      message: string;
    }
  | {
      status: "blocked";
      via: "direct";
      host: string;
      accountLabel: string;
      message: string;
      /** The URL, so the UI can offer a manual link. */
      url: string;
    }
  | { status: "rejected"; code: string; message: string }
  | { status: "unavailable"; code: string; message: string };

interface TicketResponse {
  url: string;
  ticket: string;
  jti: string;
  expiresAt: string;
  host: string;
  path: string;
  accountLabel: string;
  providerKey: string;
  fingerprint: string;
  credentialsIncluded?: boolean;
}

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        id?: string;
        sendMessage?: (
          extensionId: string,
          message: unknown,
          callback: (response: unknown) => void,
        ) => void;
        lastError?: { message?: string };
      };
    };
  }
}

/** The extension id pinned by the downloadable extension manifest. */
function extensionId(): string | null {
  return BRIDGE_EXTENSION_ID;
}

/**
 * Whether the browser bridge extension is installed and reachable.
 *
 * A missing extension is a normal condition, not an error: CCM falls back to
 * opening a tab directly.
 */
export async function isExtensionAvailable(): Promise<boolean> {
  const id = extensionId();
  if (!id) return false;
  if (!window.chrome?.runtime?.sendMessage) return false;

  return new Promise((resolve) => {
    try {
      window.chrome!.runtime!.sendMessage!(id, { type: "ccm.ping" }, (response) => {
        // Reading lastError suppresses the "unchecked runtime.lastError"
        // console warning when the extension is not installed.
        void window.chrome?.runtime?.lastError;
        resolve(Boolean(response && (response as { ok?: boolean }).ok));
      });
    } catch {
      resolve(false);
    }
  });
}

/** Whether the installed bridge has paired its CCM origin and verification key. */
export async function isExtensionPaired(): Promise<boolean> {
  const id = extensionId();
  if (!id || !window.chrome?.runtime?.sendMessage) return false;

  return new Promise((resolve) => {
    try {
      window.chrome!.runtime!.sendMessage!(id, { type: "ccm.identity" }, (response) => {
        void window.chrome?.runtime?.lastError;
        const identity = response as
          | { ok?: boolean; origin?: string | null; pairedAt?: string | null }
          | undefined;
        resolve(
          Boolean(
            identity?.ok &&
              identity.origin === window.location.origin &&
              identity.pairedAt,
          ),
        );
      });
    } catch {
      resolve(false);
    }
  });
}

/** Ask the extension for its instance id, used to pair a browser profile. */
export async function getExtensionInstanceId(): Promise<string | null> {
  const id = extensionId();
  if (!id) return null;
  if (!window.chrome?.runtime?.sendMessage) return null;

  return new Promise((resolve) => {
    try {
      window.chrome!.runtime!.sendMessage!(id, { type: "ccm.identity" }, (response) => {
        void window.chrome?.runtime?.lastError;
        const value = (response as { instanceId?: string } | undefined)?.instanceId;
        resolve(value ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

interface ExtensionLaunchReply {
  ok: boolean;
  error?: string;
  code?: string;
  host?: string;
  provider?: string;
  tabId?: number | null;
  openedAt?: string;
  autofill?: "submitted" | "filled" | "partial" | "not_detected" | "failed";
}

function sendToExtension(
  id: string,
  ticket: string,
  autofill = false,
): Promise<ExtensionLaunchReply | null> {
  return new Promise((resolve) => {
    try {
      window.chrome!.runtime!.sendMessage!(
        id,
        { type: "ccm.launch", ticket, autofill },
        (response) => {
          void window.chrome?.runtime?.lastError;
          resolve((response as ExtensionLaunchReply | undefined) ?? null);
        },
      );
    } catch {
      resolve(null);
    }
  });
}

async function reportOutcome(
  jti: string,
  outcome: string,
  options: { host?: string; reason?: string; viaExtension: boolean; token?: string },
): Promise<void> {
  try {
    await fetch("/api/launch/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jti,
        outcome,
        token: options.token,
        host: options.host,
        reason: options.reason,
        viaExtension: options.viaExtension,
      }),
    });
  } catch {
    // Reporting is best-effort. A failed report must not break the launch.
  }
}

/** The launch path the account is configured to use. */
export type LaunchPath = "direct" | "extension" | "helper";

export interface LaunchOptions {
  /** Which path to try first. Defaults to the extension, then direct. */
  path?: LaunchPath;
  /** The browser profile directory, for the local helper. */
  profile?: string;
  /** Retrieve the saved login only inside the paired extension. */
  autoFill?: boolean;
}

/**
 * Ask the local helper to open a ticket.
 *
 * The helper is an explicitly installed companion that runs on this machine.
 * It receives the **ticket**, never a URL, and verifies the signature itself.
 */
async function sendToHelper(
  ticket: string,
  profile: string | undefined,
): Promise<{ ok: boolean; error?: string; host?: string } | null> {
  const endpoints = [
    "http://127.0.0.1:8787/launch",
    "http://localhost:8787/launch",
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket, profile }),
        // The helper is on loopback; a short timeout keeps a missing helper
        // from stalling the launch.
        signal: AbortSignal.timeout(4000),
      });

      if (response.status === 404 || response.status === 502) {
        // Not the helper we expected — try the next endpoint.
        continue;
      }

      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        host?: string;
      } | null;

      if (response.ok && body?.ok) {
        return { ok: true, host: body.host };
      }
      return { ok: false, error: body?.error ?? "The helper refused the launch." };
    } catch {
      // The helper is not running. Fall through to the next path.
      continue;
    }
  }

  return null;
}

/**
 * Open an account.
 */
export async function launchAccount(
  accountId: string,
  mode: "account" | "management" = "account",
  options: LaunchOptions = {},
): Promise<LaunchResult> {
  const autoFill = options.autoFill === true && (await isExtensionAvailable());
  let ticket: TicketResponse;
  try {
    const response = await fetch("/api/launch/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, mode, includeCredentials: autoFill }),
    });

    const body = (await response.json().catch(() => null)) as unknown;

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("url" in body) ||
      !("ticket" in body) ||
      !("jti" in body)
    ) {
      const error =
        body && typeof body === "object" && "error" in body
          ? (body as { error?: string; code?: string })
          : null;
      return {
        status: "rejected",
        code: error?.code ?? "request_failed",
        message:
          error?.error ??
          `CCM could not prepare this launch (HTTP ${response.status}).`,
      };
    }
    ticket = body as TicketResponse;
  } catch {
    return {
      status: "unavailable",
      code: "network_error",
      message: "CCM could not reach the server to prepare the launch.",
    };
  }

  const extensionIdValue = extensionId();

  // --- Path 1: the local helper --------------------------------------------
  // Only when the account is explicitly mapped to the helper.
  if (options.path === "helper") {
    const helper = await sendToHelper(ticket.ticket, options.profile);

    if (helper?.ok) {
      await reportOutcome(ticket.jti, "opened", {
        host: helper.host ?? ticket.host,
        viaExtension: false,
        token: ticket.ticket,
      });
      return {
        status: "opened",
        via: "extension",
        host: helper.host ?? ticket.host,
        accountLabel: ticket.accountLabel,
        message:
          "The local helper opened the destination in the mapped browser profile.",
      };
    }

    if (helper && !helper.ok) {
      await reportOutcome(ticket.jti, "rejected_invalid_ticket", {
        host: ticket.host,
        reason: helper.error,
        viaExtension: false,
        token: ticket.ticket,
      });
      return {
        status: "rejected",
        code: "helper_rejected",
        message:
          helper.error ?? "The local helper refused this launch.",
      };
    }

    // A missing helper is a missing convenience, not a reason to strand the
    // user. Continue to the browser bridge and then the normal direct launch.
    // The ticket is still short-lived, signed and scoped to this destination.
  }

  // --- Path 2: the browser bridge extension ---------------------------------
  if (extensionIdValue) {
    const reply = await sendToExtension(
      extensionIdValue,
      ticket.ticket,
      autoFill && ticket.credentialsIncluded === true,
    );

    if (reply?.ok) {
      await reportOutcome(ticket.jti, "opened", {
        host: reply.host ?? ticket.host,
        viaExtension: true,
        token: ticket.ticket,
      });
      return {
        status: "opened",
        via: "extension",
        host: reply.host ?? ticket.host,
        accountLabel: ticket.accountLabel,
        message:
          reply.autofill === "submitted"
            ? "The browser bridge submitted your saved sign-in to the provider. Complete any MFA or CAPTCHA prompt there."
            : reply.autofill === "filled"
              ? "The browser bridge filled the saved sign-in. Review and submit it on the provider page."
              : reply.autofill === "partial"
                ? "The browser bridge filled the username. Continue the provider sign-in; it may ask for your password on the next step."
                : reply.autofill === "failed"
                  ? "The browser bridge opened the destination, but could not fill the saved login. Sign in on the provider page."
                  : reply.autofill === "not_detected"
                    ? "The browser bridge opened the destination. No sign-in form was detected, so the saved login was not used."
                    : "The browser bridge opened the destination in this browser profile.",
      };
    }

    if (reply && reply.ok === false) {
      await reportOutcome(ticket.jti, `rejected_${reply.code ?? "invalid_ticket"}`, {
        host: ticket.host,
        reason: reply.error,
        viaExtension: true,
        token: ticket.ticket,
      });
      return {
        status: "rejected",
        code: reply.code ?? "extension_rejected",
        message:
          reply.error ??
          "The browser bridge refused this launch. See the launch log.",
      };
    }
  }

  // --- Path 3: a direct tab in this browser --------------------------------
  const opened = openTab(ticket.url);

  if (!opened) {
    await reportOutcome(ticket.jti, "blocked", {
      host: ticket.host,
      reason: "The browser blocked the new tab.",
      viaExtension: false,
    });
    return {
      status: "blocked",
      via: "direct",
      host: ticket.host,
      accountLabel: ticket.accountLabel,
      message:
        "The browser blocked the new tab. Allow pop-ups for this site, or use the link below.",
      url: ticket.url,
    };
  }

  await reportOutcome(ticket.jti, "opened", {
    host: ticket.host,
    viaExtension: false,
  });

  return {
    status: "opened",
    via: "direct",
    host: ticket.host,
    accountLabel: ticket.accountLabel,
    message: "A new tab was opened at the configured destination.",
  };
}

/**
 * Open a tab and report whether the browser allowed it.
 *
 * `window.open` returns null when a popup blocker intervenes, which is the
 * only reliable client-side signal available.
 */
function openTab(url: string): boolean {
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (win) {
    win.opener = null;
    return true;
  }
  return false;
}
