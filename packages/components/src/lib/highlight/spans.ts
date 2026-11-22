import type { Emit, TokenType } from './core';

const ids: Record<TokenType, number> = {
  plain: 0, keyword: 1, string: 2, number: 3, comment: 4, function: 5,
  type: 6, operator: 7, punctuation: 8, variable: 9, constant: 10,
  property: 11, tag: 12, attr: 13, regex: 14, builtin: 15, deleted: 16, inserted: 17, meta: 18,
};
const names: TokenType[] = ['plain', 'keyword', 'string', 'number', 'comment', 'function', 'type', 'operator', 'punctuation', 'variable', 'constant', 'property', 'tag', 'attr', 'regex', 'builtin', 'deleted', 'inserted', 'meta'];
const tags = ['', '<span class="prism-tok-keyword">', '<span class="prism-tok-string">', '<span class="prism-tok-number">', '<span class="prism-tok-comment">', '<span class="prism-tok-function">', '<span class="prism-tok-type">', '<span class="prism-tok-operator">', '<span class="prism-tok-punctuation">', '<span class="prism-tok-variable">', '<span class="prism-tok-constant">', '<span class="prism-tok-property">', '<span class="prism-tok-tag">', '<span class="prism-tok-attr">', '<span class="prism-tok-regex">', '<span class="prism-tok-builtin">', '<span class="prism-tok-deleted">', '<span class="prism-tok-inserted">', '<span class="prism-tok-meta">'];
function asciiBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes;
}
const tagBytes = /* @__PURE__ */ tags.map(asciiBytes);
const transitionBytes = /* @__PURE__ */ tags.map(tag => asciiBytes('</span>' + tag));
const closeBytes = /* @__PURE__ */ asciiBytes('</span>');
const ampBytes = /* @__PURE__ */ asciiBytes('&amp;');
const ltBytes = /* @__PURE__ */ asciiBytes('&lt;');
const gtBytes = /* @__PURE__ */ asciiBytes('&gt;');
const quotBytes = /* @__PURE__ */ asciiBytes('&quot;');
const apostropheBytes = /* @__PURE__ */ asciiBytes('&#39;');

export class ASCIIHTML {
  private data = new Uint8Array(4096);
  private length = 0;
  private decoder = new TextDecoder('ascii');
  reset() { this.length = 0; }
  private reserve(extra: number) {
    const required = this.length + extra;
    if (required <= this.data.length) return;
    const grown = new Uint8Array(Math.max(this.data.length * 2, required));
    grown.set(this.data.subarray(0, this.length)); this.data = grown;
  }
  append(text: string, spans: Uint32Array, length: number) {
    this.reserve(text.length * 6 + length * 24);
    const data = this.data;
    let position = this.length;
    let start = 0;
    let previous = 0;
    const escaped = /[&<>"']/.test(text);
    for (let i = 0; i < length; i += 2) {
      const end = spans[i];
      const id = spans[i + 1];
      if (previous || id) {
        const tag = previous ? transitionBytes[id] : tagBytes[id];
        data.set(tag, position); position += tag.length;
      }
      if (!escaped) {
        for (let j = start; j < end; j++) data[position++] = text.charCodeAt(j);
      } else {
        for (let j = start; j < end; j++) {
          const c = text.charCodeAt(j);
          let entity: Uint8Array | undefined;
          switch (c) {
            case 38: entity = ampBytes; break;
            case 60: entity = ltBytes; break;
            case 62: entity = gtBytes; break;
            case 34: entity = quotBytes; break;
            case 39: entity = apostropheBytes; break;
            default: data[position++] = c; continue;
          }
          data.set(entity, position); position += entity.length;
        }
      }
      previous = id;
      start = end;
    }
    if (previous) { data.set(closeBytes, position); position += closeBytes.length; }
    this.length = position;
  }
  finish(): string { return this.decoder.decode(this.data.subarray(0, this.length)); }
}

export class Spans {
  data = new Uint32Array(256);
  length = 0;
  private offset = 0;
  reset() { this.length = 0; this.offset = 0; }
  readonly emit: Emit = (type, text) => {
    if (!text.length) return;
    this.emitRange(type, this.offset, this.offset + text.length);
  };
  readonly emitRange = (type: TokenType, start: number, end: number) => {
    if (end <= start) return;
    const id = ids[type];
    this.offset = end;
    if (this.length && this.data[this.length - 1] === id) { this.data[this.length - 2] = end; return; }
    if (this.length === this.data.length) {
      const grown = new Uint32Array(this.data.length * 2);
      grown.set(this.data); this.data = grown;
    }
    this.data[this.length++] = end;
    this.data[this.length++] = id;
  };
}
function nextEscape(text: string, start: number): number {
  for (let i = start; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 38 || c === 60 || c === 62 || c === 34 || c === 39) return i;
  }
  return text.length;
}
export function appendHTML(text: string, spans: Uint32Array, length: number, parts: string[]): void {
  const first = text.search(/[&<>"']/);
  let html = '';
  if (first < 0) {
    let start = 0;
    for (let i = 0; i < length; i += 2) {
      const end = spans[i];
      const id = spans[i + 1];
      const value = text.slice(start, end);
      html += id ? tags[id] + value + '</span>' : value;
      start = end;
    }
    parts.push(html);
    return;
  }
  let escape = first;
  let start = 0;
  for (let i = 0; i < length; i += 2) {
    const end = spans[i];
    const id = spans[i + 1];
    if (id) html += tags[id];
    while (escape < end) {
      const c = text.charCodeAt(escape);
      html += text.slice(start, escape) + (c === 38 ? '&amp;' : c === 60 ? '&lt;' : c === 62 ? '&gt;' : c === 34 ? '&quot;' : '&#39;');
      start = escape + 1;
      escape = nextEscape(text, start);
    }
    html += text.slice(start, end);
    if (id) html += '</span>';
    start = end;
  }
  parts.push(html);
}
export function appendTokens(text: string, spans: Uint32Array, length: number, emit: Emit): void {
  let start = 0;
  for (let i = 0; i < length; i += 2) {
    const end = spans[i];
    emit(names[spans[i + 1]], text.slice(start, end));
    start = end;
  }
}
