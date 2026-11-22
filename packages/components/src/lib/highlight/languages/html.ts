import { defineLanguage } from '../core';
import { javascript } from './js';
import { css } from './css';
import { digit, quotedEnd, space, word } from './shared';

interface State { mode: string; tag: string; tagName: boolean; closing: boolean; quote: string; embedded: unknown }
export const html = defineLanguage('html', (): State => ({ mode: 'text', tag: '', tagName: false, closing: false, quote: '', embedded: undefined }), (text, previous, emit) => {
  const s = { ...previous };
  let i = 0;
  let lowercase: string | undefined;
  while (i < text.length) {
    const start = i;
    if (s.mode === 'script' || s.mode === 'style') {
      const language = s.mode === 'script' ? javascript : css;
      lowercase ??= text.toLowerCase();
      let end = lowercase.indexOf('</' + s.mode, i);
      while (end >= 0) {
        const next = lowercase.charCodeAt(end + s.mode.length + 2);
        if (next === 62 || next === 47 || space(next)) break;
        end = lowercase.indexOf('</' + s.mode, end + 2);
      }
      const finish = end < 0 ? text.length : end;
      s.embedded = language.scan(text.slice(i, finish), s.embedded, emit);
      i = finish;
      if (end >= 0) s.mode = 'text';
      continue;
    }
    if (s.mode === 'comment') {
      const end = text.indexOf('-->', i);
      i = end < 0 ? text.length : end + 3;
      emit('comment', text.slice(start, i)); if (end >= 0) s.mode = 'text'; continue;
    }
    if (s.mode === 'declaration') {
      const end = text.indexOf('>', i); i = end < 0 ? text.length : end + 1;
      emit('meta', text.slice(start, i)); if (end >= 0) s.mode = 'text'; continue;
    }
    if (s.mode === 'quote') {
      const end = quotedEnd(text, i, s.quote); i = end < 0 ? text.length : end;
      emit('string', text.slice(start, i)); if (end >= 0) s.mode = 'tag'; continue;
    }
    if (s.mode === 'text') {
      if (text.startsWith('<!--', i)) { emit('comment', '<!--'); i += 4; s.mode = 'comment'; continue; }
      if (text.startsWith('<!', i) || text.startsWith('<?', i)) { emit('meta', text.slice(i, i + 2)); i += 2; s.mode = 'declaration'; continue; }
      if (text[i] === '<' && (word(text.charCodeAt(i + 1)) || text[i + 1] === '/')) {
        s.closing = text[i + 1] === '/'; s.tagName = true; s.tag = ''; s.mode = 'tag';
        emit('punctuation', text.slice(i, i + (s.closing ? 2 : 1))); i += s.closing ? 2 : 1; continue;
      }
      i++;
      while (i < text.length && text[i] !== '<') i++;
      emit('plain', text.slice(start, i)); continue;
    }
    if (space(text.charCodeAt(i))) { while (space(text.charCodeAt(i))) i++; emit('plain', text.slice(start, i)); continue; }
    if (text[i] === '>' || text.startsWith('/>', i)) {
      const self = text[i] === '/';
      i += self ? 2 : 1; emit('punctuation', text.slice(start, i));
      s.mode = !self && !s.closing && (s.tag === 'script' || s.tag === 'style') ? s.tag : 'text';
      if (s.mode === 'script' || s.mode === 'style') s.embedded = (s.mode === 'script' ? javascript : css).initialState();
      continue;
    }
    if (text[i] === '"' || text[i] === "'") {
      const quote = text[i++]; const end = quotedEnd(text, i, quote);
      i = end < 0 ? text.length : end; emit('string', text.slice(start, i));
      if (end < 0) { s.mode = 'quote'; s.quote = quote; } continue;
    }
    if (word(text.charCodeAt(i)) || text[i] === '-' || text[i] === ':') {
      i++;
      while (word(text.charCodeAt(i)) || digit(text.charCodeAt(i)) || '-:.'.includes(text[i] ?? '\0')) i++;
      const value = text.slice(start, i);
      emit(s.tagName ? 'tag' : 'attr', value);
      if (s.tagName) s.tag = value.toLowerCase();
      s.tagName = false; continue;
    }
    emit(text[i] === '=' ? 'operator' : 'plain', text[i++]);
  }
  return s;
}, ['htm', 'xml', 'svg']);
