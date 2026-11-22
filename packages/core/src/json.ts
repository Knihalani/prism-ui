import type { Value } from './ast';

type Frame = { value: Value[] | Record<string, Value>; array: boolean; key: string; phase: 'key' | 'colon' | 'value' | 'comma' };
const forbidden = (s: string) => s === '__proto__' || s === 'constructor' || s === 'prototype';

/** Resumable, non-executing JSON/relaxed-JSON reader. Open values are live views. */
export class JsonScanner {
  value: Value | undefined;
  private stack: Frame[] = [];
  private token = '';
  private mode: 'idle' | 'string' | 'word' = 'idle';
  private quote = '';
  private escape = false;
  private unicode = '';
  private key = false;
  private target: { frame?: Frame; index?: number; key?: string } = {};

  private attach(value: Value, fresh: boolean) {
    if (fresh) {
      const frame = this.stack[this.stack.length - 1];
      this.target = { frame };
      if (frame?.array) this.target.index = (frame.value as Value[]).length;
      else if (frame) this.target.key = frame.key;
      if (frame) frame.phase = 'comma';
    }
    const { frame, index, key } = this.target;
    if (!frame) this.value = value;
    else if (frame.array) (frame.value as Value[])[index!] = value;
    else if (key && !forbidden(key)) (frame.value as Record<string, Value>)[key] = value;
  }

  private scalar() {
    const t = this.token;
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (t === 'null') return null;
    if (t.length && /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(t)) return Number(t);
    return t;
  }

  push(source: string) {
    for (let i = 0; i < source.length; i++) {
      const c = source[i]; const code = source.charCodeAt(i);
      if (this.mode === 'string') {
        if (this.unicode) {
          this.unicode += c;
          if (this.unicode.length === 5) { this.token += /^[\da-f]{4}$/i.test(this.unicode.slice(1)) ? String.fromCharCode(parseInt(this.unicode.slice(1), 16)) : this.unicode; this.unicode = ''; }
        } else if (this.escape) {
          this.escape = false;
          if (c === 'u') this.unicode = 'u';
          else this.token += c === 'n' ? '\n' : c === 'r' ? '\r' : c === 't' ? '\t' : c === 'b' ? '\b' : c === 'f' ? '\f' : c;
        } else if (c === '\\') this.escape = true;
        else if (c === this.quote) {
          if (this.key) { const frame = this.stack[this.stack.length - 1]; frame.key = this.token; frame.phase = 'colon'; }
          else this.attach(this.token, false);
          this.mode = 'idle'; this.token = '';
        } else this.token += c;
        continue;
      }
      if (this.mode === 'word') {
        if (code > 32 && c !== ',' && c !== ']' && c !== '}' && !(this.key && c === ':')) { this.token += c; continue; }
        if (this.key) { const frame = this.stack[this.stack.length - 1]; frame.key = this.token; frame.phase = 'colon'; }
        else this.attach(this.scalar(), false);
        this.mode = 'idle'; this.token = ''; i--; continue;
      }
      if (code <= 32) continue;
      const frame = this.stack[this.stack.length - 1];
      if (c === '}' || c === ']') { this.stack.pop(); continue; }
      if (c === ',') { if (frame) frame.phase = frame.array ? 'value' : 'key'; continue; }
      if (c === ':') { if (frame) frame.phase = 'value'; continue; }
      this.key = !!frame && !frame.array && (frame.phase === 'key' || frame.phase === 'colon');
      if (c === '{' || c === '[') {
        const array = c === '['; const value = array ? [] : {};
        this.attach(value, true);
        this.stack.push({ value, array, key: '', phase: array ? 'value' : 'key' });
      } else {
        this.token = '';
        this.mode = c === '"' || c === "'" ? 'string' : 'word'; this.quote = c;
        if (this.mode === 'word') this.token = c;
        if (!this.key) this.attach('', true);
      }
    }
    // Publish only the scalar currently being extended. No ancestor arrays are copied.
    if (!this.key && this.mode === 'string') this.attach(this.token, false);
    else if (!this.key && this.mode === 'word' && this.token.length < 64) this.attach(this.scalar(), false);
  }

  end() { if (this.mode === 'word' && !this.key) this.attach(this.scalar(), false); return this.value; }
}
