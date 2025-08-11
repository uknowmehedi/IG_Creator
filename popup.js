const $ = (s)=>document.querySelector(s);
const statusEl = $("#status");

async function run() {
  const autoVerify = $("#autoVerify").checked;
  const randomDob  = $("#randomDob").checked;

  statusEl.textContent = "Starting…";

  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  const signupTabId = active.id;

  await chrome.storage.local.set({ autoVerify, randomDob, signupTabId });

  // Random UA init (per run)
  await chrome.runtime.sendMessage({ type: "INIT_UA_FOR_HOST", tabId: signupTabId });

  // Start filling
  await chrome.runtime.sendMessage({ type: "START_SIGNUP_FILL", tabId: signupTabId });
  statusEl.textContent = "Filling signup (human speed)…";
}

$("#createBtn").addEventListener("click", run);