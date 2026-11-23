import { useEffect, useRef, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { Prism, createRegistry, type Registry, type Theme } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import type { Plugin } from '@prism-ui/core';
import { createReplay } from '../replay';

export type ExampleData = { name: string; sources: string[] };
type Bundle = { registry: Registry; plugins?: Plugin[] };
const themeLoaders = {
  refraction: () => import('@prism-ui/themes/refraction').then(m => m.refraction),
  instrument: () => import('@prism-ui/themes/instrument').then(m => m.instrument),
  print: () => import('@prism-ui/themes/print').then(m => m.print),
  objects: () => import('@prism-ui/themes/objects').then(m => m.objects),
};
const fonts = {
  refraction: 'Inter:wght@400;500;600&family=Instrument+Serif&family=JetBrains+Mono',
  instrument: 'IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono',
  print: 'Inter+Tight:wght@400;500;600;700;800;900&family=IBM+Plex+Mono',
  objects: 'DM+Sans:wght@400;500;600&family=Caveat:wght@400;600',
};
function loadFonts(name: keyof typeof fonts) {
  if (document.querySelector(`[data-theme-font="${name}"]`)) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.dataset.themeFont = name;
  link.href = `https://fonts.googleapis.com/css2?family=${fonts[name]}&display=swap`; document.head.append(link);
}

export function Example({ data, bundle, snapshot }: { data: ExampleData; bundle: Bundle; snapshot?: string }) {
  const [enhanced, setEnhanced] = useState(false);
  const [index, setIndex] = useState(0), [source, setSource] = useState(data.sources[0] ?? '');
  const [store, setStore] = useState(() => createStore({ initial: { rent: 1200 } }));
  const [ready, setReady] = useState(false), [playing, setPlaying] = useState(false);
  const [theme, setTheme] = useState<Theme | undefined>(), [themeName, setThemeName] = useState('host');
  const [mode, setMode] = useState<'auto' | 'light' | 'dark'>('auto'), [error, setError] = useState('');
  const current = useRef<ReturnType<typeof createReplay> | null>(null), request = useRef(0);
  useEffect(() => {
    setReady(true);
    setEnhanced(true);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => { if (media.matches) { current.current?.stop(); setPlaying(false); setSource(data.sources[index] ?? ''); } };
    media.addEventListener('change', finish);
    return () => { current.current?.stop(); media.removeEventListener('change', finish); };
  }, [index, data]);
  useEffect(() => {
    const container = document.querySelector('[data-island="example"]'); container?.setAttribute('data-live', '');
    return () => { container?.removeAttribute('data-live'); request.current++; };
  }, []);
  function select(next: number) {
    current.current?.stop(); setPlaying(false); setIndex(next); setSource(data.sources[next] ?? ''); setStore(createStore({ initial: { rent: 1200 } }));
    const root = document.querySelector('[data-component-page]');
    root?.querySelectorAll<HTMLElement>('[data-source-index]').forEach(element => { element.hidden = Number(element.dataset.sourceIndex) !== next; });
  }
  async function replay() {
    select(index);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const next = createReplay(data.sources[index] ?? '', 2); current.current = next; setPlaying(true); setSource('');
    for await (const text of next.stream) { if (current.current !== next) return; setSource(text); }
    if (current.current === next) setPlaying(false);
  }
  async function changeTheme(name: string) {
    const id = ++request.current; setThemeName(name); setError('');
    if (name === 'host') { setTheme(undefined); return; }
    try {
      const key = name as keyof typeof themeLoaders, next = await themeLoaders[key]();
      if (request.current !== id) return;
      loadFonts(key); setTheme(next);
    } catch { if (request.current === id) { setThemeName('host'); setTheme(undefined); setError('Theme unavailable. The host example is still ready to use.'); } }
  }
  return <>
    <div className="example-controls">
      {data.sources.length > 1 && <div className="example-switch" role="group" aria-label="Authoring examples">{data.sources.map((_, i) => <button type="button" key={i} aria-pressed={index === i} disabled={!ready} onClick={() => select(i)}>Example {i + 1}</button>)}</div>}
      <label>Theme <select aria-label="Example theme" disabled={!ready} value={themeName} onChange={event => void changeTheme(event.target.value)}>{['host', ...Object.keys(themeLoaders)].map(name => <option key={name}>{name}</option>)}</select></label>
      <label>Mode <select aria-label="Example color mode" disabled={!ready} value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="auto">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <button className="text-button" type="button" disabled={!ready} onClick={() => void replay()}>{playing ? 'Restart stream' : 'Replay stream'}</button>
    </div>
    <p role="status" className={error ? 'example-error' : 'sr-only'}>{error || (playing ? 'Example streaming' : 'Example ready')}</p>
    <div className="live-example" aria-busy={playing} {...(!enhanced && snapshot !== undefined ? { dangerouslySetInnerHTML: { __html: snapshot } } : { children: source ? <Prism key={index} source={source} registry={bundle.registry} plugins={bundle.plugins} store={store} scope={`example-${data.name}`} done={!playing} animate={false} theme={theme} mode={mode} /> : <p className="empty-example">{playing ? 'Reply starting…' : 'No authoring example is registered.'}</p> })} />
  </>;
}

export function mount(element: HTMLElement, bundle: Bundle, options: { deferContentHydration?: boolean } = {}) {
  const data = JSON.parse(element.querySelector('[data-example-data]')!.textContent!) as ExampleData;
  const target = element.querySelector<HTMLElement>('[data-example-root]')!;
  const snapshot = options.deferContentHydration ? target.querySelector('.live-example')?.innerHTML : undefined;
  return hydrateRoot(target, <Example data={data} bundle={bundle} snapshot={snapshot} />, { identifierPrefix: 'example-' });
}
export { createRegistry };
