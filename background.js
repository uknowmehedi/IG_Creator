// =================== Random User-Agent (per run) ===================
const MOBILE_UAS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 12; SAMSUNG SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36'
];
const DESKTOP_UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0'
];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function chooseRandomUA() {
  const useMobile = Math.random() < 0.6; // 60% mobile, 40% desktop
  return { ua: useMobile ? pick(MOBILE_UAS) : pick(DESKTOP_UAS), useMobile };
}
let CURRENT_UA = null;

// ============== UA header override for instagram.com ==============
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const host = new URL(details.url).hostname;
    if (!/\.instagram\.com$/i.test(host)) return;
    const headers = details.requestHeaders || [];
    const ua = CURRENT_UA?.ua || navigator.userAgent;
    let foundUA = false, foundLang = false;
    for (const h of headers) {
      const n = h.name.toLowerCase();
      if (n === 'user-agent') { h.value = ua; foundUA = true; }
      if (n === 'accept-language') { foundLang = true; }
    }
    if (!foundUA) headers.push({ name: 'User-Agent', value: ua });
    if (!foundLang) headers.push({ name: 'Accept-Language', value: 'en-US,en;q=0.9' });
    return { requestHeaders: headers };
  },
  { urls: ["*://*.instagram.com/*"] },
  ["blocking", "requestHeaders"]
);

// =================== mail.td helpers ===================
function makeMailUrlRaw(email) {
  // exactly as you want: https://mail.td/mail/<raw email>
  return `https://mail.td/mail/${String(email).trim()}`;
}

// only 6-digit extractor (works for list/body)
function extractOtpFromHtml(html) {
  // "123456 is your Instagram code" or similar
  let m = /(\d{6})\s+(?:is your Instagram code|Instagram code)/i.exec(html);
  if (m) return m[1];
  // common class you shared earlier
  const divRe = /<div[^>]*class="[^"]*w-2\/12\s+pl-1\s+text-gray-700\s+truncate\s+cursor-pointer[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
  const hit = divRe.exec(html);
  if (hit) {
    const text = hit[1].replace(/<[^>]+>/g, ' ');
    const m2 = text.match(/\b(\d{6})\b/);
    if (m2) return m2[1];
  }
  // last resort: first 6 digits anywhere
  const any6 = html.match(/\b(\d{6})\b/);
  return any6 ? any6[1] : null;
}

