import { expect, test } from 'bun:test';

test('shared coarse targets reserve spacing, preserve decorative pseudos and give primary actions real height', async () => {
  const css = await Bun.file(new URL('../src/shared/controls.css', import.meta.url)).text();
  expect(css).toContain('@media (pointer: coarse)');
  expect(css).toContain('.prism-touch-target::before');
  expect(css).toContain('.prism-root:where([data-prism-presentation], .prism-inline-feedback__popover-layer:has(.prism-mockup__popover))');
  for (const name of ['prism-pill', 'prism-icon-btn', 'prism-chip', 'prism-stepper', 'prism-switch', 'prism-check']) expect(css).toContain(name);
  expect(css).toContain('inline-size: max(100%, 46px)');
  expect(css).toContain('block-size: max(100%, 46px)');
  expect(css).toContain('margin: 9px !important');
  expect(css).toContain(':where(button:not(.prism-mockup__marker), summary');
  expect(css).toContain('min-block-size: 44px !important');
  expect(css).toContain(':not(.prism-pill)::before');
  expect(css).toContain('.prism-pill:not(.prism-receipt)::after');
  expect(css).toContain('width: 28px; height: 28px');
  expect(css).toContain('border: 8px solid transparent');
  expect(css).toContain('touch-action: pan-y');
  expect(css).toContain('.prism-num__root[data-status="editing"]::before { pointer-events: none; }');
  const num = await Bun.file(new URL('../src/num/num.css', import.meta.url)).text();
  expect(num).toContain('touch-action: pan-y'); expect(num).not.toContain('touch-action: none');
});
