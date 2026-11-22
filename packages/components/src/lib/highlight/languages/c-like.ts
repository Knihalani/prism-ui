import { defineRangeLanguage, type TokenType } from '../core';
import { digit, emitRange, numberEnd, quotedEnd, space, spaces, word, wordEnd, wordLookup } from './shared';

interface Frame { depth: number; mode: string; closing?: boolean; tagName?: boolean }
interface State {
  mode: string; quote: string; raw: boolean; returnMode: string; frames: Frame[];
  expression: boolean; property: boolean; commentDepth: number;
  jsxDepth: number; closing: boolean; tagName: boolean;
  jsxContexts: number[];
}
export interface CLikeOptions {
  name: string; aliases?: string[]; keywords: string; builtins?: string; types?: string;
  flavor: 'js' | 'go' | 'rust'; jsx?: boolean;
}
export function cLike(options: CLikeOptions) {
  const lookup = wordLookup([['builtin', options.builtins ?? ''], ['type', options.types ?? ''], ['constant', 'true false null undefined nil'], ['keyword', options.keywords]]);
  const rust = options.flavor === 'rust';
  const js = options.flavor === 'js';
  return defineRangeLanguage(options.name, (): State => ({ mode: 'code', quote: '', raw: false, returnMode: 'code', frames: [], expression: true, property: false, commentDepth: 0, jsxDepth: 0, closing: false, tagName: false, jsxContexts: [] }), (text, previous, emit) => {
    const s: State = { mode: previous.mode, quote: previous.quote, raw: previous.raw, returnMode: previous.returnMode, frames: previous.frames.map(frame => ({ ...frame })), expression: previous.expression, property: previous.property, commentDepth: previous.commentDepth, jsxDepth: previous.jsxDepth, closing: previous.closing, tagName: previous.tagName, jsxContexts: [...previous.jsxContexts] };
    const n = text.length;
    let i = 0;
    while (i < n) {
      const start = i;
      if (s.mode === 'comment') {
        while (i < n) {
          const c = text.charCodeAt(i);
          if (rust && c === 47 && text.charCodeAt(i + 1) === 42) { s.commentDepth++; i += 2; }
          else if (c === 42 && text.charCodeAt(i + 1) === 47) { i += 2; if (--s.commentDepth === 0) { s.mode = 'code'; break; } }
          else i++;
        }
        emit('comment', start, i); continue;
      }
      if (s.mode === 'quote') {
        const end = s.raw ? text.indexOf(s.quote, i) : quotedEnd(text, i, s.quote);
        const finish = end < 0 ? n : s.raw ? end + s.quote.length : end;
        i = emitRange(emit, 'string', text, start, finish);
        if (end >= 0) { s.mode = s.returnMode; s.expression = false; }
        continue;
      }
      if (s.mode === 'template') {
        while (i < n) {
          const c = text.charCodeAt(i);
          if (c === 92) { i = Math.min(n, i + 2); continue; }
          if (c === 96) { i++; s.mode = 'code'; s.expression = false; break; }
          if (c === 36 && text.charCodeAt(i + 1) === 123) break;
          i++;
        }
        emit('string', start, i);
        if (s.mode === 'template' && text.startsWith('${', i)) { emit('punctuation', i, i + 2); i += 2; s.frames.push({ depth: 1, mode: 'template' }); s.mode = 'code'; s.expression = true; }
        continue;
      }
      if (s.mode === 'jsxText') {
        if (text[i] === '<') { s.mode = 'jsxTag'; s.closing = text[i + 1] === '/'; s.tagName = true; i = emitRange(emit, 'punctuation', text, i, i + (s.closing ? 2 : 1)); continue; }
        if (text[i] === '{') { emit('punctuation', i, i + 1); i++; s.frames.push({ depth: 1, mode: 'jsxText' }); s.mode = 'code'; s.expression = true; continue; }
        while (i < n && text[i] !== '<' && text[i] !== '{') i++;
        emit('plain', start, i); continue;
      }
      if (s.mode === 'jsxTag') {
        if (space(text.charCodeAt(i))) { while (space(text.charCodeAt(i))) i++; emit('plain', start, i); continue; }
        if (text[i] === '>' || text.startsWith('/>', i)) {
          const self = text[i] === '/';
          i = emitRange(emit, 'punctuation', text, i, i + (self ? 2 : 1));
          s.jsxDepth += s.closing ? -1 : self ? 0 : 1;
          s.mode = 'jsxText';
          if (s.jsxDepth === s.jsxContexts[s.jsxContexts.length - 1]) { s.jsxContexts.pop(); s.mode = 'code'; }
          s.expression = false; continue;
        }
        if (text[i] === '{') { emit('punctuation', i, i + 1); i++; s.frames.push({ depth: 1, mode: 'jsxTag', closing: s.closing, tagName: s.tagName }); s.mode = 'code'; s.expression = true; continue; }
        if (text[i] === '"' || text[i] === "'") {
          const quote = text[i++]; const end = quotedEnd(text, i, quote);
          i = emitRange(emit, 'string', text, start, end < 0 ? n : end);
          if (end < 0) { s.mode = 'quote'; s.quote = quote; s.raw = false; s.returnMode = 'jsxTag'; }
          continue;
        }
        if (word(text.charCodeAt(i))) {
          i++;
          while (word(text.charCodeAt(i)) || digit(text.charCodeAt(i)) || text[i] === '-' || text[i] === ':' || text[i] === '.') i++;
          emit(s.tagName ? 'tag' : 'attr', start, i); s.tagName = false; continue;
        }
        i = emitRange(emit, 'operator', text, i, i + 1); continue;
      }
      const c = text.charCodeAt(i);
      if (space(c)) { while (space(text.charCodeAt(i))) i++; emit('plain', start, i); continue; }
      if (c === 47) {
        if (text.charCodeAt(i + 1) === 47) { emit('comment', i, n); break; }
        if (text.charCodeAt(i + 1) === 42) { emit('comment', i, i + 2); i += 2; s.mode = 'comment'; s.commentDepth = 1; continue; }
      }
      if (js && c === 35 && i === 0 && text.charCodeAt(i + 1) === 33) { emit('meta', 0, n); break; }
      if (rust && (c === 114 || c === 98 && text[i + 1] === 'r')) {
        let j = i + (c === 98 ? 2 : 1);
        while (text[j] === '#') j++;
        if (text[j] === '"') {
          const delimiter = '"' + '#'.repeat(j - i - (c === 98 ? 2 : 1));
          const end = text.indexOf(delimiter, j + 1);
          i = emitRange(emit, 'string', text, start, end < 0 ? n : end + delimiter.length);
          if (end < 0) { s.mode = 'quote'; s.quote = delimiter; s.raw = true; s.returnMode = 'code'; }
          s.expression = false; continue;
        }
      }
      if (rust && c === 39 && word(text.charCodeAt(i + 1))) {
        const end = wordEnd(text, i + 1);
        if (text[end] !== "'") { i = emitRange(emit, 'type', text, i, end); continue; }
      }
      if (c === 34 || c === 39 || c === 96 && !rust) {
        const quote = text[i++];
        if (quote === '`' && js) { emit('string', start, i); s.mode = 'template'; continue; }
        const end = quote === '`' ? text.indexOf('`', i) : quotedEnd(text, i, quote);
        i = emitRange(emit, 'string', text, start, end < 0 ? n : quote === '`' ? end + 1 : end);
        if (end < 0) { s.mode = 'quote'; s.quote = quote; s.raw = quote === '`'; s.returnMode = 'code'; }
        s.expression = false; continue;
      }
      if (c === 47 && js && s.expression && text[i + 1] !== '=') {
        let j = i + 1; let bracket = false; let closed = false;
        while (j < n && text[j] !== '\n') {
          if (text[j] === '\\') { j += 2; continue; }
          if (text[j] === '[') bracket = true;
          else if (text[j] === ']') bracket = false;
          else if (text[j] === '/' && !bracket) { j++; closed = true; break; }
          j++;
        }
        if (closed) { while (word(text.charCodeAt(j))) j++; i = emitRange(emit, 'regex', text, i, j); s.expression = false; continue; }
      }
      if (digit(c) || c === 46 && digit(text.charCodeAt(i + 1))) { i = emitRange(emit, 'number', text, i, numberEnd(text, i)); s.expression = false; continue; }
      if (word(c)) {
        i = wordEnd(text, i);
        let type: TokenType | undefined = lookup(text, start, i);
        if (type !== 'keyword' && type !== 'constant' && c >= 65 && c <= 90) type = 'type';
        if (!type) type = text[spaces(text, i)] === '(' || rust && text[i] === '!' ? 'function' : s.property || text[spaces(text, i)] === ':' ? 'property' : 'variable';
        emit(type, start, i);
        s.expression = type === 'keyword' && !(i - start === 4 && text.startsWith('this', start)) && !(i - start === 5 && text.startsWith('super', start)); s.property = false; continue;
      }
      if (options.jsx && c === 60 && s.expression && (word(text.charCodeAt(i + 1)) || text[i + 1] === '>')) {
        emit('punctuation', i, i + 1); i++; s.jsxContexts.push(s.jsxDepth); s.mode = 'jsxTag'; s.closing = false; s.tagName = true; continue;
      }
      if (c === 123) { const frame = s.frames[s.frames.length - 1]; if (frame) frame.depth++; }
      if (c === 125) {
        const frame = s.frames[s.frames.length - 1];
        if (frame && --frame.depth === 0) {
          s.frames.pop(); s.mode = frame.mode;
          if (frame.mode === 'jsxTag') { s.closing = frame.closing!; s.tagName = frame.tagName!; }
        }
      }
      const punctuation = c === 123 || c === 125 || c === 40 || c === 41 || c === 91 || c === 93 || c === 59 || c === 44 || c === 46;
      i = emitRange(emit, punctuation ? 'punctuation' : 'operator', text, i, i + 1);
      s.property = c === 46;
      s.expression = c !== 41 && c !== 93 && c !== 125 && c !== 46;
    }
    return s;
  }, options.aliases);
}
