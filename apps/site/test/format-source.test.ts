import { expect, test } from 'bun:test';
import { formatSource } from '../src/format-source';
import { previewSource } from '../src/preview-source';

test('UI payload formatting preserves valid JSON and fence syntax', () => {
  const source = 'A reply\n\n```ui:pick\n{"question":"Which?","options":[]}\n```\n\nDone.';
  const result = formatSource(source);
  expect(result).toContain('\n  "question": "Which?",\n');
  expect(JSON.parse(result.match(/```ui:pick\n([\s\S]*?)\n```/)![1])).toEqual({ question: 'Which?', options: [] });
  expect(result).toStartWith('A reply'); expect(result).toEndWith('Done.');
});
test('empty, non-JSON and malformed payloads remain unchanged', () => {
  for (const source of ['', ':num[12]', '```ui:ask\n{"fields":\n```', '```js\nconst x = 1\n```']) expect(formatSource(source)).toBe(source);
});
test('unknown preview definitions retain their registered example', () => {
  expect(previewSource({ name: 'future', component: () => null, examples: ['original'] })).toBe('original');
  expect(previewSource({ name: 'future', component: () => null })).toBe('');
});
