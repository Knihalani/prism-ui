import { freeze, type Node, type Root, type Update } from './ast';
import { inline } from './inline';
import { attributes, relaxed } from './values';

const fence = (s: string) => /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(s);
const directive = (s: string) => /^ {0,3}(:{2,})([\w-]+)(?:\{(.*)\})?\s*$/.exec(s);
const item = (s: string) => /^( *)([-+*]|\d+[.)])\s+(.*)$/.exec(s);
const thematic = (s: string) => /^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(s);
const cells = (s: string) => s.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(s => s.trim().replace(/\\\|/g, '|'));
const tableDelimiter = (s: string) => s.includes('-') && cells(s).every(c => /^:?-{3,}:?$/.test(c));
const starts = (s: string) => !!(fence(s) || directive(s) || item(s) || /^ {0,3}(?:#{1,6}\s|>)/.test(s) || thematic(s));

export function blocks(lines: string[], path = ''): Node[] {
  const result: Node[] = []; let i = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue; }
    const key = path ? `${path}.${result.length}` : `${result.length}`;
    const line = lines[i]; const f = fence(line); const d = directive(line); let node: Node;
    if (f) {
      const start = ++i; const close = new RegExp(`^ {0,3}${f[1][0]}{${f[1].length},}\\s*$`);
      while (i < lines.length && !close.test(lines[i])) i++;
      const complete = i < lines.length; const value = lines.slice(start, i).join('\n'); if (complete) i++;
      const info = f[2].trim(); const space = info.search(/\s/); const lang = space < 0 ? info : info.slice(0, space); const meta = space < 0 ? '' : info.slice(space).trim();
      if (lang.startsWith('ui:')) { const props = relaxed(value); node = { type: 'component', key, name: lang.slice(3), props: props && typeof props === 'object' && !Array.isArray(props) ? props : {}, children: [], complete }; }
      else node = { type: 'code', key, lang, meta, value, complete };
    } else if (d) {
      const start = ++i; let complete = d[1].length === 2;
      if (!complete) { const close = new RegExp(`^ {0,3}:{${d[1].length},}\\s*$`); while (i < lines.length && !close.test(lines[i])) i++; complete = i < lines.length; }
      node = { type: 'component', key, name: d[2], props: attributes(d[3] ?? ''), children: d[1].length === 2 ? [] : blocks(lines.slice(start, i), key), complete };
      if (d[1].length > 2 && complete) i++;
    } else if (/^ {0,3}#{1,6}(?:\s|$)/.test(line)) {
      const m = /^ {0,3}(#{1,6})(?:\s+(.*)|$)/.exec(line)!; node = { type: 'heading', depth: m[1].length, key, children: inline((m[2] ?? '').replace(/\s+#+\s*$/, ''), key) }; i++;
    } else if (thematic(line)) { node = { type: 'thematicBreak', key }; i++; }
    else if (/^ {0,3}>/.test(line)) {
      const body: string[] = []; while (i < lines.length && /^ {0,3}>/.test(lines[i])) body.push(lines[i++].replace(/^ {0,3}> ?/, ''));
      node = { type: 'blockquote', key, children: blocks(body, key) };
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
        const childKey = `${key}.${children.length}`; children.push({ type: 'listItem', key: childKey, checked: task ? task[1] !== ' ' : undefined, children: blocks(body, childKey) });
      }
      node = { type: 'list', key, ordered, start: ordered ? parseInt(first[2]) : undefined, children };
    } else if (i + 1 < lines.length && tableDelimiter(lines[i + 1])) {
      const align = cells(lines[i + 1]).map(c => c.startsWith(':') ? c.endsWith(':') ? 'center' as const : 'left' as const : c.endsWith(':') ? 'right' as const : null);
      const rows = [cells(line)]; i += 2; while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(cells(lines[i++]));
      node = { type: 'table', key, align, children: rows.map((row, r) => ({ type: 'tableRow', key: `${key}.${r}`, children: align.map((_, c) => ({ type: r ? 'tableCell' : 'tableHeader', key: `${key}.${r}.${c}`, children: inline(row[c] ?? '', `${key}.${r}.${c}`) })) })) };
    } else {
      const start = i++; while (i < lines.length && lines[i].trim() && !starts(lines[i])) { if (i + 1 < lines.length && tableDelimiter(lines[i + 1])) break; i++; }
      node = { type: 'paragraph', key, children: inline(lines.slice(start, i).join('\n'), key) };
    }
    result.push(node);
  }
  return result;
}

export function createParser() {
  const done: Node[] = []; let tail: string[] = []; let line = ''; let pendingCR = false; let ended = false; let dirty = true;
  let cached: Root = { type: 'root', key: '', children: [] };
  let fenceMark = ''; let fenceSize = 0; let colons = 0;
  function commit() {
    if (!tail.length) return;
    const parsed = blocks(tail); for (const node of parsed) { rekey(node, String(done.length)); done.push(freeze(node)); }
    tail = [];
  }
  function accept(value: string) {
    if (fenceMark) { tail.push(value); if (new RegExp(`^ {0,3}${fenceMark}{${fenceSize},}\\s*$`).test(value)) { fenceMark = ''; if (!colons) commit(); } return; }
    const f = fence(value); const d = directive(value);
    if (!colons && tail.length && value.trim() && starts(value) && !item(value) && !/^ {0,3}>/.test(value)) commit();
    tail.push(value);
    if (f) { fenceMark = f[1][0]; fenceSize = f[1].length; }
    else if (d && d[1].length > 2 && !colons) colons = d[1].length;
    else if (colons && new RegExp(`^ {0,3}:{${colons},}\\s*$`).test(value)) { colons = 0; commit(); }
    else if (!colons && (/^ {0,3}#{1,6}(?:\s|$)/.test(value) || thematic(value) || d?.[1].length === 2)) commit();
    else if (!colons && !value.trim()) {
      // Lists can continue across blank lines; retain them until the next block.
      if (!tail.some(s => !!item(s))) commit();
    }
  }
  function root(): Root {
    if (dirty) {
      const open = blocks([...tail, ...(line ? [line] : [])]);
      for (let i = 0; i < open.length; i++) rekey(open[i], String(done.length + i));
      cached = { type: 'root', key: '', children: [...done, ...open] }; dirty = false;
    }
    return cached;
  }
  const update = (): Update => ({ get root() { return root(); } });
  return {
    push(chunk: string): Update {
      if (ended) throw new Error('Parser has ended');
      if (chunk) dirty = true;
      for (let i = 0; i < chunk.length; i++) {
        const c = chunk[i]; if (pendingCR) { pendingCR = false; if (c === '\n') continue; }
        if (c === '\n' || c === '\r') { accept(line); line = ''; pendingCR = c === '\r'; } else line += c;
      }
      return update();
    },
    end(): Update { if (!ended) { if (line) accept(line); line = ''; commit(); ended = true; dirty = true; } return update(); },
    get root() { return root(); },
  };
}
function rekey(node: Node, key: string) { node.key = key; node.children?.forEach((child, i) => rekey(child, `${key}.${i}`)); }
export function parse(text: string): Root { const parser = createParser(); parser.push(text); return parser.end().root; }
