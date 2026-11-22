import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const css = (file: string) => readFileSync(new URL(`../src/${file}.css`, import.meta.url), 'utf8');

test('filled shared controls pair explicit accent backgrounds with on-accent foregrounds', () => {
  const controls = css('shared/controls');
  expect(controls).not.toMatch(/background: var\(--prism-text\)/);
  expect(controls).toContain('background: var(--prism-accent, #525252)');
  expect(controls).toContain('color: var(--prism-on-accent)');
  const thumb = controls.slice(controls.indexOf('.prism-switch:is(:checked, [aria-checked="true"])::after'));
  expect(thumb.slice(0, thumb.indexOf('}'))).toContain('background: var(--prism-on-accent)');
});
