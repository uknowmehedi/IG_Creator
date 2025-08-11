(function(){
  try {
    chrome.storage.local.get(['chosenUA','useMobileUA'], ({ chosenUA, useMobileUA }) => {
      const ua = chosenUA || navigator.userAgent;
      const set = (obj, prop, val) => { try { Object.defineProperty(obj, prop, { get: ()=>val, configurable: true }); } catch(e){} };

      set(navigator, 'userAgent', ua);
      set(navigator, 'appVersion', ua);
      set(navigator, 'platform', useMobileUA ? 'Linux armv8l' : (ua.includes('Mac') ? 'MacIntel' : 'Win32'));
      set(navigator, 'vendor', ua.includes('Safari') && !ua.includes('Chrome') ? 'Apple Computer, Inc.' : 'Google Inc.');
      set(navigator, 'language', 'en-US');
      Object.defineProperty(navigator, 'languages', { get: ()=>['en-US','en'], configurable: true });

      set(navigator, 'hardwareConcurrency', useMobileUA ? 6 : 8);
      set(navigator, 'deviceMemory', useMobileUA ? 4 : 8);
    });
  } catch(e) {}
})();