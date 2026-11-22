import type { Emit, TokenType } from '../core';

export function word(code: number): boolean { return code >= 65 && code <= 90 || code >= 97 && code <= 122 || code === 95 || code === 36 || code >= 128; }
export function digit(code: number): boolean { return code >= 48 && code <= 57; }
export function space(code: number): boolean { return code === 32 || code === 9 || code === 10 || code === 13; }
export function wordEnd(text: string, start: number): number {
  let i = start;
  while (i < text.length && (word(text.charCodeAt(i)) || digit(text.charCodeAt(i)))) i++;
  return i;
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
export function emitRange(emit: Emit, type: TokenType, text: string, start: number, end: number): number { emit(type, text.slice(start, end)); return end; }
