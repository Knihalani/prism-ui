import type { Value } from './ast';

export function relaxed(source: string): Value | undefined {
  let i = 0;
  const ws = () => { while (/\s/.test(source[i] ?? '') && i < source.length) i++; };
  function read(): Value | undefined {
    ws(); const c = source[i++];
    if (c === '"' || c === "'") {
      let s = '';
      while (i < source.length) {
        const ch = source[i++]; if (ch === c) break;
        if (ch === '\\') {
          const e = source[i++];
          if (e === 'u' && /^[\da-f]{4}$/i.test(source.slice(i, i + 4))) { s += String.fromCharCode(parseInt(source.slice(i, i + 4), 16)); i += 4; }
          else s += ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' } as Record<string, string>)[e] ?? e ?? '';
        } else s += ch;
      }
      return s;
    }
    if (c === '[' || c === '{') {
      const array: Value[] = []; const object: Record<string, Value> = {};
      while (i < source.length) {
        ws(); if (source[i] === ']' || source[i] === '}') { i++; break; }
        const before = i;
        if (c === '[') { const v = read(); if (v !== undefined) array.push(v); }
        else {
          let key: string;
          if (source[i] === '"' || source[i] === "'") key = String(read());
          else { const start = i; while (i < source.length && /[\w$-]/.test(source[i])) i++; key = source.slice(start, i); }
          ws(); if (source[i] !== ':') break; i++;
          const v = read(); if (v !== undefined && key !== '__proto__' && key !== 'constructor' && key !== 'prototype') object[key] = v;
        }
        ws(); if (source[i] === ',') i++;
        if (i === before) break;
      }
      return c === '[' ? array : object;
    }
    if (!c) return undefined;
    const start = i - 1; while (i < source.length && !/[\s,\]}]/.test(source[i])) i++;
    const token = source.slice(start, i);
    if (token === 'true') return true; if (token === 'false') return false; if (token === 'null') return null;
    if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(token)) return Number(token);
    return token;
  }
  return read();
}

export function attributes(source: string): Record<string, Value> {
  const result: Record<string, Value> = {}; let i = 0;
  while (i < source.length) {
    while (/[\s{}]/.test(source[i] ?? '') && i < source.length) i++;
    const start = i; while (i < source.length && /[\w-]/.test(source[i])) i++;
    const key = source.slice(start, i); if (!key) break;
    while (source[i] === ' ') i++;
    let value: Value = true;
    if (source[i] === '=') {
      i++; while (source[i] === ' ') i++;
      const begin = i; let quote = ''; const stack: string[] = [];
      while (i < source.length) {
        const c = source[i];
        if (quote) { if (c === '\\') { i += 2; continue; } if (c === quote) quote = ''; }
        else if (c === '"' || c === "'") quote = c;
        else if (c === '[' || c === '{') stack.push(c);
        else if (c === ']' || c === '}') { if (!stack.length) break; stack.pop(); }
        else if (/\s/.test(c) && !stack.length) break;
        i++;
      }
      value = relaxed(source.slice(begin, i)) ?? '';
    }
    if (!['__proto__', 'constructor', 'prototype'].includes(key)) result[key] = value;
  }
  return result;
}

export function safeUrl(url: string, image = false): string {
  const normalized = url.replace(/&#(?:x([\da-f]+)|(\d+));?/gi, (_, h, d) => String.fromCharCode(parseInt(h ?? d, h ? 16 : 10))).replace(/&colon;/gi, ':').replace(/[\u0000-\u0020\u007f]/g, '');
  if (/^(?:javascript|vbscript|file):/i.test(normalized)) return '';
  if (/^data:/i.test(normalized) && !(image && /^data:image\/(?:png|gif|jpeg|webp);base64,/i.test(normalized))) return '';
  return normalized;
}
