import { describe, expect, test } from 'bun:test';
import { createHighlighter as createCoreHighlighter, defineLanguage } from './core';
import { javascript } from './languages/js';
import { createHighlighter, createIncremental, getLanguage, highlight, listLanguages, registerLanguage, resolveLang, setHighlighter, tokenize, type TokenType } from './index';

const samples: Record<string, string> = {
  js: 'const re = /a[\\/]b+/gi; const ratio = 4 / 2;\n/* multi\nline */\nconst t = `hello ${ {x: `nested ${user.name}`} }\nworld`;\nconsole.log(t);\n',
  ts: 'interface User { name: string; age?: number }\nexport async function greet(user: User): Promise<string> {\n  return `Hello ${user.name}`;\n}\n',
  jsx: 'const view = <div className="card">\n  Hello {user.name}<Button onClick={() => run()}>Go</Button>\n</div>;\n',
  tsx: 'const view: View = <><Panel title="Hi">{items.map(x => <Item key={x.id} />)}</Panel></>;\n',
  python: '@cache\ndef greet(name: str):\n    """multi\n    line doc"""\n    text = f"hello {name.upper()}"\n    return f"""value { {"a": 2} }\nmore {len(name)}""" # end\n',
  bash: '#!/bin/bash\nfor f in *.ts; do\n  echo "file $f $(printf "%s" "$HOME")"\ndone\ncat <<\'EOF\'\nhello $world\nEOF\n# end\n',
  json: '{\n  "name": "<Alice>", /* multi\n  line */ "age": 42, "active": true, "items": [null, -2.3e+4]\n}\n',
  css: '@media (min-width: 20px) {\n.card:hover { color: #abc; --gap: 2rem; content: "<hi>"; }\n/* multi\nline */\n}\n',
  html: '<!DOCTYPE html>\n<!-- multi\ncomment -->\n<div title="hello\nworld">Hi &amp;</div>\n<script>const x = `a ${2}`; /* hi\nthere */</script>\n<style>.a { color: red; }</style>\n',
  go: 'package main\nimport "fmt"\nfunc main() {\n  value := `raw\nstring`; fmt.Println(value) // hi\n}\n',
  rust: '/* outer /* nested */\nend */\nfn borrow<\'a>(x: &\'a str) -> &\'a str {\n let s = r##"raw " string\nend"##; println!("{}", s); x\n}\n',
  sql: "select COUNT(*) from users where name = 'O''Brien' and age >= 18;\n/* multi\nline */ SELECT $$dollar\nstring$$, true;\n",
  yaml: '---\nname: Alice # note\nitems: &items\n  - 42\n  - true\ncopy: *items\ntext: |\n  multi\n  line\nlast: "value"\n',
  diff: 'diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1 +1 @@\n-old\n+new\n context\n',
};
function has(lang: string, type: TokenType, text: string) {
  expect(tokenize(samples[lang], lang).some(token => token.type === type && token.text.includes(text))).toBe(true);
}
describe('language scanners', () => {
  test('JS regex versus division, templates and nested expressions', () => {
    has('js', 'keyword', 'const'); has('js', 'regex', '/a[\\/]b+/gi'); has('js', 'operator', '/');
    has('js', 'property', 'name'); has('js', 'string', 'world'); has('js', 'comment', 'line');
    const tokens = tokenize('const t = `a ${`b ${x}`} c`; let y = 2', 'js');
    expect(tokens.find(token => token.text === 'x')?.type).toBe('variable');
    expect(tokens.find(token => token.text === 'let')?.type).toBe('keyword');
  });
  test('TypeScript types and declarations', () => { has('ts', 'keyword', 'interface'); has('ts', 'type', 'string'); has('ts', 'type', 'Promise'); });
  test('JSX and TSX tags, attributes, children and expressions', () => {
    for (const lang of ['jsx', 'tsx']) { has(lang, 'tag', lang === 'jsx' ? 'Button' : 'Panel'); has(lang, 'attr', lang === 'jsx' ? 'onClick' : 'title'); }
    has('jsx', 'property', 'name'); has('tsx', 'function', 'map');
    const comparison = tokenize('const v = <div>{a<b ? <A /> : <B />}</div>; const done = true;', 'tsx');
    expect(comparison.some(token => token.text === 'b' && token.type === 'variable')).toBe(true);
    expect(comparison.filter(token => token.type === 'keyword' && token.text === 'const')).toHaveLength(2);
    expect(tokenize(samples.tsx, 'tsx').some(token => token.type === 'punctuation' && token.text.includes(')}'))).toBe(true);
  });
  test('Python triples, f-expressions, decorators and builtins', () => { has('python', 'meta', '@cache'); has('python', 'string', 'line doc'); has('python', 'builtin', 'len'); has('python', 'function', 'upper'); });
  test('shell variables, substitutions and heredocs', () => { has('bash', 'keyword', 'for'); has('bash', 'variable', '$HOME'); has('bash', 'builtin', 'printf'); has('bash', 'string', 'hello $world'); has('bash', 'meta', 'EOF'); });
  test('JSON keys, numbers, comments and literals', () => { has('json', 'property', '"name"'); has('json', 'number', '-2.3e+4'); has('json', 'constant', 'true'); has('json', 'comment', 'line'); });
  test('CSS selectors, properties, values and at-rules', () => { has('css', 'meta', '@media'); has('css', 'tag', 'card'); has('css', 'property', 'color'); has('css', 'number', '#abc'); });
  test('HTML markup and delegated script/style', () => { has('html', 'tag', 'div'); has('html', 'attr', 'title'); has('html', 'keyword', 'const'); has('html', 'property', 'color'); has('html', 'comment', 'comment'); });
  test('HTML raw-text end tags require a boundary and are case-insensitive', () => {
    const tokens = tokenize('<script>const x = "</scripture>";\nconst y = 2;</SCRIPT><p>hi</p>', 'html');
    expect(tokens.filter(token => token.type === 'keyword' && token.text === 'const')).toHaveLength(2);
    expect(tokens.some(token => token.type === 'tag' && token.text === 'SCRIPT')).toBe(true);
  });
  test('Go raw strings and functions', () => { has('go', 'keyword', 'package'); has('go', 'string', 'string`'); has('go', 'function', 'main'); });
  test('Rust nested comments, raw strings, lifetimes and macros', () => { has('rust', 'type', "'a"); has('rust', 'string', 'end"##'); has('rust', 'function', 'println'); has('rust', 'comment', 'end */'); });
  test('SQL case-insensitive keywords, escaped quotes, dollar strings', () => { has('sql', 'keyword', 'select'); has('sql', 'builtin', 'COUNT'); has('sql', 'string', "O''Brien"); has('sql', 'string', 'string$$'); });
  test('YAML keys, anchors, block scalars and constants', () => { has('yaml', 'property', 'name'); has('yaml', 'variable', '&items'); has('yaml', 'string', 'multi'); has('yaml', 'constant', 'true'); });
  test('diff line categories', () => { has('diff', 'meta', '@@'); has('diff', 'deleted', '-old'); has('diff', 'inserted', '+new'); });
});

