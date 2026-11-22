import { describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { createStreamMorpher, morph, morphDocument, MORPH_SOURCE, trimPartialTag } from './morph';

function document(): Document { return new Window().document as unknown as Document; }
function element(doc: Document, html: string): Element {
  const template = doc.createElement('template');
  template.innerHTML = html;
  return template.content.firstElementChild!;
}

describe('morph', () => {
  test('keyed reorder preserves identity and never reuses different tags', () => {
    const doc = document();
    doc.body.innerHTML = '<p id="a">A</p><p data-key="b">B</p>';
    const [a, b] = Array.from(doc.body.children);
    morph(doc.body, element(doc, '<div></div>'));
    doc.body.append(a!, b!);
    morph(doc.body, element(doc, '<div><p data-key="b">B!</p><p id="a">A</p></div>'));
    expect(doc.body.children[0]).toBe(b!);
    expect(doc.body.children[1]).toBe(a!);
    morph(doc.body, element(doc, '<div><section data-key="b">new</section></div>'));
    expect(doc.body.firstElementChild).not.toBe(b!);
    expect(doc.body.innerHTML).toBe('<section data-key="b">new</section>');
  });
  test('unkeyed append, text/comments, attributes, empty and skip', () => {
    const doc = document();
    doc.body.innerHTML = '<p old="x">old<!--old--></p>';
    const p = doc.body.firstElementChild!;
    morph(doc.body, element(doc, '<div><p title="new">new<!--new--></p><p>next</p></div>'));
    expect(doc.body.firstElementChild).toBe(p);
    expect(p.outerHTML).toBe('<p title="new">new<!--new--></p>');
    morph(p, element(doc, '<p id="x">skip</p>'), { childrenOnly: false, onBeforeUpdate: () => false });
    expect(p.hasAttribute('id')).toBe(false);
    morph(p, element(doc, '<p id="x">own</p>'), { childrenOnly: false });
    expect(p.outerHTML).toBe('<p id="x">own</p>');
    morph(doc.body, element(doc, '<div></div>'));
    expect(doc.body.childNodes.length).toBe(0);
  });
  test('custom keys', () => {
    const doc = document();
    doc.body.innerHTML = '<i title="a"></i><i title="b"></i>';
    const a = doc.body.firstChild;
    morph(doc.body, element(doc, '<div><i title="b"></i><i title="a"></i></div>'), { key: el => el.getAttribute('title') });
    expect(doc.body.lastChild).toBe(a);
  });
  test('updates form state but preserves focused edits', () => {
    const doc = document();
    doc.body.innerHTML = '<input value="old"><textarea>old</textarea><select><option>a</option><option>b</option></select>';
    const input = doc.querySelector('input')!;
    input.focus();
    input.value = 'typing';
    morph(doc.body, element(doc, '<div><input value="new" checked><textarea>new</textarea><select><option>a</option><option selected>b</option></select></div>'));
    expect(input.value).toBe('typing');
    expect(doc.querySelector('textarea')!.value).toBe('new');
    expect(doc.querySelector('select')!.value).toBe('b');
    input.blur();
    morph(input, element(doc, '<input value="next" checked>'), { childrenOnly: false });
    expect(input.value).toBe('next');
    expect(input.checked).toBe(true);
  });
  test('streaming equals full parse and manages only its own head nodes', () => {
    const doc = document();
    doc.head.innerHTML = '<style id="runtime">body{margin:0}</style>';
    const runtime = doc.head.firstChild;
    const html = '<html><head><style>p{color:red}</style><link rel="stylesheet" href="data:text/css,x"></head><body><main><p id="a">Hello &amp; world</p><p>Goodbye</p></main></body></html>';
    for (let i = 1; i <= html.length; i++) morphDocument(doc, html.slice(0, i));
    const expected = document();
    expected.documentElement.innerHTML = html;
    expect(doc.body.innerHTML).toBe(expected.body.innerHTML);
    const style = doc.head.querySelector('[data-prism="morph"]');
    morphDocument(doc, html.replace('red', 'blue'));
    expect(doc.head.querySelector('[data-prism="morph"]')).toBe(style);
    expect(style!.textContent).toBe('p{color:blue}');
    morphDocument(doc, '');
    expect(doc.head.childNodes.length).toBe(1);
    expect(doc.head.firstChild).toBe(runtime);
  });
  test('source embeds without module bindings', () => {
    const embedded = new Function(`${MORPH_SOURCE}; return {morph, morphDocument, trimPartialTag};`)() as { morphDocument: typeof morphDocument };
    const doc = document();
    embedded.morphDocument(doc, '<head><style>b{color:red}</style></head><body><b>hello</b><div cla');
    expect(doc.body.innerHTML).toBe('<b>hello</b>');
    expect(doc.head.querySelector('style')!.textContent).toBe('b{color:red}');
  });
});

test('trim partial tags, comments and entities without clipping quoted >', () => {
  for (const tail of ['<div cla', '<!-- x', '&am', '&#x2', '&#12', '<img title="a>b']) expect(trimPartialTag('hello' + tail)).toBe('hello');
  for (const complete of ['', '<p title=">">ok</p>', '<!-- x -->', '&amp;', 'a <b>text']) expect(trimPartialTag(complete)).toBe(complete);
});

describe('createStreamMorpher', () => {
  const streamPage = (html: string, chunk: number): Document => {
    const doc = document();
    const stream = createStreamMorpher(doc);
    for (let end = chunk; end < html.length + chunk; end += chunk) stream.update(html.slice(0, end));
    const expected = document();
    morphDocument(expected, html);
    expect(doc.body.innerHTML).toBe(expected.body.innerHTML);
    expect(doc.head.innerHTML).toBe(expected.head.innerHTML);
    return doc;
  };
  test('streams flat, nested and deeply wrapped pages to the full parse', () => {
    const cards = Array.from({ length: 30 }, (_, i) => `<article id="c${i}"><h2>Card ${i}</h2><p>Text &amp; more</p></article>`).join('');
    for (const page of [cards, `<div class="page">${cards}</div>`, `<div><main><section><div>${cards}</div></section></main></div>`]) {
      for (const chunk of [1, 7, 50]) streamPage(page, chunk);
    }
  });
  test('flushes bare body text before document closing tags in one shot and at every split', () => {
    for (const html of [
      '<html><body>Hello</body></html>',
      '<body>Hello</body>',
      '<!doctype html><html><head></head><body>Hello &amp; goodbye</body></html>',
      '<html><body><b>First</b> then bare text</body></html>',
      '<html><body></body></html>',
    ]) {
      const expected = document();
      morphDocument(expected, html);
      const oneShot = document();
      createStreamMorpher(oneShot).update(html);
      expect(oneShot.body.innerHTML).toBe(expected.body.innerHTML);
      for (let offset = 0; offset <= html.length; offset++) {
        const doc = document();
        const stream = createStreamMorpher(doc);
        stream.update(html.slice(0, offset));
        stream.update(html);
        expect(doc.body.innerHTML).toBe(expected.body.innerHTML);
      }
    }
  });
  test('scanner handles quoted >, comments with tags, raw text, void and SVG elements', () => {
    const page = '<div title="a > b" data-x=\'c>d\'><!-- <div><script> -->' +
      '<script>const html = "</div><p>"; const x = 1 < 2;</script>' +
      '<style>.x::before{content:"</div>"}</style><textarea>&lt;div&gt;</textarea>' +
      '<br><img src="data:image/png;base64,x"><input value="x"><hr>' +
      '<svg viewBox="0 0 20 20"><g><path d="M0 0"/><circle r="3" /></g></svg><p>end</p></div>';
    for (const chunk of [1, 2, 11, 50]) streamPage(page, chunk);
  });
  test('completed siblings remain frozen even inside an open wrapper chain', () => {
    const doc = document();
    const stream = createStreamMorpher(doc);
    const prefix = '<div><main><section><article id="frozen"><b>first</b></article>';
    stream.update(prefix);
    const frozen = doc.querySelector('#frozen')!;
    frozen.isEqualNode = () => { throw new Error('frozen subtree was compared'); };
    frozen.textContent = 'local state';
    stream.update(prefix + '<article><p>second');
    stream.update(prefix + '<article><p>second</p></article></section></main></div>');
    expect(doc.querySelector('#frozen')).toBe(frozen);
    expect(frozen.textContent).toBe('local state');
    expect(doc.querySelectorAll('article').length).toBe(2);
  });
  test('preserves the live tail and focused input identity', () => {
    const doc = document();
    const stream = createStreamMorpher(doc);
    stream.update('<div><p>done</p><input value="initial"><span>par');
    const input = doc.querySelector('input')!;
    const span = doc.querySelector('span');
    input.focus(); input.value = 'edited';
    stream.update('<div><p>done</p><input value="initial"><span>partial</span></div>');
    expect(doc.querySelector('input')).toBe(input);
    expect(input.value).toBe('edited');
    expect(doc.querySelector('span')).toBe(span);
  });
  test('rewrites, wrappers, parser-sensitive HTML and reset fall back correctly', () => {
    const doc = document();
    const stream = createStreamMorpher(doc);
    stream.update('<div><p>old</p>');
    stream.update('<div><p>new</p></div>');
    expect(doc.body.innerHTML).toBe('<div><p>new</p></div>');
    stream.update('');
    expect(doc.body.innerHTML).toBe('');
    stream.reset();
    stream.update('<b>reset</b>');
    expect(doc.body.innerHTML).toBe('<b>reset</b>');
    for (const html of ['<html><head><style>b{color:red}</style></head><body><b>hi</b></body></html>', '<table><tbody><tr><td>x</td></tr></tbody></table>', '<p>one<div>two</div>', '<ul><li>a<li>b</ul>']) streamPage(html, 3);
  });
  test('reset forgets the previous head and checks rewrites in a frozen prefix', () => {
    const doc = document();
    doc.head.innerHTML = '<style id="runtime">body{margin:0}</style>';
    const stream = createStreamMorpher(doc);
    stream.update('<head><style>b{color:red}</style></head><body><b>old</b></body>');
    expect(doc.head.querySelectorAll('[data-prism="morph"]').length).toBe(1);
    stream.reset();
    stream.update('<div><p>before</p><b>tail');
    expect(doc.head.querySelectorAll('[data-prism="morph"]').length).toBe(0);
    expect(doc.head.querySelector('#runtime')).not.toBeNull();
    stream.update('<div><p>edited</p><b>tail plus</b></div>');
    expect(doc.body.innerHTML).toBe('<div><p>edited</p><b>tail plus</b></div>');
  });
  test('relocated leading styles do not invalidate anchors after a rewrite and repeated updates', () => {
    const win = new Window();
    const doc = win.document as unknown as Document;
    const innerHTML = Object.getOwnPropertyDescriptor(win.Element.prototype, 'innerHTML')!;
    const createDocument = doc.implementation.createHTMLDocument.bind(doc.implementation);
    doc.implementation.createHTMLDocument = title => {
      const parsed = createDocument(title);
      Object.defineProperty(parsed.documentElement, 'innerHTML', {
        get() { return innerHTML.get!.call(this); },
        set(html: string) {
          innerHTML.set!.call(this, html);
          // Happy DOM leaves leading styles in body; browsers parse them into head.
          while (parsed.body.firstElementChild?.tagName === 'STYLE') parsed.head.appendChild(parsed.body.firstElementChild);
        },
      });
      return parsed;
    };
    const stream = createStreamMorpher(doc);
    stream.update('<style>p{color:red}</style><main><p>Old</p></main>');
    const html = '<style>p{color:blue}</style><main><p>New</p></main>';
    stream.update(html);
    expect(doc.body.innerHTML).toBe('<main><p>New</p></main>');
    const main = doc.body.firstElementChild;
    for (let repeat = 0; repeat < 3; repeat++) {
      stream.update(html);
      expect(doc.body.innerHTML).toBe('<main><p>New</p></main>');
      expect(doc.body.firstElementChild).toBe(main);
      expect(doc.head.querySelector('style')!.textContent).toBe('p{color:blue}');
    }
    stream.update(html + '<aside>More</aside>');
    expect(doc.body.innerHTML).toBe('<main><p>New</p></main><aside>More</aside>');
    stream.update('');
    expect(doc.body.innerHTML).toBe('');
    expect(doc.head.querySelector('style')).toBeNull();
  });
  test('embeds stream morpher without module bindings', () => {
    const factory = new Function(`${MORPH_SOURCE}; return createStreamMorpher;`)() as typeof createStreamMorpher;
    const doc = document();
    const stream = factory(doc);
    stream.update('<div><p>one</p>');
    stream.update('<div><p>one</p><b>two</b></div>');
    expect(doc.body.innerHTML).toBe('<div><p>one</p><b>two</b></div>');
  });
  test('full documents stream body incrementally without touching unchanged head styles', () => {
    const header = '<!doctype html><html><head><meta charset="utf-8"><style>p{color:red}</style><link rel="stylesheet" href="data:text/css,x"></head><body>';
    const html = header + '<div><p id="one">one</p><p>two</p></div></body></html>';
    for (const chunk of [1, 11, 50]) streamPage(html, chunk);
    const doc = document(), stream = createStreamMorpher(doc);
    stream.update(header + '<div><p id="one">one</p>');
    const style = doc.head.querySelector('style')!;
    style.isEqualNode = () => { throw new Error('unchanged head was diffed'); };
    const p = doc.querySelector('#one')!;
    p.isEqualNode = () => { throw new Error('completed body child was diffed'); };
    stream.update(html);
    expect(doc.head.querySelector('style')).toBe(style);
    expect(doc.querySelector('#one')).toBe(p);
  });
  test('rewrite rebuilds scanner state and unsupported constructs stop forcing fallback when removed', () => {
    const doc = document(), stream = createStreamMorpher(doc);
    stream.update('<table><tr><td>old</td></tr></table>');
    stream.update('<div><p id="one">edited</p><b>tail');
    const p = doc.querySelector('#one')!;
    p.isEqualNode = () => { throw new Error('rewrite did not recover incremental scanning'); };
    stream.update('<div><p id="one">edited</p><b>tail more</b></div>');
    expect(doc.body.innerHTML).toBe('<div><p id="one">edited</p><b>tail more</b></div>');
    expect(doc.querySelector('#one')).toBe(p);
  });
});
