import { get } from './json-path';

export interface Match { score: number; indices: number[] }
export interface SearchResult<T> { item: T; score: number; matches: number[] }
interface Normalized { text: string; positions: number[] }
export interface PreparedIndex<T> { readonly entries: readonly { item: T; normalized: Normalized }[] }
export interface FilterOptions<T> {
  keys?: readonly string[]; getText?: (item: T) => string; limit?: number; threshold?: number;
}
function normalize(text: string): Normalized {
  let normalized = '';
  const positions: number[] = [];
  let offset = 0;
  for (const char of text) {
    const folded = char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    normalized += folded;
    for (let i = 0; i < folded.length; i++) positions.push(offset);
    offset += char.length;
  }
  return { text: normalized, positions };
}
function match(query: string, target: Normalized): Match | null {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { score: 0, indices: [] };
  let total = 0;
  const indices = new Set<number>();
  for (const token of tokens) {
    let cursor = 0;
    let previous = -2;
    for (const char of token) {
      const index = target.text.indexOf(char, cursor);
      if (index < 0) return null;
      total += 1 + (index === 0 ? 8 : /[^\p{L}\p{N}]/u.test(target.text[index - 1]) ? 4 : 0) + (index === previous + 1 ? 5 : 0);
      total -= (index - cursor) * 0.1;
      indices.add(target.positions[index]);
      previous = index;
      cursor = index + char.length;
    }
  }
  return { score: total - target.text.length * 0.001, indices: [...indices].sort((a, b) => a - b) };
}
export function score(query: string, text: string): Match | null { return match(normalize(query).text, normalize(text)); }
export function prepare<T>(items: readonly T[], getText: (item: T) => string): PreparedIndex<T> {
  return { entries: items.map(item => ({ item, normalized: normalize(getText(item)) })) };
}
export function filter<T>(items: readonly T[] | PreparedIndex<T>, query: string, options: FilterOptions<T> = {}): SearchResult<T>[] {
  const index = 'entries' in items && !Array.isArray(items) ? items as PreparedIndex<T> : prepare(items as readonly T[], options.getText ?? (item => options.keys ? options.keys.map(key => get(item, key) ?? '').join(' ') : String(item ?? '')));
  const normalized = normalize(query).text;
  const results: SearchResult<T>[] = [];
  for (const { item, normalized: target } of index.entries) {
    const result = match(normalized, target);
    if (result && result.score >= (options.threshold ?? -Infinity)) results.push({ item, score: result.score, matches: result.indices });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, Math.max(0, options.limit ?? Infinity));
}
