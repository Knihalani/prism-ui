import type { Node } from './ast';
import { attributes, safeUrl } from './values';
import { Precedence } from './precedence';

export function inline(text: string, path: string, resolve?: (node: Node) => void): Node[] {
  const out: Node[] = []; let i = 0; let buffer = '';
  let precedence: Precedence | undefined;
  const boundaries = () => precedence ??= new Precedence(text);
  const add = (node: Omit<Node, 'key'>) => { flush(); const n = node as Node; n.key = `${path}.${out.length}`; if (resolve && (n.type === 'reference' || n.type === 'imageReference')) resolve(n); out.push(n); };
  const flush = () => { if (buffer) { out.push({ type: 'text', value: buffer, key: `${path}.${out.length}` }); buffer = ''; } };
  const childPath = () => `${path}.${out.length + (buffer ? 1 : 0)}`;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\' && i + 1 < text.length && /[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~\n]/.test(text[i + 1])) {
      if (text[i + 1] === '\n') add({ type: 'break' }); else buffer += text[i + 1]; i += 2; continue;
    }
    if (c === '\n') {
      if (buffer.endsWith('  ')) { buffer = buffer.trimEnd(); add({ type: 'break' }); } else buffer += '\n'; i++; continue;
    }
    if (c === '`') {
      const span = boundaries().codeAt(i);
      if (span.close < 0) { buffer += '`'.repeat(span.length); i += span.length; continue; }
      const value = text.slice(i + span.length, span.close).replace(/\n/g, ' ');
      add({ type: 'inlineCode', value: /^ .* $/.test(value) && /[^ ]/.test(value) ? value.slice(1, -1) : value }); i = span.close + span.length; continue;
    }
    if (c === ':' && /[a-zA-Z]/.test(text[i + 1] ?? '')) {
      const m = /^:([\w-]+)\[([^\]]*)\]/.exec(text.slice(i));
      if (m) {
        let end = i + m[0].length; let attrs = '';
        if (text[end] === '{') {
          const begin = end++; let depth = 1; let quote = '';
          while (end < text.length && depth) {
            const ch = text[end++];
            if (quote) { if (ch === '\\') end++; else if (ch === quote) quote = ''; }
            else if (ch === '"' || ch === "'") quote = ch;
            else if (ch === '{') depth++;
            else if (ch === '}') depth--;
          }
          attrs = text.slice(begin + 1, depth ? end : end - 1);
        }
        add({ type: 'component', name: m[1], props: attributes(attrs), complete: true, children: inline(m[2], childPath(), resolve) }); i = end; continue;
      }
    }
    if (c === '[' || (c === '!' && text[i + 1] === '[')) {
      const image = c === '!'; const begin = i + (image ? 2 : 1); const link = boundaries().linkAt(begin - 1);
      if (link) {
        const { labelEnd, targetEnd, end } = link;
        if (targetEnd !== undefined) {
          const target = text.slice(labelEnd + 2, targetEnd).trim(); const m = /^(<?.*?>?)(?:\s+["'](.*)["'])$/.exec(target);
          const url = (m?.[1] ?? target).replace(/^<|>$/g, '');
          add({ type: image ? 'image' : 'link', url: safeUrl(url, image), title: m?.[2], value: image ? text.slice(begin, labelEnd) : undefined, children: image ? undefined : inline(text.slice(begin, labelEnd), childPath(), resolve) }); i = end; continue;
        }
        const label = link.referenceStart === undefined ? text.slice(begin, labelEnd) : text.slice(link.referenceStart, end - 1) || text.slice(begin, labelEnd);
        add({ type: image ? 'imageReference' : 'reference', name: normalizeLabel(label), value: text.slice(i, end), children: inline(text.slice(begin, labelEnd), childPath(), resolve) }); i = end; continue;
      }
    }
    if (c === '<') {
      const end = boundaries().autolinkEnd(i); const url = text.slice(i + 1, end);
      if (end >= 0) {
        add({ type: 'link', url: safeUrl(url.includes(':') ? url : `mailto:${url}`), children: [{ type: 'text', key: `${childPath()}.0`, value: url }] }); i = end + 1; continue;
      }
    }
    if ((c === 'h' && /^(https?:\/\/)/.test(text.slice(i, i + 8))) && (i === 0 || /\s/.test(text[i - 1]))) {
      const m = /^https?:\/\/[^\s<>]+/.exec(text.slice(i));
      if (m) { const url = m[0].replace(/[.,!?;:]+$/, ''); add({ type: 'link', url: safeUrl(url), children: [{ type: 'text', value: url, key: `${childPath()}.0` }] }); i += url.length; continue; }
    }
    if (c === '*' || c === '_' || (c === '~' && text[i + 1] === '~')) {
      if (c === '_' && /\w/.test(text[i - 1] ?? '') && /\w/.test(text[i + 1] ?? '')) { buffer += c; i++; continue; }
      const n = text[i + 1] === c ? 2 : 1; const delimiter = c.repeat(n);
      if (!/\s/.test(text[i + n] ?? ' ') ) {
        const end = boundaries().find(delimiter, i + n);
        if (end < 0 && n === 1) { buffer += delimiter; i += n; continue; }
        add({ type: c === '~' ? 'delete' : n === 2 ? 'strong' : 'emphasis', children: inline(text.slice(i + n, end < 0 ? undefined : end), childPath(), resolve) }); i = end < 0 ? text.length : end + n; continue;
      }
    }
    const begin = i++;
    while (i < text.length) { const code = text.charCodeAt(i); if (code === 42 || code === 95 || code === 126 || code === 96 || code === 91 || code === 33 || code === 60 || code === 92 || code === 10 || code === 58 || code === 104) break; i++; }
    buffer += text.slice(begin, i);
  }
  flush(); return out;
}
export function normalizeLabel(label: string) { return label.trim().replace(/\s+/g, ' ').toLowerCase(); }
