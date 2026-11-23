import { expect, test } from 'bun:test';
import { editorBridge } from '../scripts/integrate-playground';

test('combined output bridges only editor=1 without changing the comparison or project base', () => {
  const html = '<html><head><title>Comparison</title></head><body>Original comparison</body></html>';
  const result = editorBridge(html);
  expect(result).toContain('get("editor")==="1"');
  expect(result).toContain('Original comparison');
  expect(result).toContain('new URL("./"+location.search+location.hash,location.href)');
  expect(result.indexOf('data-prism-editor-bridge')).toBeLessThan(result.indexOf('<title>'));
  expect(editorBridge(result)).toBe(result);
});
test('missing comparison markup fails rather than silently producing a broken artifact', () => {
  expect(() => editorBridge('')).toThrow('no head');
});
