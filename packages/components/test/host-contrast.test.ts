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

test('solid component foregrounds never use the translucent surface token', () => {
  for (const file of ['summary/summary', 'badge/badge', 'artifact/artifact', 'runbook/runbook']) {
    expect(css(file)).not.toMatch(/(?<![-\w])color:\s*var\(--prism-surface\)/);
    expect(css(file)).toMatch(/color:\s*var\(--prism-(?:[a-z]+-on-accent,\s*var\(--prism-)?on-accent\)/);
  }
  expect(css('badge/badge')).toMatch(/--prism-badge-color:\s*var\(--prism-(?:badge-accent,\s*var\(--prism-)?accent,/);
});
