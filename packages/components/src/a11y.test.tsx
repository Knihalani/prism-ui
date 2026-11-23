import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { Prism } from '@prism-ui/react';
import './index';
import { buildSrcdoc } from './mockup/engine/frame';
import { artifactDocument } from './artifact/runtime';

afterEach(cleanup);

test('preview documents inherit language, default to English, and safely name their document', () => {
  const previous = document.documentElement.lang;
  try {
    document.documentElement.lang = 'fr';
    expect(buildSrcdoc({ id: 'test', title: 'Review <A> & "B"' })).toContain('<html lang="fr">');
    expect(buildSrcdoc({ id: 'test', title: 'Review <A> & "B"' })).toContain('<title>Review &lt;A&gt; &amp; &quot;B&quot;</title>');
    document.documentElement.lang = '';
    expect(buildSrcdoc({ id: 'empty' })).toContain('<html lang="en">');
    expect(buildSrcdoc({ id: 'empty' })).toContain('<title>Preview</title>');
    expect(buildSrcdoc({ id: 'empty' })).toContain('html{background:#fff;color:#000}');
    const artifact = artifactDocument('test', {}, undefined, { title: 'Quarterly report', lang: 'de' });
    expect(artifact).toContain('<html lang="de">');
    expect(artifact).toContain('<title>Quarterly report</title>');
    expect(artifact).toContain('specifier=>import(specifier)');
    expect(artifact).not.toContain('__vite__injectQuery');
    expect(buildSrcdoc({ id: 'escaped', lang: '\"><script>bad</script>' })).not.toContain('lang=""><script>');
  } finally { document.documentElement.lang = previous; }
});

test('card keeps article semantics and wrap control includes its visible label in its name', () => {
  const view = render(<Prism source={':::card{title="Report"}\nDetails\n:::\n\n```ts\nconst value = 1;\n```'} />);
  expect(view.getByRole('article', { name: 'Report' }).tagName).toBe('ARTICLE');
  const wrap = view.container.querySelector('.prism-codeblock__wrap')!;
  expect(wrap.getAttribute('aria-label')).toBe(wrap.textContent);
  expect(wrap.getAttribute('aria-pressed')).toBe('false');
});

test('fixed fields and composer have forced-colors focus rules and selected controls retain system colors', async () => {
  const controls = await Bun.file(new URL('./shared/controls.css', import.meta.url)).text();
  const app = await Bun.file(new URL('../../../apps/playground/src/app.css', import.meta.url)).text();
  const forced = controls.slice(controls.indexOf('@media (forced-colors: active)'));
  expect(forced).toContain('.prism-view__control:focus-visible');
  expect(forced).toContain('outline: 2px solid Highlight');
  expect(forced).toContain('background: Highlight');
  expect(forced).toContain('color: HighlightText');
  expect(forced).toContain('GrayText');
  expect(app).toMatch(/@media \(forced-colors: active\)[^}]+\.composer textarea:focus-visible/);
  expect(app.match(/\.composer textarea \{[^}]+\}/)?.[0]).not.toContain('outline: 0 !important');
});
