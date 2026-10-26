import { getConfig } from "./lib/config.js";

const state = document.getElementById("state");
const detail = document.getElementById("detail");
const statusIcon = document.getElementById("status-icon");
const openButton = document.getElementById("open");
const dashboardLink = document.getElementById("dashboard");

openButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

(async () => {
  try {
    const config = await getConfig();
    if (config.origin) {
      state.textContent = "Connected to CCM";
      detail.textContent = config.origin;
      dashboardLink.href = config.origin;
      openButton.textContent = "Manage connection";
    } else {
      statusIcon.classList.add("off");
      state.textContent = "Setup needed";
      detail.textContent = "Pair this browser profile with your CCM workspace to get started.";
      dashboardLink.href = "https://ccm.eiden-group.com";
    }
  } catch {
    statusIcon.classList.add("error");
    state.textContent = "Could not check connection";
    detail.textContent = "Try again, or open setup to check this browser profile.";
  }
})();
