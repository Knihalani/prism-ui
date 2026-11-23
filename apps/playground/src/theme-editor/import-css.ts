import type { Tokens } from '@prism-ui/react';

export type CssImport = { tokens: Partial<Tokens>; dark: Partial<Tokens>; mapped: string[]; unmapped: string[] };
type Variables = { values: Map<string, string>; candidates: Map<string, string> };
type Mode = 'light' | 'dark';
type RootScope = { neutral: boolean; modes: Mode[] };
type Context = { roots?: RootScope; media?: Mode[]; blocked?: boolean };
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

function withoutNegation(selector: string): string {
  let result = '', quote = '';
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (quote) {
      result += c;
      if (c === '\\') result += selector[++i] ?? '';
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") { quote = c; result += c; }
    else if (selector.slice(i, i + 5).toLowerCase() === ':not(') {
      const end = closingParen(selector, i + 5);
      if (end < 0) break;
      i = end;
    } else result += c;
  }
  return result;
}

function splitList(value: string): string[] | null {
  const parts: string[] = [];
  let start = 0, depth = 0, quote = '';
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') { if (--depth < 0) return null; }
    else if (c === ',' && !depth) { parts.push(value.slice(start, i).trim()); start = i + 1; }
  }
  if (depth || quote) return null;
  parts.push(value.slice(start).trim());
  return parts.every(Boolean) ? parts : null;
}

function rootModes(selector: string): Mode[] | null {
  let rest = withoutNegation(selector).trim(), found = false;
  const modes = new Set<Mode>();
  while (rest) {
    const space = /^[\s>+~]+/.exec(rest);
    if (space) { rest = rest.slice(space[0].length); continue; }
    if (/^:host\(/i.test(rest)) {
      const end = closingParen(rest, 6);
      if (end < 0) return null;
      const inner = rootModes(rest.slice(6, end));
      if (!inner) return null;
      inner.forEach(mode => modes.add(mode)); found = true; rest = rest.slice(end + 1); continue;
    }
    const root = /^(?::root|:host|html|body)(?![\w-])/i.exec(rest);
    const themeClass = /^\.(?:theme-)?(dark|light)(?![\w-])/.exec(rest);
    const attribute = /^\[\s*data-(?:theme|mode)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))\s*)?\]/i.exec(rest);
    const match = root ?? themeClass ?? attribute;
    if (!match) return null;
    const mode = themeClass?.[1] ?? (attribute?.[1] ?? attribute?.[2] ?? attribute?.[3]);
    if (mode === 'dark' || mode === 'light') modes.add(mode);
    found = true; rest = rest.slice(match[0].length);
  }
  return found ? [...modes] : null;
}

function mediaModes(header: string): Mode[] | undefined | null {
  const queries = splitList(header.replace(/^@media\s*/i, ''));
  if (!queries) return null;
  const union = new Set<Mode>();
  let constrained = false;
  for (const query of queries) {
    let rest = query.toLowerCase(), negated = false, type = 'all', otherConditions = 0;
    const modifier = /^(not|only)\s+/.exec(rest);
    if (modifier) { negated = modifier[1] === 'not'; rest = rest.slice(modifier[0].length); }
    const mediaType = /^(all|screen)\b/.exec(rest);
    if (mediaType) {
      type = mediaType[1]; rest = rest.slice(mediaType[0].length).trim();
      if (rest) { if (!/^and\b/.test(rest)) return null; rest = rest.slice(3).trim(); if (!rest) return null; }
    }
    let modes: Mode[] = ['light', 'dark'], hasScheme = false;
    if (!rest && !mediaType) return null;
    while (rest) {
      const feature = /^\(\s*([\w-]+)\s*:\s*([^()]*)\)/.exec(rest);
      if (!feature) return null;
      const [, name, raw] = feature, value = raw.trim();
      if (name === 'prefers-color-scheme') {
        if (value !== 'dark' && value !== 'light') return null;
        modes = modes.filter(mode => mode === value); hasScheme = true;
      } else if (/^(?:(?:min-|max-)?(?:width|height|aspect-ratio|resolution)|orientation|hover|any-hover|pointer|any-pointer|prefers-reduced-motion|prefers-contrast|forced-colors)$/.test(name)) otherConditions++;
      else return null;
      rest = rest.slice(feature[0].length).trim();
      if (rest) { if (!/^and\b/.test(rest)) return null; rest = rest.slice(3).trim(); if (!rest) return null; }
    }
    if (negated) {
      if (!hasScheme || modes.length !== 1 || otherConditions || type !== 'all') return null;
      modes = modes[0] === 'dark' ? ['light'] : ['dark'];
    }
    constrained ||= hasScheme;
    modes.forEach(mode => union.add(mode));
  }
  return constrained ? [...union] : undefined;
}

