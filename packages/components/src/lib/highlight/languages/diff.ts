import { defineLanguage } from '../core';
export const diff = defineLanguage('diff', () => null, (line, state, emit) => {
  emit(line.startsWith('@@') ? 'meta' : line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ') ? 'meta' : line[0] === '+' ? 'inserted' : line[0] === '-' ? 'deleted' : 'plain', line);
  return state;
}, ['patch']);
