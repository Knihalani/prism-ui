import { expect, test } from 'bun:test';
import { importCssVariables } from '../src/theme-editor/import-css';

test('real shadcn v3 HSL channels map light and dark colours, radius and derived subtle ink', () => {
  const result = importCssVariables(`
    @layer base {
      :root {
        --background: 0 0% 100%; --foreground: 222.2 84% 4.9%;
        --card: 0 0% 100%; --popover: 20 10% 95%; --muted: 210 40% 96.1%;
        --muted-foreground: 215.4 16.3% 46.9%; --border: 214.3 31.8% 91.4%;
        --input: 214.3 31.8% 91.4%; --primary: 222.2 47.4% 11.2%;
        --primary-foreground: 210 40% 98%; --destructive: 0 84.2% 60.2%;
        --ring: 222.2 84% 4.9%; --radius: .5rem; --chart-1: 12 76% 61%;
      }
      .dark {
        --background: 222.2 84% 4.9%; --foreground: 210 40% 98%;
        --card: 222.2 84% 4.9%; --muted: 217.2 32.6% 17.5%;
        --muted-foreground: 215 20.2% 65.1%; --primary: 210 40% 98%;
        --primary-foreground: 222.2 47.4% 11.2%; --destructive: 0 62.8% 30.6%;
        --border: 217.2 32.6% 17.5%; --input: 217.2 32.6% 17.5%; --ring: 212.7 26.8% 83.9%;
      }
    }`);
  expect(result.tokens).toEqual({
    bg: 'hsl(0 0% 100%)', surface: 'hsl(210 40% 96.1%)', surfaceRaised: 'hsl(0 0% 100%)',
    text: 'hsl(222.2 84% 4.9%)', textMuted: 'hsl(215.4 16.3% 46.9%)',
    textSubtle: 'color-mix(in srgb, hsl(215.4 16.3% 46.9%) 70%, hsl(0 0% 100%))',
    border: 'hsl(214.3 31.8% 91.4%)', borderStrong: 'hsl(214.3 31.8% 91.4%)',
    accent: 'hsl(222.2 47.4% 11.2%)', accentText: 'hsl(222.2 47.4% 11.2%)', onAccent: 'hsl(210 40% 98%)',
    danger: 'hsl(0 84.2% 60.2%)', focus: 'hsl(222.2 84% 4.9%)',
    radiusMd: '.5rem', radiusSm: 'calc(.5rem - 4px)', radiusLg: 'calc(.5rem + 4px)',
  });
  expect(result.dark.bg).toBe('hsl(222.2 84% 4.9%)');
  expect(result.dark.accent).toBe('hsl(210 40% 98%)');
  expect(result.dark.textSubtle).toBe('color-mix(in srgb, hsl(215 20.2% 65.1%) 70%, hsl(222.2 84% 4.9%))');
  expect(result.dark.radiusMd).toBeUndefined();
  expect(result.mapped).toContain('--primary');
  expect(result.unmapped).toContain('--chart-1');
});

test('shadcn v4 oklch and @theme inline aliases resolve against the appropriate mode', () => {
  const result = importCssVariables(`
    :root { --background: oklch(1 0 0); --foreground: oklch(.145 0 0); --primary: oklch(.205 0 0); --font-geist: "Geist", sans-serif; }
    .dark { --background: oklch(.145 0 0); --primary: oklch(.922 0 0); }
    @theme inline {
      --color-background: var(--background); --color-foreground: var(--foreground);
      --color-primary: var(--primary); --font-sans: var(--font-geist);
    }`);
  expect(result.tokens.bg).toBe('oklch(1 0 0)');
  expect(result.tokens.accent).toBe('oklch(.205 0 0)');
  expect(result.tokens.fontBody).toBe('"Geist", sans-serif');
  expect(result.tokens.fontDisplay).toBe(result.tokens.fontBody);
  expect(result.dark).toEqual({ bg: 'oklch(.145 0 0)', accent: 'oklch(.922 0 0)', accentText: 'oklch(.922 0 0)' });
  expect(result.unmapped).toEqual([]);
});

test('Tailwind v4 @theme maps stripped colour names, fonts and shadows', () => {
  const result = importCssVariables(`@theme {
    --color-background:#fff;--color-primary:oklch(.7 .2 40);--color-destructive:rgb(220 30 40);
    --font-sans:"Inter",sans-serif;--font-heading:"Display",serif;--font-serif:"Fallback",serif;--font-mono:monospace;
    --radius:8px;--shadow-sm:0 1px 2px #0001;--shadow:0 4px 8px #0002;--shadow-lg:0 10px 20px #0003;
  }`);
  expect(result.tokens.accent).toBe('oklch(.7 .2 40)');
  expect(result.tokens.danger).toBe('rgb(220 30 40)');
  expect(result.tokens.fontDisplay).toBe('"Display",serif');
  expect(result.tokens.fontMono).toBe('monospace');
  expect(result.tokens.elevation1).toBe('0 1px 2px #0001');
  expect(result.tokens.elevation2).toBe('0 4px 8px #0002');
  expect(result.tokens.elevation3).toBe('0 10px 20px #0003');
  expect(result.tokens.radiusSm).toBe('calc(8px - 4px)');
});

