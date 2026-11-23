import { expect, test } from 'bun:test';
import { artifactPlugin } from '@prism-ui/components/artifact';
import { mockupPlugin } from '@prism-ui/components/mockup';
import { staticMediaPreview } from '../scripts/static-preview';

const plugins = [artifactPlugin, mockupPlugin];
test('HTML and SVG previews use the parsed source inside script-disabled sandbox frames', () => {
  for (const [language, source] of [['artifact:html', '<h1>Preview</h1>'], ['mockup:svg', '<svg viewBox="0 0 100 100"><circle r="20"/></svg>']]) {
    const html = staticMediaPreview('```' + language + '\n' + source + '\n```', plugins)!;
    expect(html).toContain('sandbox=""');
    expect(html).toContain('srcDoc=');
    expect(html).toContain('default-src');
    expect(html).not.toContain('allow-scripts');
    expect(html).toContain(source.startsWith('<svg') ? '&lt;svg' : '&lt;h1');
  }
});
test('empty, incomplete and non-static sources fall back to their registered renderer', () => {
  for (const source of ['', 'Ordinary prose', '```artifact:html\n\n```', '```artifact:react\nexport default () => null\n```']) expect(staticMediaPreview(source, plugins)).toBeUndefined();
});
test('markup cannot escape the sandbox attribute into the index document', () => {
  const html = staticMediaPreview('```artifact:html\n<script>parent.document.body.remove()</script>\n```', plugins)!;
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('allow-same-origin');
});
