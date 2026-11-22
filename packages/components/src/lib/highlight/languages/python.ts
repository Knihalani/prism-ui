import { defineRangeLanguage } from '../core';
import { digit, numberEnd, space, spaces, stringPrefix, word, wordEnd, wordLookup } from './shared';

interface StringFrame { quote: string; raw: boolean; formatted: boolean; depth: number }
interface State { quote: string; raw: boolean; formatted: boolean; frames: StringFrame[] }
const lookup = /* @__PURE__ */ wordLookup([
  ['builtin', 'abs all any bin bool bytearray bytes callable chr classmethod compile complex delattr dict dir divmod enumerate eval exec filter float format frozenset getattr globals hasattr hash help hex id input int isinstance issubclass iter len list locals map max memoryview min next object oct open ord pow print property range repr reversed round set setattr slice sorted staticmethod str sum super tuple type vars zip __import__'],
  ['constant', 'True False None'],
  ['keyword', 'and as assert async await break case class continue def del elif else except finally for from global if import in is lambda match nonlocal not or pass raise return try while with yield'],
]);
export const python = defineRangeLanguage('python', (): State => ({ quote: '', raw: false, formatted: false, frames: [] }), (text, previous, emit) => {
  const s: State = { quote: previous.quote, raw: previous.raw, formatted: previous.formatted, frames: previous.frames.map(frame => ({ ...frame })) };
  let i = 0;
  while (i < text.length) {
    const start = i;
    if (s.quote) {
      const quoteCode = s.quote.charCodeAt(0);
      while (i < text.length) {
        const c = text.charCodeAt(i);
        if (!s.raw && c === 92) { i = Math.min(text.length, i + 2); continue; }
        if (c === quoteCode && (s.quote.length === 1 || text.startsWith(s.quote, i))) { i += s.quote.length; s.quote = ''; break; }
        if (s.formatted && c === 123) {
          if (text.charCodeAt(i + 1) === 123) { i += 2; continue; }
          break;
        }
        if (s.formatted && c === 125 && text.charCodeAt(i + 1) === 125) { i += 2; continue; }
        i++;
      }
      emit('string', start, i);
      if (s.quote && s.formatted && text[i] === '{') {
        s.frames.push({ quote: s.quote, raw: s.raw, formatted: s.formatted, depth: 1 });
        s.quote = ''; emit('punctuation', i, i + 1); i++;
      }
      continue;
    }
    const c = text.charCodeAt(i);
    if (space(c)) { while (space(text.charCodeAt(i))) i++; emit('plain', start, i); continue; }
    if (c === 35) { emit('comment', i, text.length); break; }
    if (c === 64) {
      i++;
      while (word(text.charCodeAt(i)) || digit(text.charCodeAt(i)) || text[i] === '.') i++;
      emit('meta', start, i); continue;
    }
    let quoteStart = i;
    while (quoteStart < i + 2 && stringPrefix(text.charCodeAt(quoteStart))) quoteStart++;
    if (text[quoteStart] === '"' || text[quoteStart] === "'") {
      const prefix = text.slice(i, quoteStart).toLowerCase();
      const char = text[quoteStart];
      s.quote = text[quoteStart + 1] === char && text[quoteStart + 2] === char ? char === '"' ? '"""' : "'''" : char;
      s.raw = prefix.includes('r'); s.formatted = prefix.includes('f');
      i = quoteStart + s.quote.length;
      emit('string', start, i); continue;
    }
    if (digit(c) || c === 46 && digit(text.charCodeAt(i + 1))) { i = numberEnd(text, i); emit('number', start, i); continue; }
    if (word(c)) {
      i = wordEnd(text, i);
      emit(lookup(text, start, i) ?? (text[spaces(text, i)] === '(' ? 'function' : c >= 65 && c <= 90 ? 'type' : 'variable'), start, i);
      continue;
    }
    if (c === 123) { const frame = s.frames[s.frames.length - 1]; if (frame) frame.depth++; }
    if (c === 125) {
      const frame = s.frames[s.frames.length - 1];
      if (frame && --frame.depth === 0) { s.frames.pop(); s.quote = frame.quote; s.raw = frame.raw; s.formatted = frame.formatted; }
    }
    emit(c === 40 || c === 41 || c === 91 || c === 93 || c === 123 || c === 125 || c === 58 || c === 44 || c === 46 ? 'punctuation' : 'operator', i, i + 1); i++;
  }
  return s;
}, ['py', 'python3']);
