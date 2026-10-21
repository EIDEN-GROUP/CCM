import { getConfig } from "./lib/config.js";

const dot = document.getElementById("dot");
const state = document.getElementById("state");
const openButton = document.getElementById("open");

openButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

(async () => {
  const config = await getConfig();
  if (config.origin) {
    dot.classList.remove("off");
    state.textContent = `Paired with ${config.origin}`;
  } else {
    dot.classList.add("off");
    state.textContent = "Not paired — open setup";
  }
})();
