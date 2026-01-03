import { mirrorPageThemeTo, Paginator, installBridge } from "@/src/content";

export default defineContentScript({
  matches: ['https://chat.openai.com/*', 'https://chatgpt.com/*'],
  cssInjectionMode: 'manual',  
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'gpt-notex',      
      position: 'inline',
      anchor: 'body',
      onMount(container) {
        Object.assign(container.style, {
          left: '8px',
          top: '72px',
          bottom: '16px',
          width: '56px',
          zIndex: '2147483647',
          pointerEvents: 'auto'
        });
      }
    });
    ui.mount();
    mirrorPageThemeTo(ui.shadowHost);
    await Paginator.mount(ui.shadowHost);
    installBridge();
  }
});
