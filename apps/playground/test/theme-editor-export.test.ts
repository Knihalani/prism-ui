import { expect, test } from 'bun:test';
import { defineTheme } from '@prism-ui/react';
import { availableThemes } from '../src/themes';
import { exportTheme, slugName } from '../src/theme-editor/export-theme';
import { toTheme, tokenCatalogue, type ThemeDraft } from '../src/theme-editor/model';

function evaluate(source: string) {
  const js = new Bun.Transpiler({ loader: 'ts' }).transformSync(source);
  const name = /export const (\w+)/.exec(js)![1];
  const code = js.replace(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g, (_, names, path) => `const {${names}} = imports[${JSON.stringify(path)}];`).replace(/export const /, 'const ');
  return new Function('imports', code + '\nreturn ' + name)({
    '@prism-ui/react': { defineTheme },
    '@prism-ui/themes': Object.fromEntries(availableThemes.map(theme => [theme.name, theme])),
  });
}

test.each(availableThemes)('$name exports only overrides and evaluates to the live theme', base => {
  const draft: ThemeDraft = { name: 'Warm paper', base: base.name, tokens: { motionBase: '210ms', fontBody: 'A "quoted" \\ family\nnext', bg: '#fafafa' }, dark: { text: '#fff', bg: '#121212' } };
  const source = exportTheme(draft);
  expect(evaluate(source)).toEqual(toTheme(draft, availableThemes));
  expect(source).toContain('export const warmPaper');
  expect(source.indexOf('    bg:')).toBeLessThan(source.indexOf('    fontBody:'));
  expect(source.indexOf('    fontBody:')).toBeLessThan(source.indexOf('    motionBase:'));
  expect(source.includes("from '@prism-ui/themes'")).toBe(base.name !== 'host');
  expect(source.includes('  extends:')).toBe(base.name !== 'host');
  expect(source).not.toContain('surfaceRaised:');
});

test('font stacks use readable single quotes and preserve escaping in either quoting style', () => {
  const draft: ThemeDraft = { name: 'Readable fonts', base: 'host', tokens: {
    fontBody: '"DM Sans", sans-serif',
    fontDisplay: `"Director's Sans", serif`,
    fontMono: 'A "quoted" \\ family\nnext\t\u2028\u2029',
  }, dark: {} };
  const source = exportTheme(draft);
  expect(source).toContain(`fontBody: '"DM Sans", sans-serif',`);
  expect(source).toContain('fontDisplay: ' + JSON.stringify(draft.tokens.fontDisplay) + ',');
  expect(source).not.toContain('\u2028');
  expect(source).not.toContain('\u2029');
  expect(evaluate(source)).toEqual(toTheme(draft, availableThemes));
});

test('persisted spring builder metadata is excluded from the live theme and export', () => {
  const draft: ThemeDraft = { name: 'Spring builder', base: 'host', tokens: { motionSpringDuration: '600ms' }, dark: {}, springProfiles: { spring: { response: .58, damping: .64 } } };
  const source = exportTheme(draft);
  expect(source).not.toContain('springProfiles');
  expect(toTheme(draft, availableThemes)).not.toHaveProperty('springProfiles');
  expect(evaluate(source)).toEqual(toTheme(draft, availableThemes));
});

test('empty maps are omitted and every catalogue key round-trips in stable catalogue order', () => {
  const empty: ThemeDraft = { name: '', base: 'host', tokens: {}, dark: {} };
  const source = exportTheme(empty);
  expect(source).not.toContain('tokens:'); expect(source).not.toContain('dark:');
  expect(evaluate(source)).toEqual(toTheme(empty, availableThemes));
  const tokens = Object.fromEntries([...tokenCatalogue].reverse().map(({ key }) => [key, 'value "\\' + key]));
  const draft = { ...empty, name: 'all-tokens', tokens, dark: tokens };
  const full = exportTheme(draft);
  expect(evaluate(full)).toEqual(toTheme(draft, availableThemes));
  const keys = [...full.matchAll(/^    (\w+):/gm)].map(match => match[1]);
  expect(keys).toEqual([...tokenCatalogue, ...tokenCatalogue].map(token => token.key));
});

test.each(['default', 'await', 'class', 'define-theme', '9 tokens!', ' café / paper ', 'refraction', 'print', 'a"]{}', '___'])('%s produces valid escaped TypeScript and a valid theme name', name => {
  const draft: ThemeDraft = { name, base: name === 'print' ? 'print' : 'refraction', tokens: { fontBody: "Quote '\\ \"\u2028\u2029" }, dark: {} };
  expect(slugName(name)).toMatch(/^[a-zA-Z][\w-]*$/);
  expect(evaluate(exportTheme(draft))).toEqual(toTheme(draft, availableThemes));
});

test('unknown or hostile base names fail rather than becoming executable imports', () => {
  expect(() => exportTheme({ name: 'valid', base: 'unknown', tokens: {}, dark: {} })).toThrow('Unknown base');
  expect(() => exportTheme({ name: 'valid', base: "x }; throw Error('bad')", tokens: {}, dark: {} })).toThrow('Unknown base');
});
