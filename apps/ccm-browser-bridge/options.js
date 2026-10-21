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

function setStatus(message, kind) {
  statusBox.hidden = false;
  statusBox.textContent = message;
  statusBox.className = `status ${kind}`;
}

async function init() {
  const instanceId = await ensureInstanceId();
  instanceOutput.textContent = instanceId;

  const config = await getConfig();
  if (config.origin) {
    originInput.value = config.origin;
    setStatus(
      `Paired with ${config.origin} (key id: ${config.publicKeyKid ?? "unknown"}).`,
      "ok",
    );
  } else {
    setStatus("Not paired yet. Enter your CCM origin and save.", "warn");
  }
}

saveButton.addEventListener("click", async () => {
  const value = originInput.value.trim();
  if (!value) {
    setStatus("Enter the CCM origin first.", "error");
    return;
  }

  saveButton.disabled = true;
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
  }
});

init();
