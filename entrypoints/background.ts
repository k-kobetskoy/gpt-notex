export default defineBackground(() => {
  console.log('[BG] up');

  if (browser.sidePanel?.setPanelBehavior) {
    browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
      if (msg?.type === 'jump') {
        const { chatUrl, messageId } = msg as { chatUrl: string; messageId: string };
        let [tab] = await browser.tabs.query({ url: chatUrl });
        if (!tab) {
          tab = await browser.tabs.create({ url: chatUrl });
        } else {
          await browser.tabs.update(tab.id!, { active: true });
        }
        const trySend = async (attempts = 20) => {
          for (let i = 0; i < attempts; i++) {
            try {
              await browser.tabs.sendMessage(tab.id!, { type: 'jump', messageId });
              return true;
            } catch {
              await new Promise((r) => setTimeout(r, 250));
            }
          }
          return false;
        };
        const ok = await trySend();
        sendResponse({ ok });
        return;
      }
    })();
    return true;
  });
});
