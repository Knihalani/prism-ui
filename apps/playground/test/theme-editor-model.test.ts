import { expect, test } from 'bun:test';
import { host, spring, type PrismTheme } from '@prism-ui/react';
import { availableThemes } from '../src/themes';
import { baseValue, clearToken, radiusScale, resetToken, setToken, slugName, spaceScale, springTokens, toTheme, tokenCatalogue, tokenDefaults, typeScale, type ThemeDraft } from '../src/theme-editor/model';

const draft = (): ThemeDraft => ({ name: 'Warm paper', base: 'host', tokens: {}, dark: {} });
const variable = (key: string) => '--prism-' + key.replace(/[A-Z]|(?<=space|text|elevation)[0-9]/g, c => '-' + c.toLowerCase());

test('catalogue contains all 61 contract keys exactly once with complete metadata', async () => {
  const source = await Bun.file(new URL('../../../packages/react/src/theme.tsx', import.meta.url)).text();
  const keys = [...source.match(/export interface Tokens \{([^}]+)\}/)![1].matchAll(/(\w+): string/g)].map(match => match[1]);
  expect(keys).toHaveLength(61);
  expect(tokenCatalogue).toHaveLength(61);
  expect(keys.sort()).toEqual(tokenCatalogue.map(token => token.key).sort());
  expect(new Set(tokenCatalogue.map(token => token.key)).size).toBe(61);
  expect(Object.keys(tokenDefaults).sort()).toEqual(keys.sort());
  expect(new Set(tokenCatalogue.map(token => token.group))).toEqual(new Set(['colour', 'font', 'type', 'weight', 'radius', 'space', 'elevation', 'motion']));
  for (const token of tokenCatalogue) {
    expect(token.label.length).toBeGreaterThan(0);
    expect(['colour', 'font', 'length', 'number', 'shadow', 'duration', 'easing', 'text']).toContain(token.control);
    expect(token.supportsDark).toBe(['colour', 'elevation'].includes(token.group));
  }
});

