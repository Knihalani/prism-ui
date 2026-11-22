import { defineLanguage } from '../core';
import { digit, space, word, wordEnd } from './shared';

interface State { quote: string; heredoc: string; pending: string; tabs: boolean; substitutions: string[] }
const keywords = new Set('if then else elif fi for while until do done case esac in function select time coproc'.split(' '));
const builtins = new Set('echo printf cd pwd export source alias unalias read set unset shift exit return local declare typeset readonly eval exec trap test true false command builtin type hash history jobs fg bg wait'.split(' '));
export const bash = defineLanguage('bash', (): State => ({ quote: '', heredoc: '', pending: '', tabs: false, substitutions: [] }), (text, previous, emit) => {
  const s = { ...previous, substitutions: [...previous.substitutions] };
  if (s.heredoc) {
    const line = text.endsWith('\n') ? text.slice(0, -1).replace(/\r$/, '') : text;
    const candidate = s.tabs ? line.replace(/^\t+/, '') : line;
    emit(candidate === s.heredoc ? 'meta' : 'string', text);
    if (candidate === s.heredoc) s.heredoc = '';
    return s;
  }
  let i = 0;
  while (i < text.length) {
    const start = i;
    if (s.quote === "'") {
      const end = text.indexOf("'", i);
      i = end < 0 ? text.length : end + 1;
      emit('string', text.slice(start, i)); if (end >= 0) s.quote = ''; continue;
    }
    if (s.quote === '"' && text[i] !== '$' && text[i] !== '`') {
      while (i < text.length && text[i] !== '$' && text[i] !== '`') {
        if (text[i] === '\\') { i = Math.min(text.length, i + 2); continue; }
        if (text[i++] === '"') { s.quote = ''; break; }
      }
      emit('string', text.slice(start, i)); continue;
    }
    const c = text.charCodeAt(i);
    if (c === 36) {
      if (text[i + 1] === '(') { emit('punctuation', '$('); i += 2; s.substitutions.push(s.quote); s.quote = ''; continue; }
      i++;
      if (text[i] === '{') { i++; while (i < text.length && text[i] !== '}') i++; if (text[i] === '}') i++; }
      else if (word(text.charCodeAt(i)) || digit(text.charCodeAt(i))) i = wordEnd(text, i);
      else if (i < text.length && '?@*#$!-'.includes(text[i])) i++;
      emit('variable', text.slice(start, i)); continue;
    }
    if (c === 96) {
      const end = text.indexOf('`', i + 1); i = end < 0 ? text.length : end + 1;
      emit('string', text.slice(start, i)); continue;
    }
    if (c === 39 || c === 34) { s.quote = text[i++]; emit('string', text.slice(start, i)); continue; }
    if (space(c)) { while (space(text.charCodeAt(i))) i++; emit('plain', text.slice(start, i)); continue; }
    if (c === 35 && (i === 0 || space(text.charCodeAt(i - 1)) || ';|&('.includes(text[i - 1]))) { emit(i === 0 && text[i + 1] === '!' ? 'meta' : 'comment', text.slice(i)); break; }
    if (text.startsWith('<<', i)) {
      i += 2; s.tabs = text[i] === '-'; if (s.tabs) i++;
      emit('operator', text.slice(start, i));
      const white = i; while (text[i] === ' ' || text[i] === '\t') i++; emit('plain', text.slice(white, i));
      const begin = i; const quote = text[i] === "'" || text[i] === '"' ? text[i++] : '';
      const wordStart = i;
      while (i < text.length && (quote ? text[i] !== quote : !space(text.charCodeAt(i)) && !';|&<>'.includes(text[i]))) i++;
      s.pending = text.slice(wordStart, i); if (quote && text[i] === quote) i++;
      emit('meta', text.slice(begin, i)); continue;
    }
    if (c === 41 && s.substitutions.length) { s.quote = s.substitutions.pop()!; emit('punctuation', text[i++]); continue; }
    if (c === 40 && s.substitutions.length) { s.substitutions.push(''); emit('punctuation', text[i++]); continue; }
    if (digit(c)) { while (digit(text.charCodeAt(i)) || text[i] === '.') i++; emit('number', text.slice(start, i)); continue; }
    if (word(c) || c === 45 || c === 47 || c === 46) {
      i++;
      while (i < text.length && !space(text.charCodeAt(i)) && !'\'"$`(){};|&<>='.includes(text[i])) i++;
      const value = text.slice(start, i);
      emit(keywords.has(value) ? 'keyword' : builtins.has(value) ? 'builtin' : text[i] === '=' ? 'variable' : 'plain', value); continue;
    }
    if (c === 92 && i + 1 < text.length) { emit('plain', text.slice(i, i + 2)); i += 2; continue; }
    emit('(){};'.includes(text[i]) ? 'punctuation' : 'operator', text[i++]);
  }
  if (s.pending && text.endsWith('\n')) { s.heredoc = s.pending; s.pending = ''; }
  return s;
}, ['sh', 'shell', 'zsh', 'console']);
