import { defineRangeLanguage } from '../core';
import { digit, numberEnd, quotedEnd, space, spaces, word, wordEnd } from './shared';

interface State { comment: boolean; quote: string }
export const json = defineRangeLanguage('json', (): State => ({ comment: false, quote: '' }), (text, previous, emit) => {
  let comment = previous.comment;
  let quote = previous.quote;
  let i = 0;
  while (i < text.length) {
    const start = i;
    if (comment) { const end = text.indexOf('*/', i); i = end < 0 ? text.length : end + 2; emit('comment', start, i); comment = end < 0; continue; }
    if (quote) { const end = quotedEnd(text, i, quote); i = end < 0 ? text.length : end; emit('string', start, i); if (end >= 0) quote = ''; continue; }
    const c = text.charCodeAt(i);
    if (space(c)) { while (space(text.charCodeAt(i))) i++; emit('plain', start, i); continue; }
    if (c === 47) {
      if (text.charCodeAt(i + 1) === 47) { emit('comment', i, text.length); break; }
      if (text.charCodeAt(i + 1) === 42) { emit('comment', i, i + 2); i += 2; comment = true; continue; }
    }
    if (c === 34 || c === 39) {
      const delimiter = text[i++]; const end = quotedEnd(text, i, delimiter);
      i = end < 0 ? text.length : end;
      emit(end >= 0 && text[spaces(text, i)] === ':' ? 'property' : 'string', start, i);
      if (end < 0) quote = delimiter;
      continue;
    }
    if (digit(c) || c === 45 && digit(text.charCodeAt(i + 1))) { i = numberEnd(text, i); emit('number', start, i); continue; }
    if (word(c)) { i = wordEnd(text, i); const value = text.slice(start, i); emit(value === 'true' || value === 'false' || value === 'null' || value === 'Infinity' || value === 'NaN' ? 'constant' : text[spaces(text, i)] === ':' ? 'property' : 'plain', start, i); continue; }
    emit('{}[],:'.includes(text[i]) ? 'punctuation' : 'plain', i, i + 1); i++;
  }
  return comment === previous.comment && quote === previous.quote ? previous : { comment, quote };
}, ['jsonc', 'json5']);
