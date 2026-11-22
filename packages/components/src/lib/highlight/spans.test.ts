import { expect, test } from 'bun:test';
import { createHighlighter, defineRangeLanguage, renderTokens, type Emit, type Language, type Token } from './core';
import { languages } from './languages/all';

function reference(code: string, language: Language): string {
  let state = language.initialState();
  let html = '';
  let start = 0;
  while (start < code.length) {
    const newline = code.indexOf('\n', start);
    const end = newline < 0 ? code.length : newline + 1;
    const tokens: Token[] = [];
    const emit: Emit = (type, text) => {
      if (!text) return;
      const last = tokens[tokens.length - 1];
      if (last?.type === type) last.text += text;
      else tokens.push({ type, text });
    };
    state = language.scan(code.slice(start, end), state, emit);
    html += renderTokens(tokens);
    start = end;
  }
  return html;
}

test('byte and slice rendering match the string scanner for every language', () => {
  const highlighter = createHighlighter({ languages, cacheSize: 0 });
  let ascii = '';
  for (let i = 0; i < 128; i++) ascii += String.fromCharCode(i);
  const inputs = ['', ascii, 'const x = "<&>\\\"";\n', '"\\\\\\"<&>\'"\n'.repeat(20),
    '😀 é e\u0301 \ud800 \udfff\nconst text = "中文 <&>";\n', 'a+'.repeat(3000)];
  for (const language of languages) {
    for (const code of inputs) {
      const expected = reference(code, language);
      expect(highlighter.highlight(code, language.name)).toBe(expected);
      const incremental = highlighter.createIncremental(language.name);
      expect(incremental.update(code)).toBe(expected);
      expect(incremental.tokens()).toEqual(highlighter.tokenize(code, language.name));
      expect(incremental.update('')).toBe('');
      expect(incremental.tokens()).toEqual([]);
    }
  }
});

test('range scanners merge adjacent spans and reconstruct tokens', () => {
  const language = defineRangeLanguage('ranges', () => 0, (line, state, emit) => {
    emit('string', 0, 0);
    for (let i = 0; i < line.length; i++) emit('string', i, i + 1);
    return state;
  });
  const highlighter = createHighlighter({ languages: [language], cacheSize: 0 });
  expect(highlighter.highlight('a<&\nlast', 'ranges')).toBe('<span class="prism-tok-string">a&lt;&amp;\n</span><span class="prism-tok-string">last</span>');
  expect(highlighter.tokenize('a<&\nlast', 'ranges')).toEqual([{ type: 'string', text: 'a<&\nlast' }]);
});

test('scratch buffers survive scanner errors and nested highlighting', () => {
  const highlighter = createHighlighter({ cacheSize: 0 });
  const language = defineRangeLanguage('nested', () => 0, (line, state, emit) => {
    emit('keyword', 0, line.length);
    if (line === 'throw') throw new Error('scanner failure');
    if (line === 'outer') expect(highlighter.highlight('inner', 'nested')).toBe('<span class="prism-tok-keyword">inner</span>');
    return state;
  });
  highlighter.registerLanguage('nested', language);
  expect(() => highlighter.highlight('throw', 'nested')).toThrow('scanner failure');
  expect(highlighter.highlight('outer', 'nested')).toBe('<span class="prism-tok-keyword">outer</span>');
  expect(highlighter.highlight('', 'nested')).toBe('');
});
