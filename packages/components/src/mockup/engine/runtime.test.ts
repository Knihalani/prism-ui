import { describe, expect, test } from 'bun:test';
import { Window as HappyWindow } from 'happy-dom';
import { buildRuntime, installRuntime } from './runtime';
import type { FrameMessage, HostPayload } from './protocol';

function rig(embedded = false, deferBody = false) {
  const win = new HappyWindow() as unknown as Window & typeof globalThis;
  const parent = new HappyWindow() as unknown as Window & typeof globalThis;
  const messages: FrameMessage[] = [];
  Object.defineProperty(win, 'parent', { value: parent });
  parent.postMessage = (message: FrameMessage) => { messages.push(message); };
  const callbacks = new Map<number, FrameRequestCallback>();
  let next = 0, resized: () => void = () => {};
  win.requestAnimationFrame = callback => { callbacks.set(++next, callback); return next; };
  win.cancelAnimationFrame = id => { callbacks.delete(id); };
  Object.defineProperty(win, 'ResizeObserver', { value: class {
    constructor(callback: () => void) { resized = callback; }
    observe() {} disconnect() {}
  } });
  Object.defineProperty(win.document.documentElement, 'scrollWidth', { configurable: true, value: 1000 });
  Object.defineProperty(win.document.documentElement, 'scrollHeight', { configurable: true, value: 2000 });
  if (deferBody) win.document.body.remove();
  const destroy = embedded ? (new Function('window', buildRuntime({ id: 'test' }))(win), () => {}) : installRuntime(win, { id: 'test' });
  const send = (payload: HostPayload, extra: Record<string, unknown> = {}, source: Window = parent) => {
    win.dispatchEvent(new win.MessageEvent('message', { source, data: { ns: 'prism-mockup', v: 1, id: 'test', ...payload, ...extra } }));
  };
  const flush = () => { const batch = [...callbacks.values()]; callbacks.clear(); for (const callback of batch) callback(0); };
  const close = () => { destroy(); win.close(); parent.close(); };
  return { win, messages, send, flush, close, resize: () => resized(), callbacks };
}

function bounds(element: Element, x: number, y: number, width: number, height: number) {
  element.getBoundingClientRect = () => ({ x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON() {} });
}

