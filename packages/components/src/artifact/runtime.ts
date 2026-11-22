import { buildSrcdoc } from '../mockup/engine/frame';
import type { ArtifactKind } from './policy';

export type Render = { kind: ArtifactKind; source: string; complete: boolean; revision: number };
export type HostMessage =
  | { type: 'value'; path: string; value: unknown }
  | { type: 'theme'; tokens: Record<string, string>; dark: boolean }
  | { type: 'size-mode'; maxHeight: number | undefined }
  | { type: 'render'; render: Render; values: Record<string, unknown> };
export type FrameMessage =
  | { type: 'ready' }
  | { type: 'size'; height: number }
  | { type: 'rendered'; revision: number }
  | { type: 'error'; error: string; revision: number }
  | { type: 'subscribe' | 'unsubscribe'; path: string }
  | { type: 'set'; path: string; value: unknown }
  | { type: 'send'; action: string; payload: unknown }
  | { type: 'exitFullscreen' };

function installArtifact(id: string, initial?: Render) {
  const standalone = parent === window;
  const values: Record<string, unknown> = Object.create(null);
  const subscriptions = new Map<string, Set<(value: unknown) => void>>();
  const grants = new Set<string>();
  const theme: Record<string, string> = Object.create(null);
  let revision = 0, resizeFrame = 0, lastHeight = 0;
  let maxHeight: number | undefined;
  let reactRoot: { render(node: unknown): void } | undefined;
  let react: typeof import('react') | undefined;
  const send = (message: FrameMessage) => {
    if (!standalone) parent.postMessage({ ...message, ns: 'prism-artifact', id }, '*');
  };
  const report = (error: unknown, version = revision) => {
    if (version === revision) send({ type: 'error', error: error instanceof Error ? error.message : String(error), revision: version });
  };
  const resize = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      const root = document.documentElement;
      root.toggleAttribute('data-prism-artifact-fit', maxHeight !== undefined);
      const height = Math.ceil(Math.max(document.body.scrollHeight, document.body.getBoundingClientRect().bottom + scrollY));
      if (maxHeight !== undefined && height > maxHeight) root.removeAttribute('data-prism-artifact-fit');
      if (height !== lastHeight) { lastHeight = height; send({ type: 'size', height }); }
    });
  };
  const get = (path: string) => {
    if (Object.hasOwn(values, path)) return values[path];
    const keys = path.split('.');
    for (let length = keys.length - 1; length > 0; length--) {
      const prefix = keys.slice(0, length).join('.');
      if (!Object.hasOwn(values, prefix)) continue;
      let value = values[prefix];
      for (const key of keys.slice(length)) value = value && typeof value === 'object' && Object.hasOwn(value, key)
        ? (value as Record<string, unknown>)[key] : undefined;
      return value;
    }
  };
  const adopt = (path: string, value: unknown) => {
    const before = get(path);
    values[path] = value;
    if (!Object.is(before, value)) for (const fn of subscriptions.get(path) ?? []) {
      try { fn(value); } catch (error) { report(error); }
    }
  };
  Object.defineProperty(window, 'prism', { value: Object.freeze({
    theme,
    resize,
    send: (action: string, payload: unknown) => send({ type: 'send', action, payload }),
    state: Object.freeze({
      get,
      set(path: string, value: unknown) { if (standalone) adopt(path, value); else send({ type: 'set', path, value }); },
      subscribe(path: string, callback: (value: unknown) => void) {
        let listeners = subscriptions.get(path);
        if (!listeners) { subscriptions.set(path, listeners = new Set()); send({ type: 'subscribe', path }); }
        listeners.add(callback);
        return () => {
          listeners.delete(callback);
          if (!listeners.size) {
            subscriptions.delete(path);
            if (!standalone && !grants.has(path)) delete values[path];
            send({ type: 'unsubscribe', path });
          }
        };
      },
    }),
  }) });
  const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const loadModule = async (source: string) => {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    try { return await import(url); } finally { URL.revokeObjectURL(url); }
  };
  const library = (specifier: string) => import(specifier);
  const runScript = async (original: HTMLScriptElement) => {
    if (!['', 'module', 'text/javascript', 'application/javascript'].includes(original.type)) return;
    const script = document.createElement('script');
    script.type = original.type;
    const src = original.getAttribute('src');
    const url = src ?? URL.createObjectURL(new Blob([original.textContent ?? ''], { type: 'text/javascript' }));
    script.src = url;
    try {
      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(src ? `Script could not load: ${src}` : 'Inline script could not load.'));
        document.head.append(script);
      });
    } finally { if (!src) URL.revokeObjectURL(url); script.remove(); }
  };
  const run = async ({ kind, source, complete, revision: version }: Render) => {
    revision = version;
    try {
      if (kind === 'react') {
        if (!complete) return;
        // Dynamic package imports are resolved inside the iframe by its import map.
        const [React, client, dom, entry] = await Promise.all([
          library('react'), library('react-dom/client'), library('react-dom'), loadModule(source),
        ]);
        if (revision !== version) return;
        if (!entry.default) throw new Error('Export a React component as the default export.');
        if (!reactRoot) {
          react = React;
          const root = document.createElement('main');
          document.body.replaceChildren(root);
          reactRoot = client.createRoot(root, { onUncaughtError: (error: unknown) => report(error) });
        }
        dom.flushSync(() => reactRoot!.render(react!.createElement(entry.default)));
      } else if (kind === 'js') {
        if (!complete) return;
        const root = document.createElement('main');
        root.id = 'app'; document.body.replaceChildren(root);
        await loadModule(source);
      } else {
        // The mockup engine handles the actual incremental render on its next frame.
        await frame();
        if (revision !== version) return;
        if (kind === 'html' && complete && /<script[\s>]/i.test(source)) {
          const parsed = new DOMParser().parseFromString(source, 'text/html');
          for (const script of Array.from(parsed.scripts)) {
            if (revision !== version) return;
            await runScript(script);
          }
        }
      }
      await frame(); resize();
      if (revision === version) send({ type: 'rendered', revision: version });
    } catch (error) { report(error, version); }
  };
  window.addEventListener('error', event => report(event.error ?? event.message));
  window.addEventListener('unhandledrejection', event => report(event.reason));
  window.addEventListener('keydown', event => { if (event.key === 'Escape') send({ type: 'exitFullscreen' }); });
  window.addEventListener('message', event => {
    const data = event.data as HostMessage & { ns?: string; id?: string };
    if (event.source !== parent || !data || data.ns !== 'prism-artifact' || data.id !== id) return;
    if (data.type === 'value') adopt(data.path, data.value);
    else if (data.type === 'theme') {
      for (const key of Object.keys(theme)) if (!Object.hasOwn(data.tokens, key)) delete theme[key];
      Object.assign(theme, data.tokens);
      document.documentElement.style.colorScheme = data.dark ? 'dark' : 'light';
    } else if (data.type === 'size-mode') {
      maxHeight = data.maxHeight;
      resize();
    } else if (data.type === 'render') {
      for (const [path, value] of Object.entries(data.values)) { grants.add(path); adopt(path, value); }
      void run(data.render);
    }
  });
  window.addEventListener('DOMContentLoaded', () => {
    new ResizeObserver(resize).observe(document.body);
    send({ type: 'ready' });
    if (standalone && initial) {
      if (initial.kind !== 'js' && initial.kind !== 'react') window.postMessage({
        ns: 'prism-mockup', v: 1, id, type: 'render', html: initial.source, done: true,
      }, '*');
      if (initial.kind === 'js' || initial.kind === 'react') void run(initial);
      else requestAnimationFrame(() => requestAnimationFrame(() => void run(initial)));
    }
  }, { once: true });
}

