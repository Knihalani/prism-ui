import { defineLanguage } from '../core';
import { digit, numberEnd, quotedEnd, space, spaces, word, wordEnd } from './shared';

interface State { quote: string; comment: boolean; dollar: boolean }
const keywords = new Set('SELECT FROM WHERE AS AND OR NOT NULL IS IN LIKE ILIKE BETWEEN EXISTS JOIN INNER LEFT RIGHT FULL OUTER CROSS ON USING GROUP BY ORDER HAVING LIMIT OFFSET FETCH UNION ALL DISTINCT INSERT INTO VALUES UPDATE SET DELETE CREATE ALTER DROP TABLE VIEW INDEX DATABASE SCHEMA PRIMARY FOREIGN KEY REFERENCES UNIQUE DEFAULT CHECK CONSTRAINT IF CASE WHEN THEN ELSE END WITH RECURSIVE RETURNING ASC DESC NULLS FIRST LAST BEGIN COMMIT ROLLBACK TRANSACTION EXPLAIN ANALYZE OVER PARTITION ROWS RANGE CURRENT ROW PRECEDING FOLLOWING WINDOW FILTER DO CONFLICT NOTHING REPLACE TRUNCATE CASCADE GRANT REVOKE TRUE FALSE'.split(' '));
const builtins = new Set('COUNT SUM AVG MIN MAX COALESCE NULLIF CAST CONVERT CONCAT SUBSTRING LOWER UPPER TRIM LENGTH ROUND NOW DATE_TRUNC EXTRACT ROW_NUMBER RANK DENSE_RANK LAG LEAD JSON_EXTRACT'.split(' '));
const types = new Set('INT INTEGER BIGINT SMALLINT TINYINT NUMERIC DECIMAL FLOAT DOUBLE REAL BOOLEAN BOOL TEXT VARCHAR CHAR DATE TIME TIMESTAMP TIMESTAMPTZ INTERVAL JSON JSONB UUID SERIAL BYTEA BLOB'.split(' '));
export const sql = defineLanguage('sql', (): State => ({ quote: '', comment: false, dollar: false }), (text, previous, emit) => {
  const s = { ...previous };
  let i = 0;
  while (i < text.length) {
    const start = i;
    if (s.comment) { const end = text.indexOf('*/', i); i = end < 0 ? text.length : end + 2; emit('comment', text.slice(start, i)); s.comment = end < 0; continue; }
    if (s.quote) {
      const end = s.dollar ? text.indexOf(s.quote, i) : quotedEnd(text, i, s.quote, true);
      i = end < 0 ? text.length : s.dollar ? end + s.quote.length : end;
      emit('string', text.slice(start, i)); if (end >= 0) s.quote = ''; continue;
    }
    const c = text.charCodeAt(i);
    if (space(c)) { while (space(text.charCodeAt(i))) i++; emit('plain', text.slice(start, i)); continue; }
    if (text.startsWith('--', i) || c === 35) { emit('comment', text.slice(i)); break; }
    if (text.startsWith('/*', i)) { emit('comment', '/*'); i += 2; s.comment = true; continue; }
    if (c === 36) {
      let end = i + 1;
      while (word(text.charCodeAt(end)) && text[end] !== '$' || digit(text.charCodeAt(end))) end++;
      if (text[end] === '$') {
        const delimiter = text.slice(i, end + 1); const finish = text.indexOf(delimiter, end + 1);
        i = finish < 0 ? text.length : finish + delimiter.length; emit('string', text.slice(start, i));
        if (finish < 0) { s.quote = delimiter; s.dollar = true; } continue;
      }
    }
    if (c === 39 || c === 34 || c === 96) {
      const quote = text[i++]; const end = quotedEnd(text, i, quote, true);
      i = end < 0 ? text.length : end; emit(quote === "'" ? 'string' : 'property', text.slice(start, i));
      if (end < 0) { s.quote = quote; s.dollar = false; } continue;
    }
    if (digit(c) || c === 46 && digit(text.charCodeAt(i + 1))) { i = numberEnd(text, i); emit('number', text.slice(start, i)); continue; }
    if (word(c)) {
      i = wordEnd(text, i); const value = text.slice(start, i); const upper = value.toUpperCase();
      emit(keywords.has(upper) ? 'keyword' : types.has(upper) ? 'type' : builtins.has(upper) ? 'builtin' : text[spaces(text, i)] === '(' ? 'function' : 'variable', value); continue;
    }
    emit('(),.;[]'.includes(text[i]) ? 'punctuation' : 'operator', text[i++]);
  }
  return s;
}, ['postgres', 'mysql', 'sqlite']);