// quick backend polling (kept; sometimes enough without opening tab)
async function waitForOtpFromMailTd(email, { timeoutMs = 20000, intervalMs = 1200 } = {}) {
  const start = Date.now();
  const target = makeMailUrlRaw(email);
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${target}?t=${Date.now()}`, {
        method: "GET", mode: "cors", cache: "no-store", credentials: "omit",
        headers: {
          "User-Agent": CURRENT_UA?.ua || "Mozilla/5.0",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });
      if (res.ok) {
        const html = await res.text();
        const code = extractOtpFromHtml(html);
        if (code) return code;
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

// visible mail scrape: open tab → click Instagram message → read code
async function openMailTabAndScrape(email) {
  const tab = await chrome.tabs.create({ url: makeMailUrlRaw(email), active: false });
  await chrome.storage.local.set({ otpMailTabId: tab.id });

  return new Promise((resolve) => {
    const cleanup = async (code) => {
      try { await chrome.tabs.remove(tab.id); } catch(_) {}
      resolve(code || null);
    };
    const onMsg = async (msg) => {
      if (msg?.type === "OTP_FOUND") {
        chrome.runtime.onMessage.removeListener(onMsg);
        await cleanup(msg.code);
      }
    };
    chrome.runtime.onMessage.addListener(onMsg);

    chrome.tabs.onUpdated.addListener(function listener(tid, info) {
      if (tid !== tab.id || info.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(listener);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/mailtd_scraper.js"]
      }).catch(()=>cleanup(null));
      // hard timeout
      setTimeout(()=>cleanup(null), 60000);
    });
  });
}

// =================== IG fill: robust OTP paste + enable Next ===================
async function fillOtpIntoSignupTab(tabId, code) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [code],
    func: (otp) => {
      const q = (s)=>document.querySelector(s);
      const inputs = [
        'input[name="code"]',
        'input[autocomplete="one-time-code"]',
        'input[type="tel"]',
        'input[type="text"]'
      ];
      let input = null;
      for (const sel of inputs) { const el = q(sel); if (el) { input = el; break; } }
      if (!input) { console.warn("[CreatorPro] Verify input not found"); return; }

      // ---- React-friendly setter (forces onChange) ----
      const setNativeValue = (el, value) => {
        const valueSetter = Object.getOwnPropertyDescriptor(el, 'value')?.set;
        const proto = Object.getPrototypeOf(el);
        const protoSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (protoSetter && valueSetter !== protoSetter) {
          protoSetter.call(el, value);
        } else {
          el.value = value;
        }
      };
      const fire = (type, opts={}) => el => el.dispatchEvent(new Event(type, { bubbles:true, composed:true, ...opts }));

      input.focus();
      setNativeValue(input, ""); fire('input')(input);
      for (const ch of String(otp)) {
        setNativeValue(input, input.value + ch);
        fire('input')(input);
      }
      fire('change')(input);
      input.blur(); fire('blur')(input);

      // ---- find Next/Submit & ensure it's enabled ----
      function isDisabled(btn){
        return btn.disabled || btn.getAttribute('disabled') !== null || btn.getAttribute('aria-disabled') === 'true';
      }
      function findNextBtn() {
        const byRole = Array.from(document.querySelectorAll('[role="button"], button'));
        let hit = byRole.find(b => /^(next|continue)$/i.test((b.textContent || '').trim()));
        if (hit) return hit;
        hit = document.querySelector('[role="button"][aria-label="Next"], button[aria-label="Next"]');
        if (hit) return hit;
        const formBtn = input.closest('form')?.querySelector('button[type="submit"], input[type="submit"]');
        return formBtn || null;
      }
      const nextBtn = findNextBtn();

      // wait a moment for validation to enable button
      const waitEnabled = async (btn, ms=3000) => {
        const start = performance.now();
        while (performance.now() - start < ms) {
          if (!btn || !isDisabled(btn)) return true;
          await new Promise(r=>setTimeout(r,150));
        }
        return true; // proceed anyway; we will try pointer events/Enter
      };

      // tiny async helper in page
      (async ()=>{
        if (nextBtn) await waitEnabled(nextBtn, 4000);

        const form = input.closest('form');
        if (form && typeof form.requestSubmit === 'function') {
          try { form.requestSubmit(nextBtn || undefined); return; } catch(_) {}
        }

        if (nextBtn) {
          const o = { bubbles:true, cancelable:true, view:window };
          nextBtn.dispatchEvent(new PointerEvent('pointerdown', o));
          nextBtn.dispatchEvent(new MouseEvent('mousedown', o));
          nextBtn.dispatchEvent(new PointerEvent('pointerup', o));
          nextBtn.dispatchEvent(new MouseEvent('mouseup', o));
          nextBtn.dispatchEvent(new MouseEvent('click', o));
        } else {
          input.focus();
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
          input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
        }
        console.log("[CreatorPro] OTP pasted & Next submitted:", otp);
      })();
    }
  });
}

// =================== Messages / Stage Orchestration ===================
chrome.runtime.onMessage.addListener(async (msg, sender) => {
  // 1) UA init + spoof
  if (msg.type === "INIT_UA_FOR_HOST") {
    CURRENT_UA = chooseRandomUA();
    await chrome.storage.local.set({ chosenUA: CURRENT_UA.ua, useMobileUA: CURRENT_UA.useMobile });
    const tabId = msg.tabId || sender.tab?.id;
    if (tabId) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content/ua_spoof.js"], world: "MAIN" });
    }
  }

  // 2) First page fill
  if (msg.type === "START_SIGNUP_FILL") {
    await chrome.scripting.executeScript({ target: { tabId: msg.tabId }, files: ["content/config.js", "content/signup_fill.js"] });
  }

  // 3) DOB stage
  if (msg.type === "RUN_DOB_STAGE") {
    const tabId = msg.tabId || sender.tab?.id;
    if (tabId) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content/config.js", "content/signup_dob.js"] });
    }
  }

  // 4) Email verification (backend → fallback visible scrape)
  if (msg.type === "START_VERIFICATION") {
    const { signupTabId, profile } = await chrome.storage.local.get(["signupTabId","profile"]);
    const email = msg.email || profile?.email;
    if (!email || !signupTabId) return;

    // fast path: backend peek
    let code = await waitForOtpFromMailTd(email, { timeoutMs: 20000, intervalMs: 1200 });

    // fallback: open mail.td tab & click Instagram message to read body
    if (!code) code = await openMailTabAndScrape(email);

    if (code) {
      await fillOtpIntoSignupTab(signupTabId, code);
    } else {
      console.warn("[CreatorPro] OTP not found for:", email);
    }
  }
});