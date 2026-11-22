import type { Node } from './ast';
import { attributes, safeUrl } from './values';

export function inline(text: string, path: string): Node[] {
  const out: Node[] = []; let i = 0; let buffer = '';
  const add = (node: Omit<Node, 'key'>) => { flush(); out.push({ ...node, key: `${path}.${out.length}` }); };
  const flush = () => { if (buffer) { out.push({ type: 'text', value: buffer, key: `${path}.${out.length}` }); buffer = ''; } };
  while (i < text.length) {
    const c = text[i];
    if (c === '\\' && i + 1 < text.length && /[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~\n]/.test(text[i + 1])) {
      if (text[i + 1] === '\n') add({ type: 'break' }); else buffer += text[i + 1]; i += 2; continue;
    }
    if (c === '\n') {
      if (buffer.endsWith('  ')) { buffer = buffer.trimEnd(); add({ type: 'break' }); } else buffer += '\n'; i++; continue;
    }
    if (c === '`') {
      let n = 1; while (text[i + n] === '`') n++;
      const end = text.indexOf('`'.repeat(n), i + n);
      const value = text.slice(i + n, end < 0 ? undefined : end).replace(/\n/g, ' ');
      add({ type: 'inlineCode', value: /^ .* $/.test(value) && /[^ ]/.test(value) ? value.slice(1, -1) : value }); i = end < 0 ? text.length : end + n; continue;
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
        add({ type: 'component', name: m[1], props: attributes(attrs), complete: true, children: inline(m[2], `${path}.${out.length}`) }); i = end; continue;
      }
    }
    if (c === '[' || (c === '!' && text[i + 1] === '[')) {
      const image = c === '!'; const begin = i + (image ? 2 : 1); const close = text.indexOf('](', begin);
      if (close >= 0) {
        let end = close + 2; let depth = 1; let quote = '';
        for (; end < text.length; end++) { const ch = text[end]; if (ch === '\\') { end++; continue; } if (quote) { if (ch === quote) quote = ''; } else if (ch === '"' || ch === "'") quote = ch; else if (ch === '(') depth++; else if (ch === ')' && --depth === 0) break; }
        if (!depth) {
          const target = text.slice(close + 2, end).trim(); const m = /^(<?.*?>?)(?:\s+["'](.*)["'])$/.exec(target);
          const url = (m?.[1] ?? target).replace(/^<|>$/g, '');
          add({ type: image ? 'image' : 'link', url: safeUrl(url, image), title: m?.[2], value: image ? text.slice(begin, close) : undefined, children: image ? undefined : inline(text.slice(begin, close), `${path}.${out.length}`) }); i = end + 1; continue;
        }
      }
    }
    if (c === '<') {
      const end = text.indexOf('>', i + 1); const url = text.slice(i + 1, end);
      if (end >= 0 && (/^(?:https?:\/\/|mailto:)[^\s<>]+$/i.test(url) || /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(url))) {
        add({ type: 'link', url: safeUrl(url.includes(':') ? url : `mailto:${url}`), children: [{ type: 'text', key: `${path}.${out.length}.0`, value: url }] }); i = end + 1; continue;
      }
    }
    if ((c === 'h' && /^(https?:\/\/)/.test(text.slice(i, i + 8))) && (i === 0 || /\s/.test(text[i - 1]))) {
      const m = /^https?:\/\/[^\s<>]+/.exec(text.slice(i));
      if (m) { const url = m[0].replace(/[.,!?;:]+$/, ''); add({ type: 'link', url: safeUrl(url), children: [{ type: 'text', value: url, key: `${path}.${out.length}.0` }] }); i += url.length; continue; }
    }
    if (c === '*' || c === '_' || (c === '~' && text[i + 1] === '~')) {
      if (c === '_' && /\w/.test(text[i - 1] ?? '') && /\w/.test(text[i + 1] ?? '')) { buffer += c; i++; continue; }
      const n = text[i + 1] === c ? 2 : 1; const delimiter = c.repeat(n);
      if (!/\s/.test(text[i + n] ?? ' ') ) {
        const end = text.indexOf(delimiter, i + n);
        add({ type: c === '~' ? 'delete' : n === 2 ? 'strong' : 'emphasis', children: inline(text.slice(i + n, end < 0 ? undefined : end), `${path}.${out.length}`) }); i = end < 0 ? text.length : end + n; continue;
      }
    }
    buffer += c; i++;
  }
  flush(); return out;
}
