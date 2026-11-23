import { defineTheme, spring, type PrismTheme, type Tokens } from '@prism-ui/react';

export type SpringProfile = { response: number; damping: number };
export type ThemeDraft = { name: string; base: string; tokens: Partial<Tokens>; dark: Partial<Tokens>; springProfiles?: Partial<Record<'spring' | 'bouncy', SpringProfile>> };
export type EditTarget = 'light' | 'dark';
export type TokenGroup = 'colour' | 'font' | 'type' | 'weight' | 'radius' | 'space' | 'elevation' | 'motion';
export type ControlKind = 'colour' | 'font' | 'length' | 'number' | 'shadow' | 'duration' | 'easing' | 'text';
export type TokenDefinition = { key: keyof Tokens; label: string; group: TokenGroup; control: ControlKind; supportsDark: boolean };

function group(group: TokenGroup, control: ControlKind, entries: readonly (readonly [keyof Tokens, string])[]): TokenDefinition[] {
  return entries.map(([key, label]) => ({ key, label, group, control, supportsDark: group === 'colour' || group === 'elevation' }));
}

export const tokenCatalogue: readonly TokenDefinition[] = [
  ...group('colour', 'colour', [
    ['bg', 'Background'], ['surface', 'Surface'], ['surfaceRaised', 'Raised surface'], ['text', 'Text'], ['textMuted', 'Muted text'], ['textSubtle', 'Subtle text'],
    ['border', 'Border'], ['borderStrong', 'Strong border'], ['accent', 'Accent'], ['accentText', 'Accent text'], ['onAccent', 'On accent'],
    ['positive', 'Positive'], ['warning', 'Warning'], ['danger', 'Danger'], ['info', 'Info'], ['focus', 'Focus'],
  ]),
  ...group('font', 'font', [['fontBody', 'Body font'], ['fontDisplay', 'Display font'], ['fontMono', 'Monospace font'], ['fontNumeric', 'Numeric font']]),
  ...group('type', 'length', [['textXs', 'Extra small'], ['textSm', 'Small'], ['textBase', 'Base'], ['textLg', 'Large'], ['textXl', 'Extra large'], ['text2xl', '2XL'], ['text3xl', '3XL']]),
  ...group('weight', 'number', [['weightRegular', 'Regular'], ['weightMedium', 'Medium'], ['weightSemibold', 'Semibold'], ['weightBold', 'Bold']]),
  ...group('radius', 'length', [['radiusSm', 'Small radius'], ['radiusMd', 'Medium radius'], ['radiusLg', 'Large radius'], ['radiusPill', 'Pill radius']]),
  ...group('space', 'length', [['space1', 'Space 1'], ['space2', 'Space 2'], ['space3', 'Space 3'], ['space4', 'Space 4'], ['space5', 'Space 5'], ['space6', 'Space 6'], ['space7', 'Space 7'], ['space8', 'Space 8']]),
  ...group('elevation', 'shadow', [['elevation1', 'Elevation 1'], ['elevation2', 'Elevation 2'], ['elevation3', 'Elevation 3']]),
  ...group('motion', 'duration', [['motionInstant', 'Instant'], ['motionFast', 'Fast'], ['motionBase', 'Base duration'], ['motionSlow', 'Slow']]),
  ...group('motion', 'easing', [['motionEase', 'Ease out'], ['motionEaseInOut', 'Ease in/out'], ['motionEaseExit', 'Exit ease'], ['motionSpring', 'Spring']]),
  ...group('motion', 'duration', [['motionSpringDuration', 'Spring duration']]),
  ...group('motion', 'easing', [['motionSpringBouncy', 'Bouncy spring']]),
  ...group('motion', 'duration', [['motionSpringBouncyDuration', 'Bouncy duration'], ['motionStagger', 'Stagger']]),
  ...group('motion', 'length', [['motionDistance', 'Enter distance']]),
  ...group('motion', 'number', [['motionScale', 'Press scale']]),
  ...group('motion', 'length', [['motionBlur', 'Enter blur']]),
];

export const tokenDefaults: Record<keyof Tokens, string | undefined> = {
  bg: 'transparent', surface: 'color-mix(in srgb, currentColor 3%, transparent)', surfaceRaised: 'Canvas', text: 'currentColor',
  textMuted: 'color-mix(in srgb, currentColor 72%, transparent)', textSubtle: 'color-mix(in srgb, currentColor 65%, transparent)',
  border: 'color-mix(in srgb, currentColor 10%, transparent)', borderStrong: 'color-mix(in srgb, currentColor 30%, transparent)',
  accent: undefined, accentText: 'var(--prism-accent, #525252)', onAccent: '#fff', positive: '#20805b', warning: '#a56910', danger: '#c43d38', info: '#327394', focus: 'var(--prism-accent, #525252)',
  fontBody: 'inherit', fontDisplay: 'inherit', fontMono: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontNumeric: 'inherit',
  textXs: '.75rem', textSm: '.875rem', textBase: '1rem', textLg: '1.125rem', textXl: '1.375rem', text2xl: '2rem', text3xl: '2.75rem',
  weightRegular: '400', weightMedium: '500', weightSemibold: '600', weightBold: '700',
  radiusSm: '4px', radiusMd: '8px', radiusLg: '12px', radiusPill: '999px',
  space1: '.25rem', space2: '.5rem', space3: '.75rem', space4: '1rem', space5: '1.25rem', space6: '1.5rem', space7: '2rem', space8: '2.5rem',
  elevation1: '0 1px 2px color-mix(in srgb, currentColor 5%, transparent)', elevation2: '0 4px 12px color-mix(in srgb, currentColor 8%, transparent)', elevation3: '0 12px 32px color-mix(in srgb, currentColor 12%, transparent)',
  motionInstant: '90ms', motionFast: '160ms', motionBase: '240ms', motionSlow: '420ms',
  motionEase: 'cubic-bezier(.23,1,.32,1)', motionEaseInOut: 'cubic-bezier(.65,0,.35,1)', motionEaseExit: 'cubic-bezier(.4,0,1,1)',
  motionSpring: spring({ response: .35, damping: .85 }).easing, motionSpringDuration: '500ms',
  motionSpringBouncy: spring({ response: .4, damping: .7 }).easing, motionSpringBouncyDuration: '600ms',
  motionStagger: '28ms', motionDistance: '6px', motionScale: '.97', motionBlur: '2px',
};

