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
  test('closed code and link atoms take precedence over emphasis', () => {
    const cases = [
      ['*a `b*c`', '<p>*a <code>b*c</code></p>'],
      ['*a `b*c', '<p><em>a `b</em>c</p>'],
      ['*a `b*c` d*', '<p><em>a <code>b*c</code> d</em></p>'],
      ['**a `b**c` d**', '<p><strong>a <code>b**c</code> d</strong></p>'],
      ['*a [b*c](/url) d*', '<p><em>a <a href="/url">b*c</a> d</em></p>'],
      ['*a [b](/u*rl) d*', '<p><em>a <a href="/u*rl">b</a> d</em></p>'],
      ['*a <https://a.test/b*c> d*', '<p><em>a <a href="https://a.test/b*c">https://a.test/b*c</a> d</em></p>'],
      ['`a``b`', '<p><code>a``b</code></p>'],
      ['`unclosed', '<p>`unclosed</p>'],
      ['', ''],
    ];
    for (const [text, expected] of cases) {
      expect(html(text)).toBe(expected);
      for (let split = 0; split <= text.length; split++) {
        const p = createParser(); p.push(text.slice(0, split)); void p.root.children.at(-1); p.push(text.slice(split)); void p.root.children.at(-1);
        expect(p.end().root).toEqual(parse(text));
      }
    }
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
  test('setext headings, multiline headings and thematic break disambiguation', () => {
    expect(html('Title\n===\n\nSubtitle\n---\n\n---')).toBe('<h1>Title</h1><h2>Subtitle</h2><hr>');
    expect(html('two\nlines\n===')).toBe('<h1>two\nlines</h1>');
    expect(html('a\n\n---')).toBe('<p>a</p><hr>');
  });
  test('full, collapsed, shortcut and image references, forward definitions', () => {
    expect(html('[Full][ID] [id][] [ID] ![alt][pic]\n\n[id]: <https://example.com> "title"\n[pic]: image.png')).toBe('<p><a href="https://example.com" title="title">Full</a> <a href="https://example.com" title="title">id</a> <a href="https://example.com" title="title">ID</a> <img src="image.png" alt="alt"></p>');
    expect(html('[ A   B ]\n\n[a b]: /first\n[A B]: /second')).toContain('href="/first"');
    expect(html('[missing] [x][unknown]')).toBe('<p>[missing] [x][unknown]</p>');
    expect(html('[first] [inline](/url)\n\n[first]: /ref')).toBe('<p><a href="/ref">first</a> <a href="/url">inline</a></p>');
    expect(html('[x]\n\n[x]: javascript:alert(1)')).toBe('<p><a href="">x</a></p>');
    expect(html('[empty]: /url\n')).toBe('');
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
  test('lazy open previews resume new bytes and publish new block wrappers', () => {
    const p = createParser(); p.push('**bo');
    const first = p.root.children[0]; expect(renderToString(first)).toBe('<p><strong>bo</strong></p>');
    expect(p.root.children[0]).toBe(first);
    p.push('ld'); const second = p.root.children[0]; expect(second).not.toBe(first);
    expect(renderToString(second)).toBe('<p><strong>bold</strong></p>');
    p.push('** and `x'); expect(renderToString(p.root)).toContain('<code>x</code>');
    p.push('`'); expect(p.end().root).toEqual(parse('**bold** and `x`'));
  });
  test('persistent block arrays preserve finished references without copying the prefix', () => {
    const p = createParser(); p.push('first\n\n'); const first = p.root.children[0]; const children = p.root.children;
    p.push('a long '); const tail = p.root.children[1];
    p.push('paragraph'); expect(p.root.children).not.toBe(children); expect(children).toHaveLength(1); expect(p.root.children[0]).toBe(first);
    expect(p.root.children[1]).not.toBe(tail); expect(Object.isFrozen(first)).toBe(true);
    expect(renderToString(p.root)).toContain('a long paragraph');
  });
  test('finished children of an open container keep identity', () => {
    const p = createParser(); p.push(':::card\nfirst\n\n'); const first = p.root.children[0].children![0];
    p.push('second\n\n'); expect(p.root.children[0].children![0]).toBe(first);
    p.push(':::\n'); expect(p.root.children[0].children![0]).toBe(first); expect(Object.isFrozen(first)).toBe(true);
  });
  test('forward references remain provisional until resolved and then freeze', () => {
    const p = createParser(); p.push('[label][ref]\n\n'); const unresolved = p.root.children[0];
    expect(Object.isFrozen(unresolved)).toBe(false);
    p.push('[ref]: /target\n'); expect(p.root.children[0]).not.toBe(unresolved); expect(Object.isFrozen(p.root.children[0])).toBe(true);
    expect(renderToString(p.root)).toBe('<p><a href="/target">label</a></p>');
    const stable = p.root.children[0]; p.push('\nlast'); expect(p.root.children[0]).toBe(stable);
    const nested = createParser(); nested.push(':::card\n[x]\n\n:::\n\n[x]: /nested\n');
    expect(renderToString(nested.end().root)).toContain('href="/nested"');
    const adjacent = createParser(); adjacent.push(':::card\n[x]\n:::\n[x]: /nested\n');
    expect(adjacent.end().root).toEqual(parse(':::card\n[x]\n:::\n[x]: /nested\n'));
  });
  test('container closing syntax inside code is not a container terminator', () => {
    expect(html(':::card\n```text\n:::\n```\n:::')).toBe('<div data-prism-component="card"><pre><code class="language-text">:::</code></pre></div>');
  });
  test('every split preserves new syntax and tolerant JSON', () => {
    const documents = ['Title\n===\n\n[x][id]\n\n[id]: /url "t"\n', ':::card\n[x]\n\n:::\n[x]: /url\n', '```ui:table\n{rows:[{x:1,label:"a\\u0041"}, {x:2,ok:true},],}\n```', ':badge[A]{obj={s:"}"}} and :badge[B]{n=2}'];
    for (const doc of documents) for (let split = 0; split <= doc.length; split++) {
      const p = createParser(); p.push(doc.slice(0, split)); void p.root; p.push(doc.slice(split));
      expect(p.end().root).toEqual(parse(doc));
    }
  });
  test('random malformed inline text has chunk-independent final tokenization', () => {
    let seed = 17; const next = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed; };
    const alphabet = 'abc *~_`[]():{}!<>\\\n';
    for (let run = 0; run < 300; run++) {
      let text = ''; for (let i = 0, n = next() % 160; i < n; i++) text += alphabet[next() % alphabet.length];
      const p = createParser(); let i = 0; while (i < text.length) { const n = 1 + next() % 9; p.push(text.slice(i, i + n)); void p.root.children.at(-1); i += n; }
      expect(p.end().root).toEqual(parse(text));
    }
  });
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
    const pieces = ['# Title\n', 'plain **bold** and :badge[X]{n=2}\n\n', '- one\n  - two\n\n', '```js\nx()\n```\n', '::::tabs\n:::tab\nx\n:::\n::::\n', '|x|y|\n|---|---:|\n|1|2|\n\n', '```ui:chart\n{x:[1,2,]}\n```\n', '> quote\n\n', '\r\n', '***\n', '<script>x</script>\n', 'Setext\n===\n\n', '[label][ref]\n\n', '[ref]: /url\n'];
    for (let run = 0; run < 250; run++) {
      let doc = ''; for (let i = 0, n = random(20); i < n; i++) doc += pieces[random(pieces.length)];
      const p = createParser(); let offset = 0;
      while (offset < doc.length) { const n = 1 + random(19); p.push(doc.slice(offset, offset + n)); void p.root; offset += n; }
      expect(p.end().root).toEqual(parse(doc));
    }
  });
});
describe('DOM', () => {
  test('unresolved references are text until their definitions arrive', () => {
    const win = new Window(); const host = win.document.createElement('div'); const view = mount(host as unknown as Element);
    const p = createParser(); view.update(p.push('[x]\n\n').root); expect(host.textContent).toBe('[x]');
    view.update(p.push('[x]: /url\n').root); expect(host.querySelector('a')?.getAttribute('href')).toBe('/url'); win.close();
  });
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
