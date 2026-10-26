import {
  ensureInstanceId,
  getConfig,
  refreshPublicKey,
  setOrigin,
} from "./lib/config.js";

const originInput = document.getElementById("origin");
const instanceOutput = document.getElementById("instance");
const statusBox = document.getElementById("status");
const saveButton = document.getElementById("save");
const copyButton = document.getElementById("copy-instance");
const openCcmLink = document.getElementById("open-ccm");
const openLauncherLink = document.getElementById("open-launcher");

function setStatus(message, kind) {
  statusBox.hidden = false;
  statusBox.textContent = message;
  statusBox.className = `status ${kind}`;
}

async function init() {
  try {
    const instanceId = await ensureInstanceId();
    instanceOutput.textContent = instanceId;
    copyButton.disabled = false;

    const config = await getConfig();
    if (config.origin) {
      originInput.value = config.origin;
      openCcmLink.href = config.origin;
      openLauncherLink.href = `${config.origin}/launcher/setup`;
      setStatus(
        `Connected to ${config.origin}. Verification key: ${config.publicKeyKid ?? "not verified"}.`,
        config.publicKey ? "ok" : "warn",
      );
    }
  } catch {
    setStatus("Could not read this browser profile. Try reloading the extension page.", "error");
  }
}

saveButton.addEventListener("click", async () => {
  const value = originInput.value.trim();
  if (!value) {
    setStatus("Enter the CCM origin first.", "error");
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Verifying…";
  setStatus("Saving…", "warn");

  try {
    const origin = await setOrigin(value);
    const jwk = await refreshPublicKey();
    setStatus(
      `Paired with ${origin}. Verification key id: ${jwk.kid ?? "unknown"}.`,
      "ok",
    );
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Could not save the origin.",
      "error",
    );
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save and verify";
  }
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(instanceOutput.textContent ?? "");
    setStatus("Browser profile ID copied. Paste it into Account Launcher setup in CCM.", "ok");
  } catch {
    setStatus("Could not copy the ID. Select the profile ID above and copy it manually.", "error");
  }
});

init();
