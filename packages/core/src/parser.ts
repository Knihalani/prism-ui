import type { Node, Root } from './ast';
import { inline } from './inline';
import { attributes } from './values';
import { streamParser, parseDocument } from './stream';
import { JsonScanner } from './json';
import { Plugins, type InlineExtensions, type ParserOptions } from './plugins';

const fence = (s: string) => /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(s);
const directive = (s: string) => /^ {0,3}(:{2,})([\w-]+)(?:\{(.*)\})?\s*$/.exec(s);
const item = (s: string) => /^( *)([-+*]|\d+[.)])\s+(.*)$/.exec(s);
const thematic = (s: string) => /^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(s);
const cells = (s: string) => s.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(s => s.trim().replace(/\\\|/g, '|'));
const tableDelimiter = (s: string) => s.includes('-') && cells(s).every(c => /^:?-{3,}:?$/.test(c));
const starts = (s: string) => !!(fence(s) || directive(s) || item(s) || /^ {0,3}(?:#{1,6}\s|>)/.test(s) || thematic(s));

export function blocks(lines: string[], path = '', offset = 0, resolve?: (node: Node) => void, extensions?: InlineExtensions): Node[] {
  const result: Node[] = []; let i = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue; }
    const key = path ? `${path}.${result.length + offset}` : `${result.length + offset}`;
    const line = lines[i]; const f = fence(line); const d = directive(line); let node: Node;
    if (f) {
      const start = ++i; const close = new RegExp(`^ {0,3}${f[1][0]}{${f[1].length},}\\s*$`);
      while (i < lines.length && !close.test(lines[i])) i++;
      const complete = i < lines.length; const value = lines.slice(start, i).join('\n'); if (complete) i++;
      const info = f[2].trim(); const space = info.search(/\s/); const lang = space < 0 ? info : info.slice(0, space); const meta = space < 0 ? '' : info.slice(space).trim();
      if (lang.startsWith('ui:')) { const scanner = new JsonScanner(); scanner.push(value); const props = scanner.end(); node = { type: 'component', key, name: lang.slice(3), props: props && typeof props === 'object' && !Array.isArray(props) ? props : {}, children: [], complete }; }
      else node = { type: 'code', key, lang, meta, value, complete };
    } else if (d) {
      const start = ++i; let complete = d[1].length === 2;
      if (!complete) {
        const close = new RegExp(`^ {0,3}:{${d[1].length},}\\s*$`); let code = '';
        while (i < lines.length) {
          if (code) { if (new RegExp(`^ {0,3}${code[0]}{${code.length},}\\s*$`).test(lines[i])) code = ''; }
          else { const f = fence(lines[i]); if (f) code = f[1]; else if (close.test(lines[i])) break; }
          i++;
        }
        complete = i < lines.length;
      }
      node = { type: 'component', key, name: d[2], props: attributes(d[3] ?? ''), children: d[1].length === 2 ? [] : blocks(lines.slice(start, i), key, 0, resolve, extensions), complete };
      if (d[1].length > 2 && complete) i++;
    } else if (/^ {0,3}#{1,6}(?:\s|$)/.test(line)) {
      const m = /^ {0,3}(#{1,6})(?:\s+(.*)|$)/.exec(line)!; node = { type: 'heading', depth: m[1].length, key, children: inline((m[2] ?? '').replace(/\s+#+\s*$/, ''), key, resolve, extensions) }; i++;
    } else if (i + 1 < lines.length && /^ {0,3}(?:=+|-+)\s*$/.test(lines[i + 1]) && !item(line) && !thematic(line)) {
      node = { type: 'heading', key, depth: lines[i + 1].trim()[0] === '=' ? 1 : 2, children: inline(line, key, resolve, extensions) }; i += 2;
    } else if (thematic(line)) { node = { type: 'thematicBreak', key }; i++; }
    else if (/^ {0,3}>/.test(line)) {
      const body: string[] = []; while (i < lines.length && /^ {0,3}>/.test(lines[i])) body.push(lines[i++].replace(/^ {0,3}> ?/, ''));
      node = { type: 'blockquote', key, children: blocks(body, key, 0, resolve, extensions) };
    } else if (item(line)) {
      const first = item(line)!; const indent = first[1].length; const ordered = /\d/.test(first[2]); const children: Node[] = [];
      while (i < lines.length) {
        const m = item(lines[i]); if (!m || m[1].length !== indent || /\d/.test(m[2]) !== ordered) break;
        i++; const body = [m[3]]; const width = m[0].length - m[3].length;
        while (i < lines.length) {
          if (!lines[i].trim()) { if (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) { body.push(''); i++; continue; } break; }
          const spaces = lines[i].length - lines[i].trimStart().length; if (spaces <= indent) break;
          body.push(lines[i++].slice(Math.min(width, spaces)));
        }
        const task = /^\[([ xX])\]\s+/.exec(body[0]); if (task) body[0] = body[0].slice(task[0].length);
        const childKey = `${key}.${children.length}`; children.push({ type: 'listItem', key: childKey, checked: task ? task[1] !== ' ' : undefined, children: blocks(body, childKey, 0, resolve, extensions) });
      }
      node = { type: 'list', key, ordered, start: ordered ? parseInt(first[2]) : undefined, children };
    } else if (i + 1 < lines.length && tableDelimiter(lines[i + 1])) {
      const align = cells(lines[i + 1]).map(c => c.startsWith(':') ? c.endsWith(':') ? 'center' as const : 'left' as const : c.endsWith(':') ? 'right' as const : null);
      const rows = [cells(line)]; i += 2; while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(cells(lines[i++]));
      node = { type: 'table', key, align, children: rows.map((row, r) => ({ type: 'tableRow', key: `${key}.${r}`, children: align.map((_, c) => ({ type: r ? 'tableCell' : 'tableHeader', key: `${key}.${r}.${c}`, children: inline(row[c] ?? '', `${key}.${r}.${c}`, resolve, extensions) })) })) };
    } else {
      const start = i++; let depth = 0;
      while (i < lines.length && lines[i].trim()) {
        if (/^ {0,3}(?:=+|-+)\s*$/.test(lines[i])) { depth = lines[i].trim()[0] === '=' ? 1 : 2; break; }
        if (starts(lines[i]) || (i + 1 < lines.length && tableDelimiter(lines[i + 1]))) break;
        i++;
      }
      node = { type: depth ? 'heading' : 'paragraph', key, children: inline(lines.slice(start, i).join('\n'), key, resolve, extensions) };
      if (depth) { node.depth = depth; i++; }
    }
    result.push(node);
  }
  return result;
}

export function createParser(options?: ParserOptions) { return options?.plugins?.length ? streamParser(true, '', undefined, new Plugins(options.plugins)) : streamParser(); }
export function parse(text: string, options?: ParserOptions): Root {
  if (!options?.plugins?.length) return parseDocument(text);
  const parser = createParser(options); parser.push(text); return parser.end().root;
}
