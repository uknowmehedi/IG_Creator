(async () => {
  const cfg = window.CREATOR_PRO_CONFIG.signup.dob;

  const q = (s) => document.querySelector(s);
  const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

  const day  = randInt(1, 28);
  const monN = randInt(1, 12);
  const year = randInt(1988, 2004);

  function setSelect(el, val) {
    if (!el) return;
    el.value = String(val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  setSelect(q(cfg.month), monN);
  setSelect(q(cfg.day), day);
  setSelect(q(cfg.year), year);

  const nextBtn = q(cfg.nextBtn);
  if (nextBtn) nextBtn.click();

  const { profile, autoVerify, signupTabId } = await chrome.storage.local.get(["profile","autoVerify","signupTabId"]);
  if (autoVerify && profile?.email) {
    chrome.runtime.sendMessage({ type: "START_VERIFICATION", email: profile.email, signupTabId });
  }
})();