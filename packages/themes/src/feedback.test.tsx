import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { host, Prism, type PrismTheme, type Tokens } from '@prism-ui/react';
import '@prism-ui/components/mockup';
import { instrument, objects, print, refraction } from './index';

afterEach(cleanup);
const defaults = await Bun.file(new URL('../../react/src/theme.css', import.meta.url)).text();
const hostCss = defaults.match(/:where\(\[data-prism-theme-name="host"\]\) \{([\s\S]*?)\n\}/)![1];
function hostColor(name: string, dark: boolean) {
  const value = hostCss.match(new RegExp(`--prism-${name}: light-dark\\(([^,]+), ([^)]+)\\)`))!;
  return value[dark ? 2 : 1];
}
function rgb(hex: string) {
  const value = hex.replace('#', '');
  return (value.length === 3 ? [...value].map(c => c + c).join('') : value).match(/../g)!.map(c => parseInt(c, 16) / 255);
}
function contrast(a: number[], b: number[]) {
  const luminance = (color: number[]) => color.map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
test.each([host, refraction, instrument, print, objects])('$name pin and list badge token pairs meet AA in both modes', (theme: PrismTheme) => {
  for (const dark of [false, true]) {
    const tokens: Partial<Tokens> = { ...theme.tokens, ...(dark ? theme.dark : {}) };
    const accent = rgb(tokens.accent ?? hostColor('accent', dark));
    const onAccent = rgb(tokens.onAccent ?? hostColor('on-accent', dark));
    expect(contrast(accent, onAccent)).toBeGreaterThanOrEqual(4.5);
    if (theme === instrument) {
      const frame = instrument.components.frame.tokens;
      expect(contrast(rgb(frame.display), rgb(frame['display-ink']))).toBeGreaterThanOrEqual(4.5);
    } else if (theme === print) {
      expect(contrast(accent, onAccent)).toBeGreaterThanOrEqual(4.5);
    } else {
      const ink = rgb(tokens.text ?? hostColor('accent', dark));
      const surface = rgb((theme === objects ? tokens.surfaceRaised : tokens.bg) ?? hostColor('surface-raised', dark));
      const tint = rgb(tokens.accentText ?? hostColor('accent', dark));
      for (const active of [false, true]) {
        const row = active ? surface.map((c, i) => c * .92 + tint[i] * .08) : surface;
        const fill = row.map((c, i) => c * .92 + tint[i] * .08);
        expect(contrast(ink, fill)).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});
test('mockup solid marker colors use the accent/on-accent pair without a shell reset overriding ink', async () => {
  const css = await Bun.file(new URL('../../components/src/mockup/mockup.css', import.meta.url)).text();
  for (const selector of ['.prism-mockup__marker', '.prism-mockup__marker[data-kind="region"] span']) {
    const rule = css.slice(css.indexOf(selector + ' {')).split('}')[0];
    expect(rule).toContain('background: var(--prism-mockup-accent, var(--prism-accent))');
  }
  expect(instrument.css).toContain('color:var(--prism-frame-display-ink)');
  expect(css.slice(css.indexOf('.prism-mockup__badge {')).split('}')[0]).toContain('color: var(--prism-mockup-text, var(--prism-text))');
  const app = await Bun.file(new URL('../../../apps/playground/src/app.css', import.meta.url)).text();
  expect(app).toContain(':where(.chat-app) button { color: inherit; }');
  expect(app).not.toContain('\n.chat-app button { color: inherit; }');
});
test.each([instrument, print, objects])('$name mockup chrome preserves icons, labels and tooltips for responsive tools', theme => {
  const view = render(<Prism theme={theme} source={'```ui:mockup\n{"id":"tools","kind":"svg","source":"<svg viewBox=\"0 0 100 100\"><rect width=\"100\" height=\"100\"/></svg>"}\n```'} />);
  for (const name of ['Tools', 'Ask']) {
    const button = view.getByRole('button', { name });
    expect(button.getAttribute('title')).toBe(name);
    expect(button.querySelector('svg')).not.toBeNull();
    expect(button.querySelector('[data-part="toolLabel"]')?.textContent).toBe(name);
  }
});
