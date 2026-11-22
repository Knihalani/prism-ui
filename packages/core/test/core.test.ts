import { describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { createParser, mount, parse, renderToString } from '../src';
import { attributes, relaxed } from '../src/values';

const html = (s: string) => renderToString(parse(s));
describe('markdown', () => {
  test('headings, paragraph, breaks, escapes, safe raw HTML', () => {
    expect(html('# Heading\n\nhello  \nworld\\\nnext \\*literal\\* <b>x</b>')).toBe('<h1>Heading</h1><p>hello<br>world<br>next *literal* &lt;b&gt;x&lt;/b&gt;</p>');
  });
  test('emphasis, strong, strike, partial emphasis and code', () => {
    expect(html('*a* **b** ~~c~~ `x < y`')).toBe('<p><em>a</em> <strong>b</strong> <del>c</del> <code>x &lt; y</code></p>');
    expect(html('**bold')).toBe('<p><strong>bold</strong></p>');
    expect(html('foo_bar_baz')).toBe('<p>foo_bar_baz</p>');
  });
  test('links, images, autolinks and titles', () => {
    expect(html('[x](https://a.test "title") ![alt](x.png) <https://a.test> <a@b.co> https://a.test.')).toContain('<a href="https://a.test" title="title">x</a>');
    expect(html('![alt](x.png)')).toBe('<p><img src="x.png" alt="alt"></p>');
    expect(html('<a@b.co>')).toContain('href="mailto:a@b.co"');
  });
  test('blockquote, nested list, tasks, ordered start and rule', () => {
    const root = parse('> quote\n> **yes**\n\n3. first\n   - [x] nested\n   - [ ] next\n4. last\n\n---');
    expect(root.children.map(n => n.type)).toEqual(['blockquote', 'list', 'thematicBreak']);
    expect(root.children[1].start).toBe(3);
    expect(renderToString(root)).toContain('<input type="checkbox" disabled checked>');
  });
  test('fences with meta and unclosed fence', () => {
    const code = parse('```ts title="demo"\nlet x = 1;\n```').children[0];
    expect(code).toMatchObject({ type: 'code', lang: 'ts', meta: 'title="demo"', complete: true });
    expect(parse('~~~js\nx').children[0]).toMatchObject({ type: 'code', value: 'x', complete: false });
  });
  test('table alignment and escaped pipes', () => {
    const root = parse('| A | B | C |\n| :--- | :---: | ---: |\n| a\\|b | c | d |');
    expect(root.children[0].align).toEqual(['left', 'center', 'right']);
    expect(renderToString(root)).toContain('a|b</td>');
  });
});
describe('directives and relaxed values', () => {
  test('nested containers, leaf and inline', () => {
    const root = parse('::::tabs{active=1}\n:::tab{title="One"}\nHello :badge[New]{tone=success}\n:::\n::leaf{flag}\n::::');
    expect(root.children[0]).toMatchObject({ name: 'tabs', props: { active: 1 }, complete: true });
    expect(root.children[0].children?.map(n => n.name)).toEqual(['tab', 'leaf']);
    expect(renderToString(root, { components: { badge: (_, children) => `<mark>${children}</mark>` } })).toContain('<mark>New</mark>');
  });
  test('attributes have typed scalars, arrays and objects', () => {
    expect(attributes('{key="v" n=3 yes=true no=false flag list=[1,2,] obj={a: \'b\'}}')).toEqual({ key: 'v', n: 3, yes: true, no: false, flag: true, list: [1, 2], obj: { a: 'b' } });
  });
  test('adjacent inline directives have independent balanced attributes', () => {
    const children = parse(':badge[A]{obj={s:"}"}} and :badge[B]{n=2}').children[0].children!;
    expect(children.map(n => n.type)).toEqual(['component', 'text', 'component']);
    expect(children[0].props).toEqual({ obj: { s: '}' } }); expect(children[2].props).toEqual({ n: 2 });
  });
  test('partial JSON grows live without eval', () => {
    const p = createParser(); p.push('```ui:chart\n{points: [1,2, {label: "hel');
    expect(p.root.children[0]).toMatchObject({ name: 'chart', complete: false, props: { points: [1, 2, { label: 'hel' }] } });
    p.push('lo"},],}\n```\n'); expect(p.root.children[0].complete).toBe(true);
    expect(p.root.children[0].props).toEqual({ points: [1, 2, { label: 'hello' }] });
  });
  test('malformed and empty data do not throw', () => {
    for (const s of ['', '{', '{bad', '{x:', '[,', "{a:'", 'null', '!!!']) expect(() => relaxed(s)).not.toThrow();
    expect(parse('```ui:x\n!!!\n```').children[0].props).toEqual({});
    expect(parse(':::card\nbody').children[0].complete).toBe(false);
    expect(parse('')).toEqual({ type: 'root', key: '', children: [] });
  });
});
describe('security', () => {
  test.each(['javascript:alert(1)', 'java\tscript:alert(1)', 'jav&#97;script:alert(1)', 'javascript&colon;alert(1)', 'data:text/html,hi', 'vbscript:x', 'file:///etc/passwd'])('strips unsafe URL %s', url => {
    expect(html(`[x](${url})`)).toContain('href=""');
  });
  test('raw HTML, code and attribute escapes', () => {
    expect(html('<script>alert(1)</script>')).not.toContain('<script>');
    expect(html('```html\n<img onerror=x>\n```')).toContain('&lt;img onerror=x&gt;');
    expect(html('![" onerror="x](a)')).toContain('alt="&quot; onerror=&quot;x"');
    expect(html('![x](data:image/png;base64,AAAA)')).toContain('src="data:image/png;base64,AAAA"');
    expect(html('![x](data:image/svg+xml,boom)')).toContain('src=""');
  });
  test('prototype pollution is discarded', () => {
    expect(relaxed('{__proto__: {polluted:true}, constructor: 1, ok: 2}')).toEqual({ ok: 2 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(renderToString(parse('::toString'), { components: {} })).toBe('<div data-prism-component="toString"></div>');
  });
});
describe('streaming', () => {
  test('newline-complete headings and leaves are immediately stable', () => {
    const p = createParser(); p.push('# Heading\n::leaf\n'); const [heading, leaf] = p.root.children;
    p.push('paragraph'); expect(p.root.children[0]).toBe(heading); expect(p.root.children[1]).toBe(leaf);
    expect(Object.isFrozen(heading)).toBe(true);
  });
  test('finished blocks recursively freeze and retain identity', () => {
    const p = createParser(); p.push('one **bold**\n\n'); const first = p.root.children[0];
    p.push('two'); expect(p.root.children[0]).toBe(first); expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.children?.[0])).toBe(true); expect(p.root.children[1].key).toBe('1');
    p.end(); expect(() => p.push('more')).toThrow('ended'); expect(p.end().root).toBe(p.root);
  });
  test('seeded property: random documents and random chunk boundaries', () => {
    let seed = 1234567; const random = (n: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
    const pieces = ['# Title\n', 'plain **bold** and :badge[X]{n=2}\n\n', '- one\n  - two\n\n', '```js\nx()\n```\n', '::::tabs\n:::tab\nx\n:::\n::::\n', '|x|y|\n|---|---:|\n|1|2|\n\n', '```ui:chart\n{x:[1,2,]}\n```\n', '> quote\n\n', '\r\n', '***\n', '<script>x</script>\n'];
    for (let run = 0; run < 250; run++) {
      let doc = ''; for (let i = 0, n = random(20); i < n; i++) doc += pieces[random(pieces.length)];
      const p = createParser(); let offset = 0;
      while (offset < doc.length) { const n = 1 + random(19); p.push(doc.slice(offset, offset + n)); void p.root; offset += n; }
      expect(p.end().root).toEqual(parse(doc));
    }
  });
});
describe('DOM', () => {
  test('unchanged blocks are untouched, open tail replaces and components work', () => {
    const win = new Window(); const host = win.document.createElement('main'); host.innerHTML = '<p>old</p>';
    const renderer = mount(host as unknown as Element, { components: { badge: (node, doc) => { const b = doc.createElement('button'); b.textContent = node.children?.[0]?.value ?? ''; return b; } } });
    const p = createParser(); p.push('first\n\nsecond'); renderer.update(p.root);
    const first = host.firstChild!; let touches = 0;
    const observer = new win.MutationObserver(records => { touches += records.length; }); observer.observe(first, { subtree: true, attributes: true, childList: true, characterData: true });
    p.push(' :badge[Go]{tone=ok}'); renderer.update(p.root);
    expect(host.firstChild).toBe(first); expect(host.querySelector('button')?.textContent).toBe('Go');
    expect(observer.takeRecords()).toHaveLength(0); expect(touches).toBe(0);
    renderer.update(parse('replacement')); expect(host.childNodes.length).toBe(1);
    renderer.update(parse('')); expect(host.childNodes.length).toBe(0); observer.disconnect(); win.close();
  });
});
