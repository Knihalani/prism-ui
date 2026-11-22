import { defineLanguage } from '../core';
import { digit, numberEnd, quotedEnd, space, spaces, word, wordEnd } from './shared';

interface State { comment: boolean; quote: string }
export const json = defineLanguage('json', (): State => ({ comment: false, quote: '' }), (text, previous, emit) => {
  const s = { ...previous };
  let i = 0;
  while (i < text.length) {
    const start = i;
    if (s.comment) { const end = text.indexOf('*/', i); i = end < 0 ? text.length : end + 2; emit('comment', text.slice(start, i)); s.comment = end < 0; continue; }
    if (s.quote) { const end = quotedEnd(text, i, s.quote); i = end < 0 ? text.length : end; emit('string', text.slice(start, i)); if (end >= 0) s.quote = ''; continue; }
    const c = text.charCodeAt(i);
    if (space(c)) { while (space(text.charCodeAt(i))) i++; emit('plain', text.slice(start, i)); continue; }
    if (text.startsWith('//', i)) { emit('comment', text.slice(i)); break; }
    if (text.startsWith('/*', i)) { emit('comment', '/*'); i += 2; s.comment = true; continue; }
    if (c === 34 || c === 39) {
      const quote = text[i++]; const end = quotedEnd(text, i, quote);
      i = end < 0 ? text.length : end;
      emit(end >= 0 && text[spaces(text, i)] === ':' ? 'property' : 'string', text.slice(start, i));
      if (end < 0) s.quote = quote;
      continue;
    }
    if (digit(c) || c === 45 && digit(text.charCodeAt(i + 1))) { i = numberEnd(text, i); emit('number', text.slice(start, i)); continue; }
    if (word(c)) { i = wordEnd(text, i); const value = text.slice(start, i); emit(value === 'true' || value === 'false' || value === 'null' || value === 'Infinity' || value === 'NaN' ? 'constant' : text[spaces(text, i)] === ':' ? 'property' : 'plain', value); continue; }
    emit('{}[],:'.includes(text[i]) ? 'punctuation' : 'plain', text[i++]);
  }
  return s;
}, ['jsonc', 'json5']);