test('shared default table exactly mirrors the theme.css root, without inventing an inherited accent', async () => {
  const css = await Bun.file(new URL('../../../packages/react/src/theme.css', import.meta.url)).text();
  const root = css.match(/:where\(\[data-prism-theme-name\]\)\s*\{([^}]+)\}/)![1];
  const actual = Object.fromEntries([...root.matchAll(/(--prism-[\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value]));
  const expected = Object.fromEntries(Object.entries(tokenDefaults).flatMap(([key, value]) => value === undefined ? [] : [[variable(key), value]]));
  expect(actual).toEqual(expected);
  expect(baseValue(host, 'accent', 'light')).toBeUndefined();
  expect(baseValue(host, 'fontBody', 'dark')).toBe('inherit');
});

test('base values merge ancestors and dark maps separately before falling back to shared defaults', () => {
  const parent: PrismTheme = { name: 'parent', tokens: { accent: '#111', text: '#222' }, dark: { accent: '#eee' } };
  const child: PrismTheme = { name: 'child', extends: parent, tokens: { accent: '#333' }, dark: { text: '#ddd' } };
  expect(baseValue(child, 'accent', 'light')).toBe('#333');
  expect(baseValue(child, 'accent', 'dark')).toBe('#eee');
  expect(baseValue(child, 'text', 'dark')).toBe('#ddd');
  expect(baseValue(child, 'radiusMd', 'light')).toBe('8px');
  parent.extends = child;
  expect(() => baseValue(child, 'bg', 'light')).toThrow('Circular');
});

test.each(availableThemes)('$name drafts extend the selected base and omit empty maps', base => {
  const input = { ...draft(), base: base.name };
  expect(toTheme(input, availableThemes)).toEqual({ name: 'warm-paper', ...(base.name === 'host' ? {} : { extends: base }) });
  input.tokens.accent = '#c04'; input.dark.accent = '#f9b';
  const theme = toTheme(input, availableThemes);
  expect(theme.tokens).toEqual(input.tokens); expect(theme.dark).toEqual(input.dark);
  expect(theme.tokens).not.toBe(input.tokens);
  expect(theme.dark).not.toBe(input.dark);
});

test('immutable edits separate light/dark; clear inherits and reset pins the selected base value', () => {
  const input = { ...draft(), base: 'print', tokens: Object.freeze({ accent: '#abc' }), dark: Object.freeze({ accent: '#def' }) };
  Object.freeze(input);
  const changed = setToken(input, 'accent', '#123', 'dark');
  expect(changed.tokens).toBe(input.tokens); expect(changed.dark.accent).toBe('#123');
  expect(input.dark.accent).toBe('#def');
  expect(clearToken(changed, 'accent', 'dark').dark).toEqual({});
  expect(resetToken(changed, 'accent', availableThemes, 'dark').dark.accent).toBe('#ef4438');
  expect(resetToken(changed, 'accent', availableThemes).tokens.accent).toBe('#d92e24');
  expect(resetToken({ ...input, base: 'host' }, 'accent', availableThemes).tokens).toEqual({});
  expect(clearToken(draft(), 'accent')).toEqual(draft());
  expect(setToken(draft(), 'fontBody', '').tokens.fontBody).toBe('');
});

test('type, radius and spacing generators produce rounded scales without touching pill radius', () => {
  expect(typeScale(16, 1.25)).toEqual({ textXs: '0.64rem', textSm: '0.8rem', textBase: '1rem', textLg: '1.25rem', textXl: '1.5625rem', text2xl: '1.9531rem', text3xl: '2.4414rem' });
  expect(typeScale(16, 1)).toEqual(Object.fromEntries(['textXs', 'textSm', 'textBase', 'textLg', 'textXl', 'text2xl', 'text3xl'].map(key => [key, '1rem'])));
  expect(radiusScale(8)).toEqual({ radiusSm: '4px', radiusMd: '8px', radiusLg: '12px' });
  expect(radiusScale(0)).toEqual({ radiusSm: '0px', radiusMd: '0px', radiusLg: '0px' });
  expect(spaceScale(4)).toEqual({ space1: '0.25rem', space2: '0.5rem', space3: '0.75rem', space4: '1rem', space5: '1.25rem', space6: '1.5rem', space7: '2rem', space8: '2.5rem' });
  expect(Object.values(spaceScale(0))).toEqual(Array(8).fill('0rem'));
});

test('spring generators use the public solver for both easing/duration pairs', () => {
  for (const variant of ['spring', 'bouncy'] as const) {
    const result = spring({ response: .4, damping: .7 }), tokens = springTokens(.4, .7, variant);
    expect(tokens).toEqual(variant === 'spring' ? { motionSpring: result.easing, motionSpringDuration: result.duration + 'ms' } : { motionSpringBouncy: result.easing, motionSpringBouncyDuration: result.duration + 'ms' });
  }
});

test('invalid bases and invalid scale/spring parameters fail explicitly; names remain valid', () => {
  expect(() => toTheme({ ...draft(), base: 'missing' }, availableThemes)).toThrow('Unknown base');
  for (const value of [-1, Infinity, NaN]) {
    expect(() => typeScale(value, 1.2)).toThrow(RangeError);
    expect(() => radiusScale(value)).toThrow(RangeError);
    expect(() => spaceScale(value)).toThrow(RangeError);
    expect(() => springTokens(value, .8)).toThrow(RangeError);
  }
  expect(() => typeScale(16, 0)).toThrow(RangeError);
  expect(() => typeScale(0, 1.2)).toThrow(RangeError);
  expect(() => springTokens(.4, 0)).toThrow(RangeError);
  expect(() => radiusScale(Number.MAX_VALUE)).toThrow(RangeError);
  for (const name of ['', '9 tokens!', ' Café / Soft ', 'a"]{}', 'MyTheme']) expect(slugName(name)).toMatch(/^[a-zA-Z][\w-]*$/);
});
