import { createContext, createElement, useContext, useEffect, useInsertionEffect, useMemo, useState, useSyncExternalStore, type ComponentType, type CSSProperties, type ElementType, type ReactNode } from 'react';
import type { Icons } from './icons';
import './theme.css';

export interface Tokens {
  bg: string; surface: string; surfaceRaised: string; text: string; textMuted: string; textSubtle: string;
  border: string; borderStrong: string; accent: string; accentText: string; onAccent: string;
  positive: string; warning: string; danger: string; info: string; focus: string;
  fontBody: string; fontDisplay: string; fontMono: string; fontNumeric: string;
  textXs: string; textSm: string; textBase: string; textLg: string; textXl: string; text2xl: string; text3xl: string;
  weightRegular: string; weightMedium: string; weightSemibold: string; weightBold: string;
  radiusSm: string; radiusMd: string; radiusLg: string; radiusPill: string;
  space1: string; space2: string; space3: string; space4: string; space5: string; space6: string; space7: string; space8: string;
  elevation1: string; elevation2: string; elevation3: string;
  motionInstant: string; motionFast: string; motionBase: string; motionSlow: string;
  motionEase: string; motionEaseInOut: string; motionEaseExit: string;
  motionSpring: string; motionSpringDuration: string; motionSpringBouncy: string; motionSpringBouncyDuration: string;
  motionStagger: string; motionDistance: string; motionScale: string; motionBlur: string;
}
export type ThemeTokens = Tokens;
export type ThemeStyle = CSSProperties & { [key: `--prism-${string}`]: string | number };
export type Mode = 'light' | 'dark' | 'auto';
export type Density = 'compact' | 'comfortable' | 'spacious';
export interface ComponentTheme {
  tokens?: Record<string, string>; slots?: Record<string, ComponentType<any>>;
  classNames?: Record<string, string>; styles?: Record<string, CSSProperties>; strings?: Record<string, string>;
}
export interface PrismTheme {
  name: string; extends?: PrismTheme; tokens?: Partial<Tokens>; dark?: Partial<Tokens>;
  components?: Record<string, ComponentTheme>; css?: string; icons?: Partial<Icons>;
}
export type Theme = Mode | ThemeStyle | PrismTheme;
export interface ResolvedTheme extends Omit<PrismTheme, 'extends'> { components: Record<string, ComponentTheme> }
export function defineTheme<T extends PrismTheme>(theme: T): T {
  if (!/^[a-zA-Z][\w-]*$/.test(theme.name)) throw Error('Theme names must start with a letter and contain only letters, numbers, underscores or hyphens');
  return theme;
}
export const host = defineTheme({ name: 'host' });
export const tokenVariable = (key: string) => '--prism-' + key.replace(/[A-Z]|(?<=space|text|elevation)[0-9]/g, c => '-' + c.toLowerCase());
export function createTheme(tokens: Partial<Tokens>, base: Partial<Tokens> | ThemeStyle = {}): ThemeStyle {
  return Object.fromEntries(Object.entries({ ...base, ...tokens }).map(([key, value]) => [key.startsWith('--') ? key : tokenVariable(key), value]));
}
export function fromCssVars(map: Partial<Record<keyof Tokens, string>>): Partial<Tokens> {
  return Object.fromEntries(Object.entries(map).map(([key, value]) => [key, value.startsWith('--') ? `var(${value})` : value]));
}
export const shadcn = defineTheme({ name: 'shadcn', tokens: fromCssVars({
  bg: '--background', surface: '--muted', surfaceRaised: '--card', text: '--foreground',
  textMuted: '--muted-foreground', textSubtle: '--muted-foreground', border: '--border', borderStrong: '--input',
  accent: '--primary', accentText: '--primary', onAccent: '--primary-foreground', focus: '--ring',
  radiusSm: 'calc(var(--radius) - 4px)', radiusMd: 'calc(var(--radius) - 2px)', radiusLg: '--radius',
  danger: '--destructive',
}) });
export function resolveTheme(theme: PrismTheme): ResolvedTheme {
  const chain: PrismTheme[] = [], seen = new Set<PrismTheme>();
  for (let current: PrismTheme | undefined = theme; current; current = current.extends) {
    if (seen.has(current)) throw Error('Circular theme inheritance');
    defineTheme(current); seen.add(current); chain.unshift(current);
  }
  const result: ResolvedTheme = { name: theme.name, tokens: {}, dark: {}, components: {}, icons: {}, css: '' };
  for (const layer of chain) {
    Object.assign(result.tokens!, layer.tokens); Object.assign(result.dark!, layer.dark); Object.assign(result.icons!, layer.icons);
    result.css += (layer.css ?? '') + '\n';
    for (const [name, next] of Object.entries(layer.components ?? {})) {
      const previous = result.components[name] ?? {};
      result.components[name] = {
        tokens: { ...previous.tokens, ...next.tokens }, slots: { ...previous.slots, ...next.slots },
        classNames: { ...previous.classNames, ...next.classNames }, strings: { ...previous.strings, ...next.strings },
        styles: Object.fromEntries([...new Set([...Object.keys(previous.styles ?? {}), ...Object.keys(next.styles ?? {})])].map(part => [part, { ...previous.styles?.[part], ...next.styles?.[part] }])),
      };
    }
  }
  return result;
}
const initial = { theme: resolveTheme(host), mode: 'auto' as Mode };
export const ThemeContext = createContext(initial);
export const MotionContext = createContext(true);
export const isPrismTheme = (value: Theme): value is PrismTheme => typeof value === 'object' && 'name' in value && typeof value.name === 'string';
export function useTheme(theme?: Theme, mode?: Mode) {
  const parent = useContext(ThemeContext);
  const resolved = useMemo(() => theme && isPrismTheme(theme) ? resolveTheme(theme) : parent.theme, [theme, parent.theme]);
  const resolvedMode = mode ?? (typeof theme === 'string' ? theme : parent.mode);
  return useMemo(() => ({ theme: resolved, mode: resolvedMode }), [resolved, resolvedMode]);
}
function declarations(tokens: Record<string, string | undefined>, variable: (key: string) => string = tokenVariable) {
  return Object.entries(tokens).map(([key, value]) => `${variable(key)}:${value};`).join('');
}
function themeCss(theme: ResolvedTheme) {
  const componentTokens = Object.entries(theme.components).map(([component, { tokens }]) => declarations(tokens ?? {}, key => `--prism-${component}-${key}`)).join('');
  const componentRoots = Object.entries(theme.components).map(([component, { tokens }]) => `:scope [data-prism="${component}"][data-part="root"] {${declarations(tokens ?? {}, key => `--prism-${component}-${key}`)}}`).join('');
  const dark = declarations(theme.dark ?? {});
  return `@scope ([data-prism-theme-name="${theme.name}"]) to ([data-prism-theme-name]) {
    :scope {${declarations(theme.tokens ?? {})}${componentTokens}}
    :scope[data-prism-theme="dark"] {${dark}}
    @media (prefers-color-scheme:dark) { :scope[data-prism-theme="auto"] {${dark}} }
    ${componentRoots}
    ${theme.css ?? ''}
  }`;
}
const subscribeStyles = () => () => {};
function ThemeCss({ name, css }: { name: string; css: string }) {
  const server = useSyncExternalStore(subscribeStyles, () => false, () => true);
  useInsertionEffect(() => {
    const existing = document.head.querySelector(`style[data-prism-theme-css="${name}"]`);
    if (existing) { if (existing.textContent !== css) existing.textContent = css; return; }
    const style = document.createElement('style'); style.dataset.prismThemeCss = name; style.textContent = css;
    document.head.append(style);
  }, [name, css]);
  return server ? <style data-prism-theme-css={name}>{css}</style> : null;
}
export function useMotion(animate = true): boolean {
  const parent = useContext(MotionContext);
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const media = matchMedia('(prefers-reduced-motion: reduce)'), update = () => setReduced(media.matches);
    update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  return parent && animate && !reduced;
}
export interface ThemeScopeProps {
  theme?: Theme; mode?: Mode; density?: Density; animate?: boolean; as?: ElementType; className?: string;
  style?: CSSProperties; children?: ReactNode; 'data-state'?: string; 'data-prism-presentation'?: '';
}
export function ThemeScope({ theme, mode, density = 'comfortable', animate = true, as = 'div', className, style, children, ...attributes }: ThemeScopeProps) {
  const value = useTheme(theme, mode), motion = useContext(MotionContext) && animate, parent = useContext(ThemeContext);
  const css = useMemo(() => themeCss(value.theme), [value.theme]);
  const resets = Object.fromEntries(Object.entries(parent.theme.components).flatMap(([component, entry]) => Object.keys(entry.tokens ?? {}).filter(key => !value.theme.components[component]?.tokens?.[key]).map(key => [`--prism-${component}-${key}`, 'initial'])));
  return <ThemeContext.Provider value={value}><MotionContext.Provider value={motion}>
    <ThemeCss name={value.theme.name} css={css} />
    {createElement(as, { className, style: { ...resets, ...(theme && typeof theme === 'object' && !isPrismTheme(theme) ? theme : {}), ...style }, 'data-prism-theme-name': value.theme.name, 'data-prism-theme': value.mode, 'data-density': density, 'data-animate': motion ? undefined : 'false', ...attributes }, children)}
  </MotionContext.Provider></ThemeContext.Provider>;
}
