import { createHighlighter as createCoreHighlighter, type Highlighter, type HighlighterOptions, type Language } from './core';
import { languages } from './languages/all';

export { defineLanguage, escapeHTML, renderTokens } from './core';
export type { Token, TokenType, Emit, Language, Highlighter, HighlighterOptions } from './core';
export function createHighlighter(options: HighlighterOptions = {}) {
  return createCoreHighlighter({ ...options, languages: options.languages ?? languages });
}
let instance: ReturnType<typeof createCoreHighlighter> | undefined;
function defaultHighlighter() { return instance ??= createHighlighter(); }
export function tokenize(code: string, lang: string) { return defaultHighlighter().tokenize(code, lang); }
export function highlight(code: string, lang: string) { return defaultHighlighter().highlight(code, lang); }
export function registerLanguage(name: string, def: Language, aliases?: readonly string[]) { defaultHighlighter().registerLanguage(name, def, aliases); }
export function getLanguage(name: string) { return defaultHighlighter().getLanguage(name); }
export function listLanguages() { return defaultHighlighter().listLanguages(); }
export function resolveLang(alias: string) { return defaultHighlighter().resolveLang(alias); }
export function setHighlighter(highlighter?: Highlighter) { defaultHighlighter().setHighlighter(highlighter); }
export function createIncremental(lang: string) { return defaultHighlighter().createIncremental(lang); }