describe('streaming and token invariants', () => {
  for (const [lang, sample] of Object.entries(samples)) {
    test(`${lang}: random chunks equal full highlighting and tokenization`, () => {
      for (let seed = 1; seed <= 4; seed++) {
        let random = seed; let end = 0;
        const incremental = createIncremental(lang);
        while (end < sample.length) {
          random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
          end = Math.min(sample.length, end + 1 + random % 23);
          const code = sample.slice(0, end);
          expect(incremental.update(code)).toBe(highlight(code, lang));
          expect(incremental.tokens()).toEqual(tokenize(code, lang));
        }
        expect(incremental.tokens().map(token => token.text).join('')).toBe(sample);
        const changed = sample.replace(/\w/, 'Z');
        expect(incremental.update(changed)).toBe(highlight(changed, lang));
        expect(incremental.tokens()).toEqual(tokenize(changed, lang));
        expect(incremental.update(sample.slice(0, 10))).toBe(highlight(sample.slice(0, 10), lang));
        incremental.reset(); expect(incremental.tokens()).toEqual([]);
        expect(incremental.update(sample)).toBe(highlight(sample, lang));
      }
    });
  }
  test('tokens are lossless, non-empty and adjacent types are merged, even malformed input', () => {
    let seed = 123;
    const alphabet = 'a1\n\r"\'`$<>{}[]()/\\#*;: -_&!';
    let noise = '';
    for (let i = 0; i < 400; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; noise += alphabet[seed % alphabet.length]; }
    for (const lang of listLanguages()) {
      for (const code of [noise, samples[lang] ?? '', '', '😀 e\u0301 <script>']) {
        const tokens = tokenize(code, lang);
        expect(tokens.map(token => token.text).join('')).toBe(code);
        for (let i = 0; i < tokens.length; i++) { expect(tokens[i].text.length).toBeGreaterThan(0); if (i) expect(tokens[i].type).not.toBe(tokens[i - 1].type); }
      }
    }
  });
});

