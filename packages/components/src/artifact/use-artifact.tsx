import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useEmit, type PrismContextValue } from '@prism-ui/react';
import { sanitizeSvg } from '../mockup/engine/sanitize-svg';
import { compileArtifact } from './compiler';
import { mountArtifactFrame } from './frame';
import { renderArtifactMarkdown } from './markdown';
import { historyFor, sourceDiff, type ArtifactProps } from './model';
import { allowedPath, importMap, type ArtifactOptions } from './policy';
import { artifactDocument, markup } from './runtime';

const Options = createContext<ArtifactOptions>({});
export function ArtifactProvider({ options, children }: { options: ArtifactOptions; children: ReactNode }) {
  return <Options.Provider value={options}>{children}</Options.Provider>;
}

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const suffix = { html: 'html', svg: 'svg', js: 'js', markdown: 'md', react: 'tsx' } as const;
const present = (kind: ArtifactProps['kind'], text: string) => kind === 'svg' ? sanitizeSvg(text) :
  kind === 'markdown' ? renderArtifactMarkdown(text) : text;
const heights = { sm: 160, md: 252, lg: 384 };
const maxAutoHeight = 4096;

export function useArtifact(props: ArtifactProps, ctx: PrismContextValue, complete = true) {
  const options = useContext(Options), emit = useEmit();
  const { store } = ctx, enabled = options.enabled !== false;
  const history = useMemo(() => historyFor(store, props.id), [store, props.id]);
  const versions = useSyncExternalStore(history.subscribe, history.snapshot, history.snapshot);
  useEffect(() => { if (complete && enabled) history.publish(props); }, [complete, enabled, history, props]);
  const [chosen, selectVersion] = useState(0);
  const version = versions.find(version => version.number === chosen) ?? versions.at(-1);
  const selected = version ?? props;
  const { kind, source } = selected;
  const autoMax = selected.height === 'auto' ? maxAutoHeight : undefined;
  const readySource = !!version || complete;
  const runnable = enabled && !!kind && (markup(kind) ? source.length > 0 || readySource : readySource);
  const [mode, setMode] = useState<'preview' | 'source' | 'diff'>('preview');
  const previous = version && versions.find(item => item.number === version.number - 1);
  const diff = useMemo(() => mode === 'diff' && previous ? sourceDiff(previous.source, source) : undefined, [mode, previous, source]);
  const [container, ref] = useState<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [reloadKey, setReload] = useState(0);
  const sessionRef = useRef<ReturnType<typeof mountArtifactFrame> | null>(null);
  const revision = useRef(0);
  const current = useRef({ emit, title: selected.title ?? 'Artifact', autoMax });
  current.current = { emit, title: selected.title ?? 'Artifact', autoMax };
  const [failure, setFailure] = useState<{ source: string; kind: string; error: string }>();
  const [notice, setNotice] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [height, setHeight] = useState(0);
  const last = useRef<{ kind: ArtifactProps['kind']; source: string; complete: boolean } | undefined>(undefined);
  const error = failure?.source === source && failure.kind === kind ? failure.error : undefined;
  const imports = options.imports;
  const grantsKey = JSON.stringify(options.statePaths?.filter(path => allowedPath(path, [path])).slice(0, 128) ?? []);
  const grants = useMemo(() => JSON.parse(grantsKey) as string[], [grantsKey]);
  const reload = () => { setFailure(undefined); setNotice(''); setRendered(false); setHeight(0); setReload(key => key + 1); };

  useEffect(() => {
    if (!container || visible || !enabled) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '100px' });
    observer.observe(container);
    return () => observer.disconnect();
  }, [container, visible, enabled]);

  const fullscreenTarget = useCallback(() => container?.closest('[data-artifact-shell]') ?? container, [container]);
  useEffect(() => {
    const doc = container?.ownerDocument;
    if (!doc) return;
    const change = () => setFullscreen(doc.fullscreenElement === fullscreenTarget());
    doc.addEventListener('fullscreenchange', change);
    return () => doc.removeEventListener('fullscreenchange', change);
  }, [container, fullscreenTarget]);

  const updateTheme = useCallback(() => {
    if (!container || !sessionRef.current) return;
    const computed = container.ownerDocument.defaultView!.getComputedStyle(container);
    const tokens: Record<string, string> = {};
    for (const property of Array.from(computed)) if (property.startsWith('--prism-')) tokens[property] = computed.getPropertyValue(property).trim();
    const scheme = computed.colorScheme;
    sessionRef.current.theme(tokens, scheme === 'dark' ||
      (scheme.includes('dark') && !!container.ownerDocument.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches));
  }, [container]);

  useEffect(() => {
    if (!container || !enabled || !visible || !runnable) return;
    return () => { sessionRef.current?.destroy(); sessionRef.current = null; last.current = undefined; };
  }, [container, enabled, visible, runnable, imports, store, grants, reloadKey]);

  useEffect(() => {
    if (!container || !visible || !runnable) return;
    let cancelled = false;
    const number = ++revision.current;
    const report = (text: string, received = number) => {
      if (!cancelled && received === number) setFailure({ source, kind, error: text.slice(0, 2400) });
    };
    const mount = () => {
      const session = mountArtifactFrame(container, importMap(imports, container.ownerDocument.baseURI), store, grants, {
        height: value => setHeight(Math.min(maxAutoHeight, value)),
        rendered: value => { if (value === revision.current) setRendered(true); },
        error: (text, value) => {
          if (value === revision.current) {
            const active = last.current;
            if (active) setFailure({ source: active.source, kind: active.kind, error: text.slice(0, 2400) });
          }
        },
        send: (type, payload) => current.current.emit(type, payload),
        exitFullscreen: () => { if (container.ownerDocument.fullscreenElement === fullscreenTarget()) void container.ownerDocument.exitFullscreen(); },
      });
      session.frame.title = current.current.title;
      session.frame.setAttribute('data-prism', 'artifact');
      session.frame.setAttribute('data-part', 'iframe');
      sessionRef.current = session;
      session.sizeMode(current.current.autoMax);
      updateTheme();
      return session;
    };
    try {
      const prior = last.current;
      if (prior && (prior.kind !== kind || (prior.complete && prior.source !== source &&
          (kind === 'js' || (kind === 'html' && /<script[\s>]/i.test(prior.source)))))) {
        sessionRef.current?.destroy(); sessionRef.current = null; setRendered(false); setHeight(0);
      }
      const session = sessionRef.current ?? mount();
      last.current = { kind, source, complete: readySource };
      const render = (code: string) => {
        if (!cancelled) session.render({ kind, source: code, complete: readySource, revision: number });
      };
      if (source.length > 1_000_000) report('Artifact source exceeds 1 MB.');
      else if (kind === 'react') void compileArtifact(source, options.compilerUrl).then(render, error => report(errorMessage(error)));
      else render(present(kind, source));
    } catch (error) { report(errorMessage(error)); }
    return () => { cancelled = true; };
  }, [container, visible, runnable, imports, store, grants, reloadKey, kind, source, readySource, options.compilerUrl, updateTheme, fullscreenTarget]);

  useEffect(() => {
    if (!container || !visible) return;
    const win = container.ownerDocument.defaultView;
    const observer = new MutationObserver(updateTheme);
    for (let root: HTMLElement | null = container; root; root = root.parentElement) {
      observer.observe(root, { attributes: true, attributeFilter: ['class', 'style', 'data-prism-theme', 'data-density', 'data-animate'] });
    }
    const media = win?.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener('change', updateTheme);
    return () => { observer.disconnect(); media?.removeEventListener('change', updateTheme); };
  }, [container, visible, updateTheme]);

  useEffect(() => { if (sessionRef.current) sessionRef.current.frame.title = current.current.title; }, [selected.title]);
  useEffect(() => { sessionRef.current?.sizeMode(autoMax); }, [autoMax]);

  async function copy() {
    try { await navigator.clipboard.writeText(source); setNotice('Copied'); }
    catch { setNotice('Clipboard unavailable'); }
  }
  function download(standalone = false) {
    try {
      const filename = (selected.title ?? 'artifact').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'artifact';
      const contents = standalone ? artifactDocument('artifact-download', importMap(imports, document.baseURI),
        { kind, source: present(kind, source), complete: true, revision: 1 }) : source;
      const url = URL.createObjectURL(new Blob([contents], { type: standalone ? 'text/html' : 'text/plain' }));
      const link = document.createElement('a');
      link.href = url; link.download = filename + '.' + (standalone ? 'html' : suffix[kind]); link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setNotice('Download unavailable'); }
  }
  async function toggleFullscreen() {
    const target = fullscreenTarget();
    if (!target) return;
    try {
      if (target.ownerDocument.fullscreenElement === target) await target.ownerDocument.exitFullscreen();
      else await target.requestFullscreen();
    } catch { setNotice('Fullscreen unavailable'); }
  }
  return {
    selected, versions, version, selectVersion, mode, setMode, diff, previous, enabled, rendered, error, notice, ref, fullscreen,
    height: typeof selected.height === 'number' ? selected.height : Math.max(heights[selected.size], height),
    copy, download, reload, toggleFullscreen,
    fix() { if (error) emit('fix', { error, source, kind, version: version?.number ?? 1 }); },
  };
}
