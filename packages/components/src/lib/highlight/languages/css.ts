import { defineLanguage } from '../core';
import { digit, numberEnd, quotedEnd, space, spaces, word, wordEnd } from './shared';

interface State { comment: boolean; quote: string; blocks: boolean[]; value: boolean; grouping: boolean }
const groups = new Set(['@media', '@supports', '@layer', '@container', '@document', '@keyframes', '@scope', '@starting-style']);
export const css = defineLanguage('css', (): State => ({ comment: false, quote: '', blocks: [], value: false, grouping: false }), (text, previous, emit) => {
  const s = { ...previous, blocks: [...previous.blocks] };
  let i = 0;
  while (i < text.length) {
    const start = i;
    if (s.comment) { const end = text.indexOf('*/', i); i = end < 0 ? text.length : end + 2; emit('comment', text.slice(start, i)); s.comment = end < 0; continue; }
    if (s.quote) { const end = quotedEnd(text, i, s.quote); i = end < 0 ? text.length : end; emit('string', text.slice(start, i)); if (end >= 0) s.quote = ''; continue; }
    const c = text.charCodeAt(i);
    if (space(c)) { while (space(text.charCodeAt(i))) i++; emit('plain', text.slice(start, i)); continue; }
    if (text.startsWith('/*', i)) { emit('comment', '/*'); i += 2; s.comment = true; continue; }
    if (c === 34 || c === 39) { const quote = text[i++]; const end = quotedEnd(text, i, quote); i = end < 0 ? text.length : end; emit('string', text.slice(start, i)); if (end < 0) s.quote = quote; continue; }
    if (c === 64) { i++; while (word(text.charCodeAt(i)) || text[i] === '-') i++; const value = text.slice(start, i); s.grouping = groups.has(value.toLowerCase()); emit('meta', value); continue; }
    if (c === 35) { i++; while (word(text.charCodeAt(i)) || digit(text.charCodeAt(i)) || text[i] === '-') i++; emit(s.value ? 'number' : 'type', text.slice(start, i)); continue; }
    if (digit(c) || c === 46 && digit(text.charCodeAt(i + 1))) { i = numberEnd(text, i); while (word(text.charCodeAt(i)) || text[i] === '%') i++; emit('number', text.slice(start, i)); continue; }
    if (word(c) || c === 45) {
      i++;
      while (word(text.charCodeAt(i)) || digit(text.charCodeAt(i)) || text[i] === '-') i++;
      const next = text[spaces(text, i)];
      const declaration = s.blocks[s.blocks.length - 1] === true;
      emit(declaration && !s.value && next === ':' ? 'property' : next === '(' ? 'function' : declaration && s.value ? 'string' : 'tag', text.slice(start, i)); continue;
    }
    if (c === 123) { s.blocks.push(!s.grouping); s.grouping = false; s.value = false; }
    if (c === 125) { s.blocks.pop(); s.value = false; }
    if (c === 58 && s.blocks[s.blocks.length - 1] === true) s.value = true;
    if (c === 59) { s.value = false; s.grouping = false; }
    emit('{}[]():;,.'.includes(text[i]) ? 'punctuation' : 'operator', text[i++]);
  }
  return s;
});
