import type { Tokens } from '@prism-ui/react';

export type CssImport = { tokens: Partial<Tokens>; dark: Partial<Tokens>; mapped: string[]; unmapped: string[] };
type Variables = { values: Map<string, string>; candidates: Map<string, string> };
const variables = (): Variables => ({ values: new Map(), candidates: new Map() });

function withoutComments(css: string): string {
  let result = '', quote = '';
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      result += c;
      if (c === '\\') result += css[++i] ?? '';
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") { quote = c; result += c; }
    else if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? css.length : end + 1; result += ' ';
    } else result += c;
  }
  return result;
}

function targets(header: string, inherited: ('light' | 'dark')[]): ('light' | 'dark')[] {
  if (/^@theme(?:\s+inline)?\s*$/i.test(header)) return inherited.length ? inherited : ['light'];
  if (header.startsWith('@')) return inherited;
  const result = new Set<'light' | 'dark'>();
  for (const selector of header.split(',')) {
    if (/\.dark(?![\w-])|\[data-theme\s*=\s*(?:"dark"|'dark'|dark)\s*\]/i.test(selector)) result.add('dark');
    else if (/:root(?![\w-])/.test(selector)) result.add('light');
  }
  return [...result];
}

function parse(css: string) {
  css = withoutComments(css);
  const light = variables(), dark = variables(), names = new Set<string>();
  let i = 0;
  function declaration(text: string, modes: ('light' | 'dark')[]) {
    const match = /^\s*(--[\w-]+)\s*:\s*([\s\S]+)$/.exec(text);
    if (!match || !modes.length) return;
    const [, name, raw] = match, value = raw.replace(/\s*!important\s*$/i, '').trim();
    if (!value) return;
    names.add(name);
    for (const mode of modes) {
      const map = mode === 'dark' ? dark : light;
      map.values.set(name, value);
      map.candidates.set(name.slice(2).replace(/^color-/, ''), name);
    }
  }
  function block(modes: ('light' | 'dark')[]) {
    let start = i, quote = '', parens = 0;
    while (i < css.length) {
      const c = css[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = '';
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '(' || c === '[') parens++;
      else if (c === ')' || c === ']') parens--;
      else if (!parens && c === '{') {
        const nested = targets(css.slice(start, i).trim(), modes);
        i++; block(nested); start = i; continue;
      } else if (!parens && (c === ';' || c === '}')) {
        declaration(css.slice(start, i), modes); i++; start = i;
        if (c === '}') return;
        continue;
      }
      i++;
    }
    declaration(css.slice(start, i), modes);
  }
  block([]);
  return { light, dark, names };
}

function closingParen(text: string, start: number): number {
  let depth = 1, quote = '';
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')' && !--depth) return i;
  }
  return -1;
}

function resolve(value: string, values: Map<string, string>, used: Set<string>, seen = new Set<string>()): string {
  let result = '', from = 0;
  const pattern = /var\(/g;
  for (let match; (match = pattern.exec(value));) {
    const end = closingParen(value, pattern.lastIndex);
    if (end < 0) break;
    const body = value.slice(pattern.lastIndex, end), comma = body.indexOf(',');
    const name = (comma < 0 ? body : body.slice(0, comma)).trim();
    let replacement = value.slice(match.index, end + 1);
    if (values.has(name) && !seen.has(name)) {
      used.add(name);
      replacement = resolve(values.get(name)!, values, used, new Set([...seen, name]));
    } else if (comma >= 0) replacement = resolve(body.slice(comma + 1).trim(), values, used, seen);
    result += value.slice(from, match.index) + replacement;
    from = end + 1; pattern.lastIndex = from;
  }
  return result + value.slice(from);
}

function colour(value: string): string {
  return /^[+-]?(?:\d*\.?\d+)(?:deg|rad|turn|grad)?\s+[+-]?(?:\d*\.?\d+)%\s+[+-]?(?:\d*\.?\d+)%(?:\s*\/\s*[\d.]+%?)?$/i.test(value) ? 'hsl(' + value + ')' : value;
}

function mapTokens(map: Variables, used: Set<string>): Partial<Tokens> {
  const result: Partial<Tokens> = {};
  const get = (...names: string[]) => {
    for (const name of names) {
      const variable = map.candidates.get(name);
      if (variable) {
        used.add(variable);
        return resolve(map.values.get(variable)!, map.values, used, new Set([variable]));
      }
    }
  };
  const colors: [keyof Tokens, string[]][] = [
    ['bg', ['background']], ['surface', ['muted']], ['surfaceRaised', ['card', 'popover']],
    ['text', ['foreground']], ['textMuted', ['muted-foreground']], ['border', ['border']], ['borderStrong', ['input']],
    ['accent', ['primary']], ['accentText', ['primary']], ['onAccent', ['primary-foreground']], ['danger', ['destructive']], ['focus', ['ring']],
  ];
  for (const [key, names] of colors) { const value = get(...names); if (value !== undefined) result[key] = colour(value); }
  if (result.textMuted && result.bg) result.textSubtle = `color-mix(in srgb, ${result.textMuted} 70%, ${result.bg})`;
  const radius = get('radius');
  if (radius !== undefined) {
    result.radiusMd = radius; result.radiusSm = `calc(${radius} - 4px)`; result.radiusLg = `calc(${radius} + 4px)`;
  }
  const body = get('font-sans'), display = get('font-display', 'font-heading', 'font-serif'), mono = get('font-mono');
  if (body !== undefined) result.fontBody = body;
  if (display !== undefined || body !== undefined) result.fontDisplay = display ?? body;
  if (mono !== undefined) result.fontMono = mono;
  for (const [key, names] of [['elevation1', ['shadow-sm']], ['elevation2', ['shadow']], ['elevation3', ['shadow-lg', 'shadow-md']]] as const) {
    const value = get(...names); if (value !== undefined) result[key] = value;
  }
  return result;
}

export function importCssVariables(css: string): CssImport {
  const { light, dark, names } = parse(css), used = new Set<string>();
  const tokens = mapTokens(light, used);
  const values = new Map([...light.values, ...dark.values]);
  const effectiveDark = mapTokens({ values, candidates: new Map([...light.candidates, ...dark.candidates]) }, used);
  const declaredDark = mapTokens({ values, candidates: dark.candidates }, used);
  if (declaredDark.bg !== undefined || declaredDark.textMuted !== undefined) declaredDark.textSubtle = effectiveDark.textSubtle;
  const overrides = Object.fromEntries(Object.entries(effectiveDark).filter(([key, value]) => value !== tokens[key as keyof Tokens] || declaredDark[key as keyof Tokens] !== undefined));
  return { tokens, dark: overrides, mapped: [...names].filter(name => used.has(name)), unmapped: [...names].filter(name => !used.has(name)) };
}
