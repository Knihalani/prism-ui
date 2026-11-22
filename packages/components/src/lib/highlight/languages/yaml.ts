import { defineLanguage } from '../core';
import { digit, numberEnd, quotedEnd, space } from './shared';

interface State { quote: string; blockIndent: number }
export const yaml = defineLanguage('yaml', (): State => ({ quote: '', blockIndent: -1 }), (text, previous, emit) => {
  const s = { ...previous };
  let indent = 0;
  while (text[indent] === ' ') indent++;
  if (s.blockIndent >= 0) {
    if (indent > s.blockIndent || text.trim() === '') { emit('string', text); return s; }
    s.blockIndent = -1;
  }
  if (!s.quote && (text.startsWith('---') || text.startsWith('...') || text.startsWith('%'))) { emit('meta', text); return s; }
  let i = 0;
  while (i < text.length) {
    const start = i;
    if (s.quote) { const end = quotedEnd(text, i, s.quote, s.quote === "'"); i = end < 0 ? text.length : end; emit('string', text.slice(start, i)); if (end >= 0) s.quote = ''; continue; }
    const c = text.charCodeAt(i);
    if (space(c)) { while (space(text.charCodeAt(i))) i++; emit('plain', text.slice(start, i)); continue; }
    if (c === 35 && (i === 0 || space(text.charCodeAt(i - 1)))) { emit('comment', text.slice(i)); break; }
    if (c === 34 || c === 39) {
      const quote = text[i++]; const end = quotedEnd(text, i, quote, quote === "'"); i = end < 0 ? text.length : end;
      let next = i; while (text[next] === ' ') next++;
      emit(text[next] === ':' ? 'property' : 'string', text.slice(start, i)); if (end < 0) s.quote = quote; continue;
    }
    if ((c === 124 || c === 62) && (i === indent || space(text.charCodeAt(i - 1)))) { emit('operator', text.slice(i)); s.blockIndent = indent; break; }
    if (c === 38 || c === 42 || c === 33) {
      i++; while (i < text.length && !space(text.charCodeAt(i)) && !',[]{}'.includes(text[i])) i++;
      emit(c === 33 ? 'type' : 'variable', text.slice(start, i)); continue;
    }
    if ('{}[],:?-'.includes(text[i]) && (text[i] !== '-' || space(text.charCodeAt(i + 1)))) { emit('punctuation', text[i++]); continue; }
    let keyEnd = i;
    while (keyEnd < text.length && text[keyEnd] !== '\n' && text[keyEnd] !== '\r' && !(text[keyEnd] === ':' && (space(text.charCodeAt(keyEnd + 1)) || keyEnd + 1 === text.length)) && !(text[keyEnd] === '#' && space(text.charCodeAt(keyEnd - 1))) && !'{}[],'.includes(text[keyEnd])) keyEnd++;
    if (text[keyEnd] === ':' && (space(text.charCodeAt(keyEnd + 1)) || keyEnd + 1 === text.length || ',[]{}'.includes(text[keyEnd + 1]))) {
      let end = keyEnd; while (end > i && text[end - 1] === ' ') end--;
      emit('property', text.slice(i, end)); emit('plain', text.slice(end, keyEnd)); i = keyEnd; continue;
    }
    if (keyEnd === i) { emit('plain', text[i++]); continue; }
    let end = keyEnd;
    while (end > i && space(text.charCodeAt(end - 1))) end--;
    const value = text.slice(i, end); const lower = value.toLowerCase();
    emit(lower === 'true' || lower === 'false' || lower === 'null' || lower === '~' ? 'constant' : (digit(c) || c === 45 && digit(text.charCodeAt(i + 1))) && numberEnd(text, i) === end ? 'number' : 'string', value);
    emit('plain', text.slice(end, keyEnd)); i = keyEnd;
  }
  return s;
}, ['yml']);
