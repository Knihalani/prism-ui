import { describe, expect, test } from 'bun:test';
import { Window as HappyWindow } from 'happy-dom';
import { buildSrcdoc, createFrameController, SANDBOX } from './frame';
import type { FramePayload, HostMessage } from './protocol';

function rig(options: { origin?: string; hitTimeoutMs?: number } = {}) {
  const win = new HappyWindow() as unknown as Window & typeof globalThis;
  const child = new HappyWindow() as unknown as Window & typeof globalThis;
  const iframe = win.document.createElement('iframe');
  const messages: HostMessage[] = [];
  Object.defineProperty(iframe, 'contentWindow', { value: child });
  child.postMessage = (message: HostMessage) => { messages.push(message); };
  const controller = createFrameController({ id: 'test', win, ...options });
  controller.attach(iframe);
  const send = (payload: FramePayload, extra: Record<string, unknown> = {}, origin = options.origin ?? 'null', source: Window = child) => {
    win.dispatchEvent(new win.MessageEvent('message', { source, origin, data: { ns: 'prism-mockup', v: 1, id: 'test', ...payload, ...extra } }));
  };
  const close = () => { controller.destroy(); win.close(); child.close(); };
  return { win, child, iframe, messages, controller, send, close };
}

describe('frame controller', () => {
  test('queues until ready, coalesces renders and resends latest state on reload', () => {
    const r = rig();
    try {
      r.controller.render('<p>old</p>'); r.controller.render('<p>latest</p>', true);
      r.controller.configure({ mode: 'svg', theme: { '--color': 'red' }, title: 'Preview name', lang: 'fr' });
      r.controller.configure({ mode: undefined, interactive: undefined });
      r.controller.setAnchors([{ key: 'a', selector: '#x' }]);
      expect(r.messages.length).toBe(0);
      expect(r.iframe.getAttribute('sandbox')).toBe(SANDBOX);
      expect(r.iframe.srcdoc).toBe(r.controller.srcdoc);
      r.send({ type: 'ready' });
      expect(r.messages.map(message => message.type)).toEqual(['config', 'anchors', 'render']);
      expect(r.messages[0]).toMatchObject({ mode: 'svg', interactive: false, theme: { '--color': 'red' }, title: 'Preview name', lang: 'fr' });
      expect(r.messages[2]).toMatchObject({ ns: 'prism-mockup', v: 1, id: 'test', html: '<p>latest</p>', done: true });
      r.controller.render('<p>newest</p>');
      r.send({ type: 'ready' });
      expect(r.messages.at(-1)).toMatchObject({ type: 'render', html: '<p>newest</p>' });
      expect(r.messages.filter(message => message.type === 'anchors').length).toBe(2);
    } finally { r.close(); }
  });
  test('validates origin, source, namespace, version, id and malformed payloads', () => {
    const r = rig();
    try {
      let calls = 0;
      const off = r.controller.on('size', message => { calls++; expect(message.width).toBe(100); });
      const size: FramePayload = { type: 'size', width: 100, height: 200 };
      r.send(size, {}, 'https://evil');
      r.send(size, {}, 'null', r.win);
      for (const extra of [{ ns: 'foreign' }, { v: 2 }, { id: 'other' }, { width: '100' }]) r.send(size, extra);
      expect(calls).toBe(0);
      r.send(size); expect(calls).toBe(1);
      off(); r.send(size); expect(calls).toBe(1);
      r.send({ type: 'ready' }, {}, 'https://evil'); expect(r.messages.length).toBe(0);
    } finally { r.close(); }
    const custom = rig({ origin: 'https://test.example' });
    try { custom.send({ type: 'ready' }); expect(custom.messages[0]!.type).toBe('config'); }
    finally { custom.close(); }
  });
  test('resolves hit promises, times out missing replies and settles pending on destroy', async () => {
    const r = rig({ hitTimeoutMs: 10 });
    try {
      const queued = r.controller.hit({ x: 10, y: 20 });
      expect(r.messages.length).toBe(0);
      r.send({ type: 'ready' });
      const request = r.messages.find(message => message.type === 'hit');
      if (request?.type !== 'hit') throw new Error('missing hit request');
      const result = { target: null, box: { x: 10, y: 20, w: 0, h: 0 } };
      r.send({ type: 'hit', req: request.req, ...result }, {}, 'https://evil');
      r.send({ type: 'hit', req: request.req, ...result });
      expect(await queued).toEqual(result);
      expect(await r.controller.hit({ x: 0, y: 0 })).toBeNull();
      expect(await r.controller.hit({ x: NaN, y: 0 })).toBeNull();
      const pending = r.controller.hit({ x: 1, y: 2 });
      r.controller.destroy();
      expect(await pending).toBeNull();
      expect(await r.controller.hit({ x: 0, y: 0 })).toBeNull();
    } finally { r.close(); }
  });
  test('destroy stops listening and prevents subsequent messages', () => {
    const r = rig();
    let ready = 0;
    r.controller.on('ready', () => { ready++; });
    r.controller.destroy();
    r.send({ type: 'ready' }); r.controller.render('ignored');
    expect(ready).toBe(0); expect(r.messages.length).toBe(0);
    r.close();
  });
});

test('srcdoc contains escaped CSP, reset CSS and safe inline runtime', () => {
  const html = buildSrcdoc({ id: '</script><script>bad</script>', head: '<title>Mockup</title>' });
  expect(SANDBOX).toBe('allow-scripts');
  expect(html).toContain('http-equiv="Content-Security-Policy"');
  expect(html).toContain("default-src 'none'; img-src data: https:");
  expect(html).toContain('data-prism="runtime"');
  expect(html).toContain('<title>Mockup</title>');
  expect(html).toContain('prism-mockup');
  expect(html.match(/<script>/g)?.length).toBe(1);
  expect(html.match(/<\/script>/g)?.length).toBe(1);
  expect(buildSrcdoc({ id: 'x', csp: 'a"&<b' })).toContain('content="a&quot;&amp;&lt;b"');
});
