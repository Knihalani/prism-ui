import { createElement, useEffect, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';

export interface ThemeTokens {
  bg: string; surface: string; border: string; text: string; muted: string;
  accent: string; success: string; warning: string; danger: string; info: string;
  bgSoft: string; surfaceSoft: string; borderSoft: string; textSoft: string; mutedSoft: string;
  accentSoft: string; successSoft: string; warningSoft: string; dangerSoft: string; infoSoft: string;
  radiusSm: string; radiusMd: string; radiusLg: string;
  space1: string; space2: string; space3: string; space4: string; space5: string; space6: string; space7: string; space8: string;
  fontSans: string; fontMono: string; textXs: string; textSm: string; textBase: string; textLg: string; textXl: string;
  shadowSm: string; shadowMd: string; shadowLg: string; durationFast: string; durationBase: string; durationSlow: string; ease: string;
}
export type ThemeStyle = CSSProperties & { [key: `--prism-${string}`]: string | number };
export type Theme = 'light' | 'dark' | 'auto' | ThemeStyle;
export type Density = 'compact' | 'comfortable' | 'spacious';
export function createTheme(tokens: Partial<ThemeTokens>, base: Partial<ThemeTokens> | ThemeStyle = {}): ThemeStyle {
  return Object.fromEntries(Object.entries({ ...base, ...tokens }).map(([key, value]) => [key.startsWith('--') ? key : '--prism-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()), value]));
}
export function useMotion(animate = true): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const media = matchMedia('(prefers-reduced-motion: reduce)'), update = () => setReduced(media.matches);
    update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  return animate && !reduced;
}
export interface ThemeScopeProps {
  theme?: Theme; density?: Density; animate?: boolean; as?: ElementType; className?: string;
  style?: CSSProperties; children?: ReactNode; 'data-state'?: string; 'data-prism-presentation'?: '';
}
export function ThemeScope({ theme = 'auto', density = 'comfortable', animate = true, as = 'div', className, style, children, ...attributes }: ThemeScopeProps) {
  const motion = useMotion(animate);
  return createElement(as, { className, style: { ...(typeof theme === 'object' ? theme : {}), ...style }, 'data-prism-theme': typeof theme === 'string' ? theme : 'auto', 'data-density': density, 'data-animate': motion ? undefined : 'false', ...attributes }, children);
}