function selectedModes(context: Context): Mode[] {
  if (context.blocked || !context.roots) return [];
  const modes = new Set([...context.roots.modes, ...(context.roots.neutral ? context.media ?? ['light' as const] : [])]);
  return [...modes].filter(mode => !context.media || context.media.includes(mode));
}

function targets(header: string, inherited: Context): Context {
  if (inherited.blocked) return inherited;
  if (/^@media\b/i.test(header)) {
    const modes = mediaModes(header);
    if (modes === null) return { ...inherited, blocked: true };
    if (!modes) return inherited;
    const media = inherited.media ? modes.filter(mode => inherited.media!.includes(mode)) : modes;
    return { ...inherited, media, blocked: !media.length };
  }
  if (/^@theme(?:\s+inline)?\s*$/i.test(header)) return { ...inherited, roots: inherited.roots ?? { neutral: true, modes: [] } };
  if (header.startsWith('@')) return inherited;
  const scopes = (splitList(header) ?? []).map(rootModes).filter(scope => scope !== null);
  if (!scopes.length) return { ...inherited, blocked: true };
  const roots = { neutral: scopes.some(scope => !scope.length), modes: [...new Set(scopes.flat())] };
  return { ...inherited, roots };
}

function parse(css: string) {
  css = withoutComments(css);
  const light = variables(), dark = variables(), names = new Set<string>(), ignored = new Set<string>();
  let i = 0;
  function declaration(text: string, modes: Mode[]) {
    const match = /^\s*(--[\w-]+)\s*:\s*([\s\S]+)$/.exec(text);
    if (!match) return;
    const [, name, raw] = match, value = raw.replace(/\s*!important\s*$/i, '').trim();
    if (!value) return;
    names.add(name);
    if (!modes.length) { ignored.add(name); return; }
    for (const mode of modes) {
      const map = mode === 'dark' ? dark : light;
      map.values.set(name, value);
      map.candidates.set(name.slice(2).replace(/^color-/, ''), name);
    }
  }
  function block(context: Context) {
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
        const nested = targets(css.slice(start, i).trim(), context);
        i++; block(nested); start = i; continue;
      } else if (!parens && (c === ';' || c === '}')) {
        declaration(css.slice(start, i), selectedModes(context)); i++; start = i;
        if (c === '}') return;
        continue;
      }
      i++;
    }
    declaration(css.slice(start, i), selectedModes(context));
  }
  block({});
  return { light, dark, names, ignored };
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
  const { light, dark, names, ignored } = parse(css), used = new Set<string>();
  const tokens = mapTokens(light, used);
  const values = new Map([...light.values, ...dark.values]);
  const effectiveDark = mapTokens({ values, candidates: new Map([...light.candidates, ...dark.candidates]) }, used);
  const declaredDark = mapTokens({ values, candidates: dark.candidates }, used);
  if (declaredDark.bg !== undefined || declaredDark.textMuted !== undefined) declaredDark.textSubtle = effectiveDark.textSubtle;
  const overrides = Object.fromEntries(Object.entries(effectiveDark).filter(([key, value]) => value !== tokens[key as keyof Tokens] || declaredDark[key as keyof Tokens] !== undefined));
  return { tokens, dark: overrides, mapped: [...names].filter(name => used.has(name)), unmapped: [...names].filter(name => !used.has(name) || ignored.has(name)) };
}
