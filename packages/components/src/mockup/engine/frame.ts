import { buildRuntime } from './runtime';
import type { RuntimeOptions } from './runtime';
import type { Anchor, Box, FrameMessage, HitRect, HitResult, HostPayload, MockupConfig } from './protocol';

export const SANDBOX = 'allow-scripts';

export interface SrcdocOptions {
  id: string;
  csp?: string;
  head?: string;
  lang?: string;
  title?: string;
  runtimeOptions?: Omit<RuntimeOptions, 'id'>;
}

export function buildSrcdoc(opts: SrcdocOptions): string {
  const csp = opts.csp ?? "default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src data:; script-src 'unsafe-inline'; media-src data:";
  const escaped = csp.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const runtime = buildRuntime({ ...opts.runtimeOptions, id: opts.id }).replace(/<\/script/gi, '<\\/script');
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const lang = opts.lang || (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
  return `<!doctype html><html lang="${escape(lang)}"><head><meta charset="utf-8"><title>${escape(opts.title || 'Preview')}</title><meta http-equiv="Content-Security-Policy" content="${escaped}"><style data-prism="runtime">*,*::before,*::after{box-sizing:border-box}html,body{margin:0;min-height:0}body{overflow-wrap:break-word}img,svg{max-width:100%}</style>${opts.head ?? ''}<script>${runtime}</script></head><body></body></html>`;
}

export interface FrameControllerOptions extends Omit<SrcdocOptions, 'id'> {
  id?: string;
  win?: Window;
  origin?: string;
  hitTimeoutMs?: number;
}

export interface FrameController {
  id: string;
  srcdoc: string;
  attach(iframe: HTMLIFrameElement): void;
  render(html: string, done?: boolean): void;
  hit(rect: HitRect): Promise<HitResult | null>;
  setAnchors(anchors: Anchor[]): void;
  configure(config: MockupConfig): void;
  on<T extends FrameMessage['type']>(type: T, fn: (message: Extract<FrameMessage, { type: T }>) => void): () => void;
  destroy(): void;
}

export function createFrameController(opts: FrameControllerOptions = {}): FrameController {
  const win = opts.win ?? globalThis.window;
  if (!win) throw new Error('createFrameController requires a host window');
  const id = opts.id ?? `prism-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const srcdoc = buildSrcdoc({ ...opts, lang: opts.lang || win.document.documentElement.lang, id });
  let iframe: HTMLIFrameElement | null = null, ready = false, destroyed = false, req = 0;
  let render: Extract<HostPayload, { type: 'render' }> | undefined;
  let anchors: Anchor[] | undefined;
  let config: MockupConfig = { interactive: opts.runtimeOptions?.interactive ?? false };
  const listeners = new Map<string, Set<(message: FrameMessage) => void>>();
  const pending = new Map<number, { rect: HitRect; resolve: (result: HitResult | null) => void; timer: ReturnType<typeof setTimeout> }>();
  const post = (message: HostPayload): void => {
    if (!destroyed && ready) iframe?.contentWindow?.postMessage({ ...message, ns: 'prism-mockup', v: 1, id }, '*');
  };
  const isBox = (value: unknown): value is Box => {
    if (!value || typeof value !== 'object') return false;
    const box = value as Box;
    return [box.x, box.y, box.w, box.h].every(number => typeof number === 'number' && Number.isFinite(number));
  };
  const receive = (event: MessageEvent): void => {
    const data = event.data as FrameMessage;
    if (destroyed || !iframe || !iframe.contentWindow || event.source !== iframe.contentWindow || event.origin !== (opts.origin ?? 'null') ||
        !data || data.ns !== 'prism-mockup' || data.v !== 1 || data.id !== id) return;
    if (data.type === 'ready') {
      ready = true;
      post({ type: 'config', ...config });
      if (anchors) post({ type: 'anchors', anchors });
      if (render) post(render);
      for (const [req, item] of pending) post({ type: 'hit', req, ...item.rect });
    } else if (data.type === 'hit') {
      if (!Number.isSafeInteger(data.req) || !isBox(data.box) || (data.target !== null && (!data.target || !isBox(data.target.box) ||
          typeof data.target.selector !== 'string' || typeof data.target.text !== 'string' || typeof data.target.html !== 'string'))) return;
      const item = pending.get(data.req);
      if (item) { clearTimeout(item.timer); pending.delete(data.req); item.resolve({ target: data.target, box: data.box }); }
    } else if (data.type === 'size') {
      if (![data.width, data.height].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) return;
    } else if (data.type === 'layout') {
      if (!Array.isArray(data.anchors) || data.anchors.some(anchor => !anchor || typeof anchor.key !== 'string' || (anchor.box !== null && !isBox(anchor.box)))) return;
    } else if (data.type === 'error') {
      if (typeof data.message !== 'string') return;
    } else return;
    for (const listener of listeners.get(data.type) ?? []) listener(data);
  };
  win.addEventListener('message', receive);
  return {
    id, srcdoc,
    attach(element) {
      if (destroyed) return;
      iframe = element; ready = false;
      iframe.setAttribute('sandbox', SANDBOX);
      iframe.srcdoc = srcdoc;
    },
    render(html, done) {
      if (destroyed) return;
      render = { type: 'render', html, done }; post(render);
    },
    hit(rect) {
      if (destroyed) return Promise.resolve(null);
      if (![rect.x, rect.y, rect.w ?? 0, rect.h ?? 0].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) return Promise.resolve(null);
      const number = ++req;
      return new Promise(resolve => {
        const timer = setTimeout(() => { pending.delete(number); resolve(null); }, opts.hitTimeoutMs ?? 2000);
        pending.set(number, { rect: { ...rect }, resolve, timer });
        post({ type: 'hit', req: number, ...rect });
      });
    },
    setAnchors(list) {
      if (destroyed) return;
      anchors = list.map(anchor => ({ ...anchor })); post({ type: 'anchors', anchors });
    },
    configure(value) {
      if (destroyed) return;
      if (value.title !== undefined) config.title = value.title;
      if (value.lang !== undefined) config.lang = value.lang;
      if (value.mode !== undefined) config.mode = value.mode;
      if (value.interactive !== undefined) config.interactive = value.interactive;
      if (value.theme !== undefined) config.theme = { ...value.theme };
      post({ type: 'config', ...config });
    },
    on(type, fn) {
      if (destroyed) return () => {};
      let set = listeners.get(type);
      if (!set) { set = new Set(); listeners.set(type, set); }
      const listener = fn as (message: FrameMessage) => void;
      set.add(listener);
      return () => { set.delete(listener); };
    },
    destroy() {
      destroyed = true; ready = false;
      win.removeEventListener('message', receive);
      for (const item of pending.values()) { clearTimeout(item.timer); item.resolve(null); }
      pending.clear(); listeners.clear(); iframe = null;
    },
  };
}