test.each(['.dark', ':root.dark', '[data-theme=dark]', '[data-theme="dark"]', "[data-theme='dark']"])('%s is a dark-only scope', selector => {
  expect(importCssVariables(selector + '{--primary:#abc}')).toEqual({ tokens: {}, dark: { accent: '#abc', accentText: '#abc' }, mapped: ['--primary'], unmapped: [] });
});

test('comments, minified blocks, important suffixes and quoted delimiters survive parsing', () => {
  const result = importCssVariables(`/* note */:root{--primary:#123 !important;--font-sans:"A;/*keep*/{B}",sans-serif}:root{--background:rgb(1,2,3);--unused:yes}.dark{--primary:#456!important}`);
  expect(result.tokens.accent).toBe('#123');
  expect(result.tokens.fontBody).toBe('"A;/*keep*/{B}",sans-serif');
  expect(result.tokens.bg).toBe('rgb(1,2,3)');
  expect(result.dark.accent).toBe('#456');
  expect(result.unmapped).toEqual(['--unused']);
  expect(importCssVariables(':root{--primary:red}:root{--primary:blue}').tokens.accent).toBe('blue');
});

test('references, nested fallbacks and cycles are bounded, preserving unresolved var expressions', () => {
  const result = importCssVariables(`:root{
    --brand:220 50% 40%;--primary:var(--brand);--background:var(--unknown);
    --card:var(--missing, rgb(1, 2, 3));--ring:var(--a);--a:var(--b);--b:var(--a);
  }`);
  expect(result.tokens.accent).toBe('hsl(220 50% 40%)');
  expect(result.tokens.bg).toBe('var(--unknown)');
  expect(result.tokens.surfaceRaised).toBe('rgb(1, 2, 3)');
  expect(result.tokens.focus).toBe('var(--a)');
  expect(result.mapped).toContain('--brand');
  expect(result.unmapped).toEqual([]);
});

test('partial input uses popover, serif and shadow-md fallbacks without inventing absent tokens', () => {
  expect(importCssVariables(':root{--primary:#123}')).toEqual({ tokens: { accent: '#123', accentText: '#123' }, dark: {}, mapped: ['--primary'], unmapped: [] });
  const { tokens } = importCssVariables(':root{--popover:#fff;--font-serif:Georgia;--shadow-md:none}');
  expect(tokens).toEqual({ surfaceRaised: '#fff', fontDisplay: 'Georgia', elevation3: 'none' });
});

test('explicit dark values remain overrides even when equal to light, including derived subtle ink', () => {
  const result = importCssVariables(':root{--background:#fff;--muted-foreground:#666;--primary:#123}.dark{--background:#fff;--primary:var(--primary-copy);--primary-copy:#123}');
  expect(result.dark).toEqual({ bg: '#fff', accent: '#123', accentText: '#123', textSubtle: 'color-mix(in srgb, #666 70%, #fff)' });
});

test('empty and garbage input return an empty import and unrelated selectors are ignored', () => {
  for (const css of ['', 'hello world', '/* unterminated', 'body{--primary:red}', ':root{--primary:;}']) {
    expect(importCssVariables(css)).toEqual({ tokens: {}, dark: {}, mapped: [], unmapped: [] });
  }
  expect(importCssVariables(':root{--unknown:ok}').unmapped).toEqual(['--unknown']);
});

test.each(['.theme-dark', '[data-mode=dark]', '[data-mode="dark"]', "[data-mode='dark']", ':root:not(.light).dark'])('%s positively selects a dark scope', selector => {
  const result = importCssVariables(selector + '{--background:#111}');
  expect(result.tokens).toEqual({});
  expect(result.dark).toEqual({ bg: '#111' });
});

test.each([':root:not(.dark)', ':root:not(.theme-dark)', ':root:not([data-theme="dark"])', ':root:not([data-mode=dark])', ':root:not(:is(.dark, .theme-dark, [data-theme=dark]))'])('%s does not positively select dark', selector => {
  const result = importCssVariables(selector + '{--background:#fff}');
  expect(result.tokens).toEqual({ bg: '#fff' });
  expect(result.dark).toEqual({});
});

test('colour-scheme media queries separate light and dark root declarations', () => {
  const result = importCssVariables(`
    @media (prefers-color-scheme: light) { :root { --background: #fff; } }
    @media (prefers-color-scheme: dark) { :root { --background: #111; } }
  `);
  expect(result.tokens).toEqual({ bg: '#fff' });
  expect(result.dark).toEqual({ bg: '#111' });
});

test('nested media and layer blocks retain dark context through root and theme blocks', () => {
  const result = importCssVariables(`
    @layer base {
      :root:not(.dark) { --background: #fff; }
      @media screen and (prefers-color-scheme: dark) {
        @media (min-width: 600px) {
          @layer palette { :root { --background: #111; } }
          @theme inline { --color-primary: #abc; }
        }
      }
      @media (prefers-color-scheme: light) { @layer palette { :root { --primary: #123; } } }
    }
  `);
  expect(result.tokens).toEqual({ bg: '#fff', accent: '#123', accentText: '#123' });
  expect(result.dark).toEqual({ bg: '#111', accent: '#abc', accentText: '#abc' });
});