describe('registry, caching and backends', () => {
  test('aliases resolve to canonical names', () => {
    const groups = { js: ['javascript', 'mjs', 'cjs'], ts: ['typescript', 'mts'], python: ['py', 'python3'], bash: ['sh', 'shell', 'zsh', 'console'], go: ['golang'], rust: ['rs'], yaml: ['yml'], diff: ['patch'], html: ['htm', 'xml', 'svg'], sql: ['postgres', 'mysql', 'sqlite'], json: ['jsonc', 'json5'] };
    for (const [canonical, aliases] of Object.entries(groups)) for (const alias of aliases) { expect(resolveLang(alias.toUpperCase())).toBe(canonical); expect(getLanguage(alias)).toBe(getLanguage(canonical)); }
    expect(listLanguages()).toContain('tsx'); expect(resolveLang('unknown')).toBe('unknown');
  });
  test('core alone is empty; chosen languages, custom language and aliases work', () => {
    expect(createCoreHighlighter().listLanguages()).toEqual([]);
    expect(createCoreHighlighter({ languages: [javascript] }).listLanguages()).toEqual(['js']);
    const custom = defineLanguage('custom', () => 0, (line, state, emit) => { emit('meta', line); return state + 1; });
    registerLanguage('custom', custom, ['custom-alias']);
    expect(getLanguage('custom-alias')).toBe(custom);
    expect(highlight('<x>', 'custom-alias')).toBe('<span class="prism-tok-meta">&lt;x&gt;</span>');
  });
  test('HTML escapes all source text, plain stays unwrapped', () => {
    expect(highlight('<>&"\'', 'unknown')).toBe('&lt;&gt;&amp;&quot;&#39;');
    expect(highlight('', 'js')).toBe('');
    expect(highlight('"<script>&"', 'js')).toBe('<span class="prism-tok-string">&quot;&lt;script&gt;&amp;&quot;</span>');
  });
  test('LRU hits, eviction, cache disabled and registration invalidation', () => {
    let scans = 0;
    const custom = defineLanguage('counter', () => null, (line, state, emit) => { scans++; emit('plain', line); return state; });
    const h = createHighlighter({ languages: [custom], cacheSize: 2 });
    h.highlight('a', 'counter'); h.highlight('b', 'counter'); h.highlight('a', 'counter');
    expect(scans).toBe(2);
    h.highlight('c', 'counter'); h.highlight('b', 'counter'); expect(scans).toBe(4);
    h.registerLanguage('counter', custom); h.highlight('b', 'counter'); expect(scans).toBe(5);
    const uncached = createHighlighter({ languages: [custom], cacheSize: 0 });
    uncached.highlight('b', 'counter'); uncached.highlight('b', 'counter'); expect(scans).toBe(7);
    expect(h.highlight('\0b', 'a')).toBe('\0b');
    expect(h.highlight('b', 'a\0')).toBe('b');
  });
  test('incremental checkpoints never rescan stable lines and tokens reuse checkpoints', () => {
    const calls: string[] = [];
    const counter = defineLanguage('counter', () => 0, (line, state, emit) => { calls.push(line); emit(state % 2 ? 'string' : 'keyword', line); return state + 1; });
    const h = createHighlighter({ languages: [counter] }); const stream = h.createIncremental('counter');
    stream.update('a\nb'); stream.update('a\nbc'); stream.update('a\nbc\nd');
    expect(calls).toEqual(['a\n', 'b', 'bc', 'bc\n', 'd']);
    stream.tokens(); expect(calls.length).toBe(5);
    stream.update('a\nx\nd'); expect(calls.slice(5)).toEqual(['x\n', 'd']);
  });
  test('backend swap, fallback, optional tokenizer, incremental and reset', () => {
    const h = createHighlighter(); const stream = h.createIncremental('js');
    stream.update('const x = 1');
    const backend = { supports: (lang: string) => lang === 'js', highlight: () => 'external', tokenize: () => [{ type: 'meta' as const, text: 'external' }] };
    h.setHighlighter(backend);
    expect(h.highlight('alias', 'javascript')).toBe('external');
    expect(h.tokenize('alias', 'javascript')).toEqual(backend.tokenize());
    expect(h.highlight('x', 'js')).toBe('external'); expect(h.tokenize('x', 'js')).toEqual(backend.tokenize());
    expect(stream.update('x')).toBe('external'); expect(stream.tokens()).toEqual(backend.tokenize());
    expect(h.highlight('42', 'json')).toContain('prism-tok-number');
    h.setHighlighter({ supports: () => true, highlight: () => 'html-only' });
    expect(h.tokenize('const', 'js')[0].type).toBe('keyword');
    h.setHighlighter(); expect(stream.update('const')).toContain('prism-tok-keyword');
    setHighlighter(backend); expect(highlight('x', 'js')).toBe('external'); setHighlighter(); expect(highlight('const', 'js')).toContain('prism-tok-keyword');
  });
});
