export type TokenType = 'keyword' | 'string' | 'number' | 'comment' | 'function' | 'type' | 'operator' | 'punctuation' | 'variable' | 'constant' | 'property' | 'tag' | 'attr' | 'regex' | 'builtin' | 'deleted' | 'inserted' | 'meta' | 'plain';
export interface Token { type: TokenType; text: string }
export type Emit = (type: TokenType, text: string) => void;
export interface Language {
  name: string;
  aliases?: readonly string[];
  initialState(): unknown;
  /** Return a new state when changing it; checkpoints retain earlier states. */
  scan(line: string, state: unknown, emit: Emit): unknown;
}
export interface Highlighter {
  tokenize?(code: string, lang: string): Token[];
  highlight(code: string, lang: string): string;
  supports(lang: string): boolean;
}
export function defineLanguage<S>(name: string, initialState: () => S, scan: (line: string, state: S, emit: Emit) => S, aliases: readonly string[] = []): Language {
  return { name, aliases, initialState, scan: (line, state, emit) => scan(line, state as S, emit) };
}
export function escapeHTML(text: string): string {
  if (!/[&<>"']/.test(text)) return text;
  return text.replace(/[&<>"']/g, char => char === '&' ? '&amp;' : char === '<' ? '&lt;' : char === '>' ? '&gt;' : char === '"' ? '&quot;' : '&#39;');
}
function collector(tokens: Token[]): Emit {
  return (type, text) => {
    if (!text) return;
    const last = tokens[tokens.length - 1];
    if (last?.type === type) last.text += text;
    else tokens.push({ type, text });
  };
}
export function renderTokens(tokens: readonly Token[]): string {
  let html = '';
  for (const token of tokens) {
    const text = escapeHTML(token.text);
    html += token.type === 'plain' ? text : `<span class="prism-tok-${token.type}">${text}</span>`;
  }
  return html;
}
interface Line { end: number; state: unknown; tokens: Token[]; html: string }
export interface HighlighterOptions { languages?: readonly Language[]; cacheSize?: number }
export function createHighlighter({ languages = [], cacheSize = 64 }: HighlighterOptions = {}) {
  const registry = new Map<string, Language>();
  const aliases = new Map<string, string>();
  const cache = new Map<string, string>();
  let backend: Highlighter | undefined;
  function resolveLang(alias: string): string { const name = alias.toLowerCase(); return aliases.get(name) ?? name; }
  function getLanguage(name: string): Language | undefined { return registry.get(resolveLang(name)); }
  function registerLanguage(name: string, def: Language, extraAliases: readonly string[] = []) {
    const canonical = name.toLowerCase();
    registry.set(canonical, def);
    aliases.set(canonical, canonical);
    for (const alias of [...def.aliases ?? [], ...extraAliases]) aliases.set(alias.toLowerCase(), canonical);
    cache.clear();
  }
  for (const language of languages) registerLanguage(language.name, language);
  function scanLine(text: string, language: Language | undefined, state: unknown): Omit<Line, 'end'> {
    const tokens: Token[] = [];
    if (language) state = language.scan(text, state, collector(tokens));
    else if (text) tokens.push({ type: 'plain', text });
    return { state, tokens, html: renderTokens(tokens) };
  }
  function scan(code: string, language: Language | undefined, emit: Emit, endLine?: () => void): void {
    let state = language?.initialState();
    let start = 0;
    while (start < code.length) {
      const newline = code.indexOf('\n', start);
      const end = newline < 0 ? code.length : newline + 1;
      const text = code.slice(start, end);
      if (language) state = language.scan(text, state, emit);
      else emit('plain', text);
      endLine?.();
      start = end;
    }
  }
  function tokenize(code: string, lang: string): Token[] {
    const canonical = resolveLang(lang);
    if (backend?.supports(canonical) && backend.tokenize) return backend.tokenize(code, canonical);
    const output: Token[] = [];
    const emit = collector(output);
    scan(code, getLanguage(lang), emit);
    return output;
  }
  function builtinHTML(code: string, lang: string): string {
    const language = getLanguage(lang);
    if (!language) return escapeHTML(code);
    const output: string[] = [];
    let state = language.initialState();
    let start = 0;
    while (start < code.length) {
      const newline = code.indexOf('\n', start);
      const end = newline < 0 ? code.length : newline + 1;
      const tokens: Token[] = [];
      state = language.scan(code.slice(start, end), state, collector(tokens));
      output.push(renderTokens(tokens));
      start = end;
    }
    return output.join('');
  }
  function highlight(code: string, lang: string): string {
    const canonical = resolveLang(lang);
    if (cacheSize <= 0) return backend?.supports(canonical) ? backend.highlight(code, canonical) : builtinHTML(code, canonical);
    const key = canonical.length + ':' + canonical + code;
    const found = cache.get(key);
    if (found !== undefined) { cache.delete(key); cache.set(key, found); return found; }
    const html = backend?.supports(canonical) ? backend.highlight(code, canonical) : builtinHTML(code, canonical);
    if (cacheSize > 0) {
      cache.set(key, html);
      if (cache.size > cacheSize) cache.delete(cache.keys().next().value!);
    }
    return html;
  }
  function createIncremental(lang: string) {
    let previous = '';
    let checkpoints: Line[] = [];
    let stableHTML = '';
    let stableEnd = 0;
    let currentHTML = '';
    let tailTokens: Token[] = [];
    let activeLanguage = getLanguage(lang);
    let activeBackend = backend;
    function reset() { previous = ''; checkpoints = []; stableHTML = ''; stableEnd = 0; currentHTML = ''; tailTokens = []; }
    function update(code: string): string {
      const language = getLanguage(lang);
      if (language !== activeLanguage || backend !== activeBackend) { reset(); activeLanguage = language; activeBackend = backend; }
      if (backend?.supports(resolveLang(lang))) { previous = code; currentHTML = highlight(code, lang); return currentHTML; }
      if (!code.startsWith(previous)) {
        let same = 0;
        const max = Math.min(code.length, previous.length);
        while (same < max && code.charCodeAt(same) === previous.charCodeAt(same)) same++;
        let keep = 0;
        while (keep < checkpoints.length && checkpoints[keep].end <= same) keep++;
        checkpoints.length = keep;
        stableEnd = keep ? checkpoints[keep - 1].end : 0;
        stableHTML = checkpoints.map(line => line.html).join('');
      }
      let state = checkpoints.length ? checkpoints[checkpoints.length - 1].state : language?.initialState();
      let start = stableEnd;
      let tail = '';
      tailTokens = [];
      while (start < code.length) {
        const newline = code.indexOf('\n', start);
        const end = newline < 0 ? code.length : newline + 1;
        const line = scanLine(code.slice(start, end), language, state);
        state = line.state;
        if (newline >= 0) {
          checkpoints.push({ ...line, end });
          stableHTML += line.html;
          stableEnd = end;
        } else { tail = line.html; tailTokens = line.tokens; }
        start = end;
      }
      previous = code;
      currentHTML = stableHTML + tail;
      return currentHTML;
    }
    function tokens(): Token[] {
      if (!previous) return [];
      if (backend?.supports(resolveLang(lang))) return tokenize(previous, lang);
      const result: Token[] = [];
      const emit = collector(result);
      for (const line of checkpoints) for (const token of line.tokens) emit(token.type, token.text);
      for (const token of tailTokens) emit(token.type, token.text);
      return result;
    }
    return { update, tokens, reset };
  }
  return {
    tokenize, highlight, registerLanguage, getLanguage, resolveLang, createIncremental,
    listLanguages: () => [...registry.keys()],
    supports: (lang: string) => !!getLanguage(lang) || !!backend?.supports(resolveLang(lang)),
    setHighlighter: (value?: Highlighter) => { backend = value; cache.clear(); },
  };
}