describe('runtime', () => {
  test('inline bootstrap waits for a body when executed in the document head', () => {
    const r = rig(true, true);
    try {
      expect(r.messages.length).toBe(0);
      r.win.document.documentElement.appendChild(r.win.document.createElement('body'));
      r.win.dispatchEvent(new r.win.Event('DOMContentLoaded'));
      expect(r.messages[0]!.type).toBe('ready');
      r.send({ type: 'render', html: '<p>booted</p>' }); r.flush();
      expect(r.win.document.body.innerHTML).toBe('<p>booted</p>');
    } finally { r.close(); }
  });
  test('coalesces streaming renders, reports changed size only and embeds without imports', () => {
    for (const embedded of [false, true]) {
      const r = rig(embedded);
      try {
        expect(r.messages[0]!.type).toBe('ready');
        r.send({ type: 'render', html: '<div>old' });
        r.send({ type: 'render', html: '<div><p id="one">hello</p>' });
        expect(r.win.document.body.innerHTML).toBe('');
        expect(r.callbacks.size).toBe(1);
        r.flush();
        const one = r.win.document.querySelector('#one');
        r.send({ type: 'render', html: '<div><p id="one">hello</p><b>world</b></div>', done: true });
        r.flush();
        expect(r.win.document.body.innerHTML).toBe('<div><p id="one">hello</p><b>world</b></div>');
        expect(r.win.document.querySelector('#one')).toBe(one);
        const sizes = r.messages.filter(message => message.type === 'size');
        expect(sizes).toEqual([{ ns: 'prism-mockup', v: 1, id: 'test', type: 'size', width: 1000, height: 2000 }]);
        r.resize(); r.resize(); r.flush();
        expect(r.messages.filter(message => message.type === 'size').length).toBe(1);
        Object.defineProperty(r.win.document.documentElement, 'scrollHeight', { value: 2500 });
        r.resize(); r.flush();
        expect(r.messages.filter(message => message.type === 'size').length).toBe(2);
      } finally { r.close(); }
    }
  });
  test('ignores foreign source, namespace, version, frame id and malformed requests', () => {
    const r = rig();
    try {
      const render: HostPayload = { type: 'render', html: '<p>wrong</p>' };
      r.send(render, {}, r.win);
      for (const extra of [{ ns: 'foreign' }, { v: 2 }, { id: 'other' }]) r.send(render, extra);
      r.send({ type: 'hit', req: 1, x: NaN, y: 0 });
      r.flush();
      expect(r.win.document.body.innerHTML).toBe('');
      expect(r.messages.some(message => message.type === 'hit')).toBe(false);
    } finally { r.close(); }
  });
  test('point and rect hits return unique selectors, snippets and page-percent boxes', () => {
    const r = rig();
    try {
      r.send({ type: 'render', html: '<article id="card"><span data-key="label">  Hello   world </span><p>' + 'long '.repeat(100) + '</p></article>' });
      r.flush();
      const doc = r.win.document, article = doc.querySelector('article')!, span = doc.querySelector('span')!, p = doc.querySelector('p')!;
      bounds(article, 100, 200, 200, 200); bounds(span, 140, 240, 60, 20); bounds(p, 100, 300, 200, 100);
      Object.defineProperty(doc, 'elementFromPoint', { configurable: true, value: (x: number, y: number) => x >= 140 && x <= 200 && y >= 240 && y <= 260 ? span : article });
      r.send({ type: 'hit', req: 1, x: 15, y: 12.5 });
      const point = r.messages.find(message => message.type === 'hit' && message.req === 1);
      expect(point?.type).toBe('hit');
      if (point?.type !== 'hit') throw new Error('missing point hit');
      expect(point.target!.text).toBe('Hello world');
      expect(point.target!.selector).toBe('[data-key="label"]');
      expect(doc.querySelectorAll(point.target!.selector).length).toBe(1);
      expect(point.target!.box).toEqual({ x: 14.000000000000002, y: 12, w: 6, h: 1 });
      r.send({ type: 'hit', req: 2, x: 12, y: 12, w: 15, h: 5 });
      const rect = r.messages.find(message => message.type === 'hit' && message.req === 2);
      if (rect?.type !== 'hit') throw new Error('missing rect hit');
      expect(rect.target!.selector).toBe('#card');
      expect(rect.target!.text.length).toBeLessThanOrEqual(80);
      expect(rect.target!.html.length).toBeLessThanOrEqual(300);
      expect(rect.target!.html).toContain('…');
      expect(rect.box).toEqual({ x: 12, y: 12, w: 15, h: 5 });
      Object.defineProperty(doc, 'elementFromPoint', { configurable: true, value: () => doc.body });
      r.send({ type: 'hit', req: 3, x: 0, y: 0 });
      expect(r.messages.find(message => message.type === 'hit' && message.req === 3)).toMatchObject({ target: null });
    } finally { r.close(); }
  });
  test('tracks anchors in one changed layout message and remaps by text', () => {
    const r = rig();
    try {
      r.send({ type: 'render', html: '<div id="old">wrong</div><p id="new">Anchor text</p>' }); r.flush();
      const p = r.win.document.querySelector('p')!;
      bounds(p, 100, 200, 200, 100);
      r.send({ type: 'anchors', anchors: [{ key: 'a', selector: '#old', text: 'Anchor text' }, { key: 'missing', selector: '[invalid' }] });
      r.resize(); r.resize(); r.flush();
      const layouts = () => r.messages.filter(message => message.type === 'layout');
      expect(layouts().length).toBe(1);
      expect(layouts()[0]).toMatchObject({ anchors: [{ key: 'a', box: { x: 10, y: 10, w: 20, h: 5 } }, { key: 'missing', box: null }] });
      r.resize(); r.flush(); expect(layouts().length).toBe(1);
      bounds(p, 200, 400, 200, 100);
      r.resize(); r.resize(); r.flush(); expect(layouts().length).toBe(2);
      r.send({ type: 'anchors', anchors: [] }); r.flush();
      r.resize(); r.flush(); expect(layouts().length).toBe(2);
    } finally { r.close(); }
  });
  test('blocks click/navigation/submission by default and applies config', () => {
    const r = rig();
    try {
      r.send({ type: 'render', html: '<a href="#go">link</a><form></form>' }); r.flush();
      const click = () => { const event = new r.win.MouseEvent('click', { bubbles: true, cancelable: true }); r.win.document.querySelector('a')!.dispatchEvent(event); return event; };
      expect(click().defaultPrevented).toBe(true);
      const submit = new r.win.Event('submit', { bubbles: true, cancelable: true });
      r.win.document.querySelector('form')!.dispatchEvent(submit);
      expect(submit.defaultPrevented).toBe(true);
      r.send({ type: 'config', interactive: true, mode: 'wire', theme: { '--color': 'red', bad: 'ignored' } });
      expect(click().defaultPrevented).toBe(false);
      expect(r.win.document.documentElement.style.getPropertyValue('--color')).toBe('red');
      expect(r.win.document.documentElement.dataset.prismMode).toBe('wire');
      r.send({ type: 'config', theme: {} });
      expect(r.win.document.documentElement.style.getPropertyValue('--color')).toBe('');
    } finally { r.close(); }
  });
  test('reports render errors and removes listeners on destroy', () => {
    const r = rig();
    const original = r.win.document.body.cloneNode;
    r.win.document.body.cloneNode = () => { throw new Error('render failure'); };
    r.send({ type: 'render', html: '<p>test</p>' }); r.flush();
    expect(r.messages.find(message => message.type === 'error')).toMatchObject({ message: 'Error: render failure' });
    r.win.document.body.cloneNode = original;
    r.close();
    r.send({ type: 'render', html: '<p>ignored</p>' });
    expect(r.callbacks.size).toBe(0);
  });
});

test('RUNTIME_SIZE: built source is bounded, minifiable and safe to inline', async () => {
  const source = buildRuntime({ id: '</script><script>bad</script>' });
  expect(source.toLowerCase()).not.toContain('</script');
  const result = await Bun.build({ entrypoints: ['runtime:entry'], minify: true, plugins: [{
    name: 'runtime-source',
    setup(build) {
      build.onResolve({ filter: /^runtime:entry$/ }, args => ({ path: args.path, namespace: 'runtime' }));
      build.onLoad({ filter: /.*/, namespace: 'runtime' }, () => ({ contents: source, loader: 'js' }));
    },
  }] });
  expect(result.success).toBe(true);
  const min = await result.outputs[0]!.text();
  console.log(`RUNTIME_SIZE raw=${new TextEncoder().encode(source).length} min=${new TextEncoder().encode(min).length} bytes`);
  expect(min.length).toBeLessThan(18000);
  new Function('window', min);
});
