import { useEffect, useRef, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { Prism, createRegistry } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { num, calc } from '@prism-ui/components/num';
import { chartDefinition } from '@prism-ui/components/chart';
import { heroInitial, heroSource } from '../hero-source';
import { createReplay } from '../replay';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/num.css';
import '@prism-ui/components/chart.css';

const registry = createRegistry([num, calc, chartDefinition]);

export function Hero() {
  const [store] = useState(() => createStore({ initial: heroInitial }));
  const [source, setSource] = useState(heroSource), [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false), [mode, setMode] = useState<'auto' | 'light' | 'dark'>('auto');
  const current = useRef<ReturnType<typeof createReplay> | null>(null), reply = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setReady(true);
    const island = reply.current?.closest('[data-island]'); island?.setAttribute('data-live', '');
    const updateMode = () => { const value = document.documentElement.dataset.mode; setMode(value === 'light' || value === 'dark' ? value : 'auto'); };
    updateMode();
    const observer = new MutationObserver(updateMode); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => { if (media.matches) { current.current?.stop(); setSource(heroSource); setPlaying(false); } };
    media.addEventListener('change', finish);
    void replay();
    return () => { current.current?.stop(); observer.disconnect(); media.removeEventListener('change', finish); island?.removeAttribute('data-live'); };
  }, []);
  async function replay() {
    current.current?.stop();
    store.set('seats', heroInitial.seats, { history: false });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setSource(heroSource); setPlaying(false); return; }
    if (reply.current) reply.current.style.minHeight = `${reply.current.getBoundingClientRect().height}px`;
    const next = createReplay(heroSource); current.current = next;
    setSource(''); setPlaying(true);
    for await (const text of next.stream) { if (current.current !== next) return; setSource(text); }
    if (current.current === next) { setSource(heroSource); setPlaying(false); }
  }
  return <>
    <div className="reply-context"><span className="reply-avatar" aria-hidden="true">P</span><span>Prism <span className="reply-role">/ a reply, not a widget</span></span><button className="text-button replay" type="button" onClick={replay} disabled={!ready} aria-label={playing ? 'Restart reply' : 'Replay reply'}><span aria-hidden="true">↻</span> {playing ? 'Restart' : 'Replay'}</button></div>
    <div className="hero-reply" ref={reply} aria-label="Interactive assistant reply" aria-busy={playing}>
      <Prism registry={registry} store={store} scope="site-hero" source={source} done={!playing} animate={false} mode={mode} />
    </div>
    <div className="reply-note"><span aria-hidden="true">↔</span> Try changing the underlined number. Everything stays connected.</div>
    <span className="sr-only" role="status">{playing ? 'Reply streaming. Replay again to restart.' : 'Reply ready to explore.'}</span>
  </>;
}

export function mount(element: HTMLElement) { return hydrateRoot(element, <Hero />, { identifierPrefix: 'hero-' }); }
