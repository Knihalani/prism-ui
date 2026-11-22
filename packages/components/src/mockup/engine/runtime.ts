import { createStreamMorpher, MORPH_SOURCE } from './morph';
import type { Anchor, Box, FramePayload, HitRect, HitResult, HostMessage, MockupConfig } from './protocol';

export interface RuntimeOptions { id: string; interactive?: boolean }

export function installRuntime(win: Window, opts: RuntimeOptions): () => void {
  const env = win as Window & typeof globalThis;
  const doc = win.document;
  const stream = createStreamMorpher(doc);
  let interactive = opts.interactive ?? false, destroyed = false, scheduled = 0;
  let pending: string | undefined, anchors: Anchor[] = [], lastLayout = '', lastSize = '';
  let theme: Record<string, string> = {};
  const send = (message: FramePayload): void => {
    if (!destroyed) win.parent.postMessage({ ...message, ns: 'prism-mockup', v: 1, id: opts.id }, '*');
  };
  const dimensions = () => ({
    width: Math.max(doc.body.scrollWidth, doc.documentElement.scrollWidth, 1),
    height: Math.ceil(Math.max(doc.body.scrollHeight, doc.documentElement.getBoundingClientRect().height,
      doc.documentElement.scrollHeight > doc.documentElement.clientHeight ? doc.documentElement.scrollHeight : 0, 1)),
  });
  const box = (el: Element): Box => {
    const rect = el.getBoundingClientRect(), size = dimensions();
    return { x: (rect.left + win.scrollX) / size.width * 100, y: (rect.top + win.scrollY) / size.height * 100,
      w: rect.width / size.width * 100, h: rect.height / size.height * 100 };
  };
  const snippet = (el: Element) => ((el as HTMLElement).innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const query = (selector: string): Element | null => { try { return doc.querySelector(selector); } catch { return null; } };
  const escape = (text: string) => Array.from(text, char => /[a-zA-Z0-9_-]/.test(char) ? char : `\\${char.codePointAt(0)!.toString(16)} `).join('');
  const unique = (selector: string, el: Element) => {
    try { const found = doc.querySelectorAll(selector); return found.length === 1 && found[0] === el; } catch { return false; }
  };
  const selector = (el: Element): string => {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== doc.documentElement) {
      const id = node.getAttribute('id');
      const key = node.getAttribute('data-key');
      const suffix = parts.length ? ` > ${parts.join(' > ')}` : '';
      if (id) {
        const candidate = `[id="${id.replace(/["\\\n\r\f]/g, char => `\\${char.codePointAt(0)!.toString(16)} `)}"]${suffix}`;
        const short = `#${escape(id)}${suffix}`;
        if (unique(short, el)) return short;
        if (unique(candidate, el)) return candidate;
      }
      if (key) {
        const candidate = `[data-key="${key.replace(/["\\\n\r\f]/g, char => `\\${char.codePointAt(0)!.toString(16)} `)}"]${suffix}`;
        if (unique(candidate, el)) return candidate;
      }
      let nth = 1;
      for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) if (sibling.localName === node.localName) nth++;
      parts.unshift(`${escape(node.localName)}:nth-of-type(${nth})`);
      const candidate = parts.join(' > ');
      if (unique(candidate, el)) return candidate;
      node = node.parentElement;
    }
    return parts.join(' > ');
  };
  const hit = (rect: HitRect): HitResult => {
    const size = dimensions(), x = rect.x / 100 * size.width, y = rect.y / 100 * size.height;
    const w = (rect.w ?? 0) / 100 * size.width, h = (rect.h ?? 0) / 100 * size.height;
    const at = (px: number, py: number) => doc.elementFromPoint?.(px - win.scrollX, py - win.scrollY) ?? null;
    let element = at(x, y);
    if (rect.w !== undefined && rect.h !== undefined) {
      const candidates = Array.from(doc.body.querySelectorAll('*')).filter(el => {
        const bounds = el.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0 && bounds.left + win.scrollX <= x && bounds.top + win.scrollY <= y &&
          bounds.right + win.scrollX >= x + w && bounds.bottom + win.scrollY >= y + h;
      });
      candidates.sort((a, b) => {
        const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        return ar.width * ar.height - br.width * br.height || (a.contains(b) ? 1 : b.contains(a) ? -1 : 0);
      });
      element = candidates[0] ?? null;
      if (!element) {
        const points = [at(x, y), at(x + w, y), at(x, y + h), at(x + w, y + h), at(x + w / 2, y + h / 2)];
        element = points[0] ?? null;
        while (element && points.some(point => !point || !element!.contains(point))) element = element.parentElement;
      }
    }
    const requested = { x: rect.x, y: rect.y, w: rect.w ?? 0, h: rect.h ?? 0 };
    if (!element || element === doc.body || element === doc.documentElement) return { target: null, box: requested };
    let html = element.outerHTML.replace(/\s+/g, ' ').trim();
    if (html.length > 300) {
      const summary = element.cloneNode(false) as Element;
      summary.textContent = '…';
      while (summary.outerHTML.length > 300 && summary.attributes.length) summary.removeAttribute(summary.attributes[summary.attributes.length - 1]!.name);
      html = summary.outerHTML.replace(/\s+/g, ' ').slice(0, 300);
    }
    const bounds = box(element);
    return { target: { selector: selector(element), text: snippet(element), html, box: bounds }, box: requested };
  };
  const report = (): void => {
    const size = dimensions(), encoded = JSON.stringify(size);
    if (encoded !== lastSize) { lastSize = encoded; send({ type: 'size', ...size }); }
    if (!anchors.length) return;
    const layout = anchors.map(anchor => {
      let element = query(anchor.selector);
      if (!element || (anchor.text && snippet(element) !== anchor.text)) {
        element = anchor.text ? Array.from(doc.body.querySelectorAll('*')).reverse().find(el => snippet(el) === anchor.text) ?? null : null;
      }
      return { key: anchor.key, box: element && element !== doc.body && element !== doc.documentElement ? box(element) : null };
    });
    const value = JSON.stringify(layout);
    if (value !== lastLayout) { lastLayout = value; send({ type: 'layout', anchors: layout }); }
  };
  const schedule = (): void => {
    if (scheduled || destroyed) return;
    scheduled = win.requestAnimationFrame(() => {
      scheduled = 0;
      try {
        if (pending !== undefined) { const html = pending; pending = undefined; stream.update(html); }
        report();
      } catch (error) { send({ type: 'error', message: String(error) }); }
    });
  };
  const configure = (config: MockupConfig): void => {
    if (typeof config.interactive === 'boolean') interactive = config.interactive;
    if (config.theme && typeof config.theme === 'object') {
      for (const key of Object.keys(theme)) if (!(key in config.theme)) doc.documentElement.style.removeProperty(key);
      theme = {};
      for (const [key, value] of Object.entries(config.theme)) if (key.startsWith('--') && typeof value === 'string') {
        doc.documentElement.style.setProperty(key, value); theme[key] = value;
      }
    }
    if (config.mode === 'html' || config.mode === 'svg' || config.mode === 'wire') doc.documentElement.dataset.prismMode = config.mode;
    schedule();
  };
  const receive = (event: MessageEvent): void => {
    const data = event.data as HostMessage;
    if (event.source !== win.parent || !data || data.ns !== 'prism-mockup' || data.v !== 1 || data.id !== opts.id) return;
    try {
      if (data.type === 'render' && typeof data.html === 'string') { pending = data.html; schedule(); }
      else if (data.type === 'config') configure(data);
      else if (data.type === 'anchors' && Array.isArray(data.anchors)) {
        anchors = data.anchors.filter(anchor => anchor && typeof anchor.key === 'string' && typeof anchor.selector === 'string' && (anchor.text === undefined || typeof anchor.text === 'string'));
        if (!anchors.length) lastLayout = '';
        schedule();
      } else if (data.type === 'hit' && Number.isSafeInteger(data.req) && [data.x, data.y, data.w ?? 0, data.h ?? 0].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100)) {
        send({ type: 'hit', req: data.req, ...hit(data) });
      }
    } catch (error) { send({ type: 'error', message: String(error) }); }
  };
  const block = (event: Event): void => { if (!interactive) { event.preventDefault(); event.stopImmediatePropagation(); } };
  win.addEventListener('message', receive);
  for (const name of ['click', 'auxclick', 'submit']) doc.addEventListener(name, block, true);
  const observer = env.ResizeObserver ? new env.ResizeObserver(schedule) : null;
  observer?.observe(doc.body); observer?.observe(doc.documentElement);
  win.addEventListener('resize', schedule);
  send({ type: 'ready' });
  schedule();
  return () => {
    destroyed = true;
    win.cancelAnimationFrame(scheduled); observer?.disconnect();
    win.removeEventListener('message', receive); win.removeEventListener('resize', schedule);
    for (const name of ['click', 'auxclick', 'submit']) doc.removeEventListener(name, block, true);
  };
}

export function buildRuntime(opts: RuntimeOptions): string {
  const json = JSON.stringify(opts).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `(()=>{${MORPH_SOURCE}\nconst boot=()=>(${installRuntime.toString()})(window,${json});if(window.document.body)boot();else window.addEventListener('DOMContentLoaded',boot,{once:true});})();`;
}