export function slugName(name: string): string {
  const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^[-_]+|[-_]+$/g, '');
  return !slug ? 'custom-theme' : /^[a-z]/.test(slug) ? slug : 'theme-' + slug;
}

function findBase(name: string, bases: readonly PrismTheme[]): PrismTheme {
  const base = bases.find(theme => theme.name === name);
  if (!base) throw new Error('Unknown base theme: ' + name);
  return base;
}

export function toTheme(draft: ThemeDraft, bases: readonly PrismTheme[]): PrismTheme {
  const base = findBase(draft.base, bases);
  return defineTheme({
    name: slugName(draft.name),
    ...(base.name === 'host' ? {} : { extends: base }),
    ...(Object.keys(draft.tokens).length ? { tokens: { ...draft.tokens } } : {}),
    ...(Object.keys(draft.dark).length ? { dark: { ...draft.dark } } : {}),
  });
}

export function baseValue(base: PrismTheme, key: keyof Tokens, mode: EditTarget): string | undefined {
  const chain: PrismTheme[] = [], seen = new Set<PrismTheme>();
  for (let layer: PrismTheme | undefined = base; layer; layer = layer.extends) {
    if (seen.has(layer)) throw new Error('Circular theme inheritance');
    seen.add(layer); chain.unshift(layer);
  }
  const tokens = Object.assign({}, ...chain.map(layer => layer.tokens)) as Partial<Tokens>;
  const dark = Object.assign({}, ...chain.map(layer => layer.dark)) as Partial<Tokens>;
  return (mode === 'dark' ? dark[key] ?? tokens[key] : tokens[key]) ?? tokenDefaults[key];
}

const rounded = (value: number) => {
  if (!Number.isFinite(value)) throw new RangeError('Scale is too large');
  return String(Number(value.toFixed(4)));
};
function nonnegative(value: number) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('Scale must be finite and nonnegative');
}
const typeKeys = ['textXs', 'textSm', 'textBase', 'textLg', 'textXl', 'text2xl', 'text3xl'] as const;
export function typeScale(basePx: number, ratio: number): Partial<Tokens> {
  if (!Number.isFinite(basePx) || basePx <= 0 || !Number.isFinite(ratio) || ratio <= 0) throw new RangeError('Type scale must be finite and positive');
  const values = typeKeys.map((key, i) => [key, basePx * ratio ** (i - 2) / 16] as const);
  if (values.some(([, value]) => !Number.isFinite(value))) throw new RangeError('Type scale is too large');
  return Object.fromEntries(values.map(([key, value]) => [key, rounded(value) + 'rem']));
}
export function radiusScale(px: number): Partial<Tokens> {
  nonnegative(px);
  return { radiusSm: rounded(px / 2) + 'px', radiusMd: rounded(px) + 'px', radiusLg: rounded(px * 1.5) + 'px' };
}
export function spaceScale(unitPx: number): Partial<Tokens> {
  nonnegative(unitPx);
  return Object.fromEntries([1, 2, 3, 4, 5, 6, 8, 10].map((n, i) => ['space' + (i + 1), rounded(unitPx * n / 16) + 'rem']));
}
export function springTokens(response: number, damping: number, variant: 'spring' | 'bouncy' = 'spring'): Partial<Tokens> {
  const { easing, duration } = spring({ response, damping });
  return variant === 'bouncy' ? { motionSpringBouncy: easing, motionSpringBouncyDuration: duration + 'ms' } : { motionSpring: easing, motionSpringDuration: duration + 'ms' };
}

export function setToken(draft: ThemeDraft, key: keyof Tokens, value: string, target: EditTarget = 'light'): ThemeDraft {
  const field = target === 'dark' ? 'dark' : 'tokens';
  return { ...draft, [field]: { ...draft[field], [key]: value } };
}
export function clearToken(draft: ThemeDraft, key: keyof Tokens, target: EditTarget = 'light'): ThemeDraft {
  const field = target === 'dark' ? 'dark' : 'tokens', tokens = { ...draft[field] };
  delete tokens[key];
  return { ...draft, [field]: tokens };
}
export function resetToken(draft: ThemeDraft, key: keyof Tokens, bases: readonly PrismTheme[], target: EditTarget = 'light'): ThemeDraft {
  const value = baseValue(findBase(draft.base, bases), key, target);
  return value === undefined ? clearToken(draft, key, target) : setToken(draft, key, value, target);
}
