export function installBridge(){
  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
      if (msg?.type === 'jump') {
        const ok = await jumpToById(String(msg.messageId));
        sendResponse({ ok });
      }
    })();
    return true;
  });
}

async function jumpToById(id:string){
  const sel = `[data-gn-anchor="${CSS.escape(id)}"]`;
  const cur = document.querySelector<HTMLElement>(sel);
  if (cur) { cur.scrollIntoView({ behavior:'smooth', block:'start', inline:'nearest' }); return true; }
  const ok = await waitForAnchor(sel, 5000);
  if (ok) ok.scrollIntoView({ behavior:'smooth', block:'start' });
  return !!ok;
}

function waitForAnchor(sel:string, timeout=5000): Promise<HTMLElement|null>{
  const cur = document.querySelector<HTMLElement>(sel); if (cur) return Promise.resolve(cur);
  return new Promise(res=>{
    const to = setTimeout(()=>{ mo.disconnect(); res(null); }, timeout);
    const mo = new MutationObserver(()=>{
      const el = document.querySelector<HTMLElement>(sel);
      if (el){ clearTimeout(to); mo.disconnect(); res(el); }
    });
    mo.observe(document.body, { childList:true, subtree:true });
  });
}