export const markup = (kind: ArtifactKind) => kind !== 'react' && kind !== 'js';
const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export function artifactDocument(id: string, imports: Record<string, string>, initial?: Render) {
  const nonce = id.replace(/[^\w-]/g, '');
  const scriptSources = [...new Set(Object.values(imports).map(value => value.split('?')[0]))].join(' ');
  const csp = `default-src 'none'; script-src 'nonce-${nonce}' blob: ${scriptSources}; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; base-uri 'none'; form-action 'none'`;
  const head = `<style>html{background:var(--prism-surface,#fff);color:var(--prism-text,#242832);font-family:var(--prism-font-sans,system-ui,sans-serif)}html[data-prism-artifact-fit]{overflow-y:hidden}button,input,select,textarea{font:inherit}</style><script nonce="${nonce}" type="importmap">${json({ imports })}</script>`;
  const srcdoc = buildSrcdoc({ id, csp, head, runtimeOptions: { interactive: true } }).replace('<script>', `<script nonce="${nonce}">`);
  const runtime = `(${installArtifact.toString()})(${json(id)}${initial ? ',' + json(initial) : ''})`.replace(/<\/script/gi, '<\\/script');
  return srcdoc.replace('</head>', () => `<script nonce="${nonce}">${runtime}</script></head>`);
}
