type Theme = 'light' | 'dark';
let fontsReady: Promise<void> | null = null;

export function mirrorPageThemeTo(host: HTMLElement) {
  const html = document.documentElement;
  set(host, detect(html));

  const observer = new MutationObserver(() => set(host, detect(html)));

  observer.observe(html, { attributes: true, attributeFilter: ['class'] });

  return () => { observer.disconnect() };
}

function set(host: HTMLElement, theme: Theme) {
  if (host.getAttribute('data-theme') !== theme) host.setAttribute('data-theme', theme);
}

function detect(html: HTMLElement): Theme {
  const classes = html.classList;

  return classes.contains('dark') ? 'dark' : 'light';
}

export async function ensureFontsLoaded() {
  if (fontsReady) return fontsReady;

  fontsReady = (async () => {
    const lektonUrl = browser.runtime.getURL('/fonts/Lekton-Bold.ttf');
    const interUrl = browser.runtime.getURL('/fonts/Inter-VariableFont_opsz,wght.ttf');

    const [lektonBuf, interBuf] = await Promise.all([
      fetch(lektonUrl).then(async (r) => {
        if (!r.ok) throw new Error(`Failed to fetch ${lektonUrl}: ${r.status}`);
        return r.arrayBuffer();
      }),
      fetch(interUrl).then(async (r) => {
        if (!r.ok) throw new Error(`Failed to fetch ${interUrl}: ${r.status}`);
        return r.arrayBuffer();
      }),
    ]);

    const lekton = new FontFace('Lekton', lektonBuf, {
      weight: '700',
      style: 'normal',
      display: 'swap',
    });
    const inter = new FontFace('Inter', interBuf, {
      weight: '100 900',
      style: 'normal',
      display: 'swap',
    });

    await Promise.all([lekton.load(), inter.load()]);
    document.fonts.add(lekton);
    document.fonts.add(inter);
  })().catch((err) => {
    console.warn('Failed to load extension fonts', err);
  });

  return fontsReady;
}
