import { defineLanguage } from '../core';
import { digit, numberEnd, space, spaces, word, wordEnd } from './shared';

interface StringFrame { quote: string; raw: boolean; formatted: boolean; depth: number }
interface State { quote: string; raw: boolean; formatted: boolean; frames: StringFrame[] }
const keywords = new Set('and as assert async await break case class continue def del elif else except finally for from global if import in is lambda match nonlocal not or pass raise return try while with yield'.split(' '));
const builtins = new Set('abs all any bin bool bytearray bytes callable chr classmethod compile complex delattr dict dir divmod enumerate eval exec filter float format frozenset getattr globals hasattr hash help hex id input int isinstance issubclass iter len list locals map max memoryview min next object oct open ord pow print property range repr reversed round set setattr slice sorted staticmethod str sum super tuple type vars zip __import__'.split(' '));
export const python = defineLanguage('python', (): State => ({ quote: '', raw: false, formatted: false, frames: [] }), (text, previous, emit) => {
  const s = { ...previous, frames: previous.frames.map(frame => ({ ...frame })) };
  let i = 0;
  while (i < text.length) {
    const start = i;
    if (s.quote) {
      while (i < text.length) {
        if (!s.raw && text[i] === '\\') { i = Math.min(text.length, i + 2); continue; }
        if (text.startsWith(s.quote, i)) { i += s.quote.length; s.quote = ''; break; }
        if (s.formatted && text[i] === '{') {
          if (text[i + 1] === '{') { i += 2; continue; }
          break;
        }
        if (s.formatted && text.startsWith('}}', i)) { i += 2; continue; }
        i++;
      }
      emit('string', text.slice(start, i));
      if (s.quote && s.formatted && text[i] === '{') {
        s.frames.push({ quote: s.quote, raw: s.raw, formatted: s.formatted, depth: 1 });
        s.quote = ''; emit('punctuation', '{'); i++;
      }
      continue;
    }
    const c = text.charCodeAt(i);
    if (space(c)) { while (space(text.charCodeAt(i))) i++; emit('plain', text.slice(start, i)); continue; }
    if (c === 35) { emit('comment', text.slice(i)); break; }
    if (c === 64) {
      i++;
      while (word(text.charCodeAt(i)) || digit(text.charCodeAt(i)) || text[i] === '.') i++;
      emit('meta', text.slice(start, i)); continue;
    }
    let quoteStart = i;
    while (quoteStart < i + 2 && 'fFrRbBuU'.includes(text[quoteStart] ?? '\0')) quoteStart++;
    if (text[quoteStart] === '"' || text[quoteStart] === "'") {
      const prefix = text.slice(i, quoteStart).toLowerCase();
      const char = text[quoteStart];
      s.quote = text.startsWith(char.repeat(3), quoteStart) ? char.repeat(3) : char;
      s.raw = prefix.includes('r'); s.formatted = prefix.includes('f');
      i = quoteStart + s.quote.length;
      emit('string', text.slice(start, i)); continue;
    }
    if (digit(c) || c === 46 && digit(text.charCodeAt(i + 1))) { i = numberEnd(text, i); emit('number', text.slice(start, i)); continue; }
    if (word(c)) {
      i = wordEnd(text, i); const value = text.slice(start, i);
      emit(keywords.has(value) ? 'keyword' : value === 'True' || value === 'False' || value === 'None' ? 'constant' : builtins.has(value) ? 'builtin' : text[spaces(text, i)] === '(' ? 'function' : c >= 65 && c <= 90 ? 'type' : 'variable', value);
      continue;
    }
    if (c === 123) { const frame = s.frames[s.frames.length - 1]; if (frame) frame.depth++; }
    if (c === 125) {
      const frame = s.frames[s.frames.length - 1];
      if (frame && --frame.depth === 0) { s.frames.pop(); s.quote = frame.quote; s.raw = frame.raw; s.formatted = frame.formatted; }
    }
    emit('()[]{}:,.'.includes(text[i]) ? 'punctuation' : 'operator', text[i++]);
  }
  return s;
}, ['py', 'python3']);
