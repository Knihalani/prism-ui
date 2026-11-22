import type { RangeEmit, TokenType } from '../core';

function characterClasses(): Uint8Array {
  const table = new Uint8Array(65536);
  table.fill(1, 128);
  for (let c = 65; c <= 90; c++) table[c] = 1;
  for (let c = 97; c <= 122; c++) table[c] = 1;
  for (let c = 48; c <= 57; c++) table[c] = 2;
  table[36] = table[95] = 1;
  table[9] = table[10] = table[13] = table[32] = 4;
  for (const c of [70, 102, 82, 114, 66, 98, 85, 117]) table[c] |= 8;
  return table;
}
const classes = /* @__PURE__ */ characterClasses();
export function word(code: number): boolean { return (classes[code] & 1) !== 0; }
export function digit(code: number): boolean { return (classes[code] & 2) !== 0; }
export function space(code: number): boolean { return (classes[code] & 4) !== 0; }
export function stringPrefix(code: number): boolean { return (classes[code] & 8) !== 0; }
export function wordEnd(text: string, start: number): number {
  let i = start;
  while (i < text.length) {
    if (!(classes[text.charCodeAt(i)] & 3)) break;
    i++;
  }
  return i;
}
export function wordLookup(groups: readonly (readonly [TokenType, string])[]) {
  const types = new Map<string, TokenType>();
  for (const [type, words] of groups) for (const word of words.split(' ')) if (word) types.set(word, type);
  interface Entry { word: string; type: TokenType; next?: Entry }
  const buckets = new Map<number, Entry>();
  for (const [word, type] of types) {
    const key = (word.length << 16) ^ (word.charCodeAt(0) << 8) ^ word.charCodeAt(word.length - 1);
    buckets.set(key, { word, type, next: buckets.get(key) });
  }
  return (text: string, start: number, end: number): TokenType | undefined => {
    const length = end - start;
    const key = (length << 16) ^ (text.charCodeAt(start) << 8) ^ text.charCodeAt(end - 1);
    let entry = buckets.get(key);
    while (entry) {
      if (entry.word.length === length && text.startsWith(entry.word, start)) return entry.type;
      entry = entry.next;
    }
    return undefined;
  };
}
export function spaces(text: string, start: number): number { while (space(text.charCodeAt(start))) start++; return start; }
export function numberEnd(text: string, start: number): number {
  let i = start + 1;
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (digit(c) || c >= 65 && c <= 70 || c >= 97 && c <= 102 || c === 120 || c === 88 || c === 111 || c === 79 || c === 98 || c === 66 || c === 95 || c === 46 && text.charCodeAt(i + 1) !== 46) { i++; continue; }
    if ((c === 43 || c === 45) && (text[i - 1] === 'e' || text[i - 1] === 'E')) { i++; continue; }
    break;
  }
  return i;
}
export function quotedEnd(text: string, start: number, quote: string, doubled = false): number {
  let i = start;
  if (quote.length === 1) {
    const q = quote.charCodeAt(0);
    while (i < text.length) {
      const c = text.charCodeAt(i++);
      if (c === 92) { i++; continue; }
      if (c === q) {
        if (doubled && text.charCodeAt(i) === q) { i++; continue; }
        return i;
      }
    }
    return -1;
  }
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue; }
    if (text.startsWith(quote, i)) {
      i += quote.length;
      if (doubled && text.startsWith(quote, i)) { i += quote.length; continue; }
      return i;
    }
    i++;
  }
  return -1;
}
export function emitRange(emit: RangeEmit, type: TokenType, text: string, start: number, end: number): number { emit(type, start, end); return end; }
