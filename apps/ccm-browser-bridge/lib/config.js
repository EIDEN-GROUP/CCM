/**
 * Extension configuration and instance identity.
 *
 * The extension stores only:
 *   - the CCM origin it trusts,
 *   - the CCM extension id (not needed, but shown for diagnostics),
 *   - a randomly generated instance id used to pair this browser profile with
 *     a CCM account, and
 *   - the cached CCM public verification key.
 *
 * It never stores provider cookies, passwords, tokens or browsing history,
 * and it never asks for permission to read them.
 */

const STORAGE_KEYS = {
  origin: "ccm.origin",
  instanceId: "ccm.instanceId",
  publicKey: "ccm.publicKey",
  publicKeyKid: "ccm.publicKeyKid",
  pairedAt: "ccm.pairedAt",
};

export const ISSUER = "ccm";
export const AUDIENCE = "ccm-launcher";
export const TICKET_TTL_SECONDS = 60;

/** Origins the extension accepts messages from, mirrored from the manifest. */
export const ALLOWED_SENDER_ORIGINS = [
  "http://localhost:3000",
  "https://ccm.medicalbay.ma",
];

export async function getConfig() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.origin,
    STORAGE_KEYS.instanceId,
    STORAGE_KEYS.publicKey,
    STORAGE_KEYS.publicKeyKid,
    STORAGE_KEYS.pairedAt,
  ]);

  return {
    origin: stored[STORAGE_KEYS.origin] ?? null,
    instanceId: stored[STORAGE_KEYS.instanceId] ?? null,
    publicKey: stored[STORAGE_KEYS.publicKey] ?? null,
    publicKeyKid: stored[STORAGE_KEYS.publicKeyKid] ?? null,
    pairedAt: stored[STORAGE_KEYS.pairedAt] ?? null,
  };
}

export async function ensureInstanceId() {
  const config = await getConfig();
  if (config.instanceId) return config.instanceId;

  const instanceId = crypto.randomUUID();
  await chrome.storage.local.set({ [STORAGE_KEYS.instanceId]: instanceId });
  return instanceId;
}

export async function setOrigin(origin) {
  const normalised = normaliseOrigin(origin);
  await chrome.storage.local.set({
    [STORAGE_KEYS.origin]: normalised,
    [STORAGE_KEYS.publicKey]: null,
    [STORAGE_KEYS.publicKeyKid]: null,
    [STORAGE_KEYS.pairedAt]: null,
  });
  return normalised;
}

export function normaliseOrigin(origin) {
  const url = new URL(origin);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("The CCM origin must be https (or localhost during development).");
  }
  return url.origin;
}

/**
 * Fetch and cache the CCM public verification key.
 *
 * The key is fetched from the pinned origin over https, so it is as
 * trustworthy as the origin itself. The key id is recorded so a key rotation
 * is visible in the extension rather than silent.
 */
export async function refreshPublicKey() {
  const config = await getConfig();
  if (!config.origin) {
    throw new Error("Set the CCM origin before pairing.");
  }

  const response = await fetch(`${config.origin}/api/launch/public-key`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`CCM returned ${response.status} for the verification key.`);
  }

  const jwk = await response.json();
  await chrome.storage.local.set({
    [STORAGE_KEYS.publicKey]: jwk,
    [STORAGE_KEYS.publicKeyKid]: jwk.kid ?? null,
    [STORAGE_KEYS.pairedAt]: new Date().toISOString(),
  });

  return jwk;
}
