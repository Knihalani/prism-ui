import { expect, test } from 'bun:test';
import { markdownDocument } from '../scripts/markdown';

test('docs expose stable duplicate anchors, highlighted copyable fences and ordered TOC', () => {
  const { html, toc } = markdownDocument('# Guide\n\n## Install\n\n```js\nconst x = "ready"\n```\n\n## Install\n\n### Next step', '/prism-ui/', '/repo/docs');
  expect(toc.map(item => item.id)).toEqual(['install', 'install-1', 'next-step']);
  expect(html).toContain('href="#install-1"');
  expect(html).toContain('data-copy="doc-code-0"');
  expect(html).toContain('hljs-keyword');
});
test('relative doc links preserve fragments while repository paths resolve on main', () => {
  const { html } = markdownDocument('[Theme](./THEMING.md#tokens) [Source](../packages/react/src/index.ts#L1) [Web](https://example.com) ![Diagram](./diagram.svg)', '/prism-ui/', '/repo/docs');
  expect(html).toContain('href="/prism-ui/docs/theming/#tokens"');
  expect(html).toContain('https://github.com/Knihalani/prism-ui/blob/main/packages/react/src/index.ts#L1');
  expect(html).toContain('href="https://example.com"');
  expect(html).toContain('https://raw.githubusercontent.com/Knihalani/prism-ui/main/docs/diagram.svg');
});
test('empty docs and unknown fenced languages remain readable without unsafe markup', () => {
  expect(markdownDocument('', '/', '/repo/docs')).toEqual({ html: '', toc: [] });
  expect(markdownDocument('```unknown\n<script>bad()</script>\n```', '/', '/repo/docs').html).toContain('&lt;script&gt;');
});
test('source extraction markers stay hidden without consuming code examples or malformed comments', () => {
  expect(markdownDocument('<!-- snippet: patches -->', '/', '/repo/docs').html).toBe('');
  expect(markdownDocument('```\n<!-- literal -->\n```', '/', '/repo/docs').html).toContain('&lt;!-- literal --&gt;');
  expect(markdownDocument('<!-- unfinished', '/', '/repo/docs').html).toContain('&lt;!-- unfinished');
});
