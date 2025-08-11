// content/mailtd_scraper.js
(function(){
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  const six = (t)=> (String(t||'').match(/\b(\d{6})\b/)||[])[1] || null;

  async function clickInstagramMessage(){
    // common patterns: subject/preview contains 'Instagram' and 'code'
    const rows = Array.from(document.querySelectorAll('div, a, tr'));
    // prioritize exact class you shared, else generic preview rows
    let target = rows.find(n => /Instagram/i.test(n.textContent||'') && /code/i.test(n.textContent||''));
    if(!target){
      // try visible list items
      const items = Array.from(document.querySelectorAll('[role="listitem"], .cursor-pointer, .truncate'));
      target = items.find(n => /Instagram/i.test(n.textContent||'') && /code/i.test(n.textContent||'')) || null;
    }
    if(target){
      target.scrollIntoView({block:'center'});
      target.click();
      return true;
    }
    return false;
  }

  async function readCodeFromOpenedMessage(){
    // Wait a little for message view to render
    for(let i=0;i<20;i++){
      const container = document.querySelector('main, article, .prose, body');
      const text = container ? (container.innerText || container.textContent || '') : '';
      const code = six(text);
      if(code) return code;
      await sleep(300);
    }
    return null;
  }

  (async ()=>{
    // Try to click the Instagram message in the list (a few attempts for async loads)
    for(let i=0;i<10;i++){
      const ok = await clickInstagramMessage();
      if(ok) break;
      await sleep(400);
    }
    const code = await readCodeFromOpenedMessage();
    if(code){
      chrome.runtime.sendMessage({ type: "OTP_FOUND", code });
    }else{
      // last-resort: try to read any 6-digit from current page
      const any = six(document.body?.innerText || '');
      if(any) chrome.runtime.sendMessage({ type: "OTP_FOUND", code: any });
    }
  })();
})();