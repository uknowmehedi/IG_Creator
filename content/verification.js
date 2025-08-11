(async () => {
  const cfg = window.CREATOR_PRO_CONFIG.verify;

  function grabCodeFromText(text) {
    const m = String(text || "").match(/\b(\d{4,8})\b/);
    return m ? m[1] : null;
  }

  let code = grabCodeFromText(document.querySelector(cfg.codeText)?.textContent);
  if (!code) code = grabCodeFromText(document.body?.innerText || "");

  if (!code) {
    console.warn("[CreatorPro] OTP not found on visible mail page (fallback).");
    return;
  }

  chrome.runtime.sendMessage({ type: "OTP_FOUND", code });
})();