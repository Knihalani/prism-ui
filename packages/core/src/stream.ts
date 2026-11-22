import { freeze, type Node, type Root } from './ast';
import { blocks } from './parser';
import { inline, normalizeLabel } from './inline';
import { InlineState } from './inline-state';
import { JsonScanner } from './json';
import { attributes, safeUrl } from './values';
import { BlockVector } from './vector';

interface Definition { url: string; title?: string }
class References {
  definitions = new Map<string, Definition>();
  waiting = new Map<string, Set<() => void>>();
  finalizers = new Set<() => void>();
  dependencies = new WeakMap<Node, { listeners: Set<() => void>; resolve: () => void }>();
  define(label: string, definition: Definition) {
    label = normalizeLabel(label);
    if (this.definitions.has(label)) return;
    this.definitions.set(label, definition);
    const waiting = this.waiting.get(label); this.waiting.delete(label);
    if (waiting) for (const resolve of waiting) resolve();
  }
  track(node: Node, replace: (node: Node) => void, immutable: boolean, hasReferences: boolean) {
    if (!hasReferences) { replace(immutable ? freeze(node) : node); return; }
    let pending = 0; let ready = false;
    let provisional = false;
    const finish = () => { if (ready && pending === 0) { const next = provisional ? { ...node } : node; replace(immutable ? freeze(next) : next); this.finalizers.delete(finalize); } };
    const missing: (() => void)[] = [];
    const finalize = () => { for (const resolve of missing) resolve(); };
    const visit = (n: Node) => {
      if (Object.isFrozen(n)) return;
      if (n.type === 'reference' || n.type === 'imageReference') {
        const label = n.name!; const image = n.type === 'imageReference';
        const apply = () => {
          const definition = this.definitions.get(label);
          if (definition) {
            n.type = image ? 'image' : 'link'; n.url = safeUrl(definition.url, image); n.title = definition.title;
            if (image) { n.value = textContent(n.children ?? []); delete n.children; } else delete n.value;
          } else { n.type = 'text'; delete n.children; }
          delete n.name;
        };
        if (this.definitions.has(label)) apply();
        else {
          pending++;
          let dependency = this.dependencies.get(n);
          if (!dependency) {
            let resolved = false; const listeners = new Set<() => void>();
            const resolve = () => { if (resolved) return; resolved = true; apply(); this.waiting.get(label)?.delete(resolve); for (const notify of listeners) notify(); };
            dependency = { listeners, resolve }; this.dependencies.set(n, dependency);
            let waiting = this.waiting.get(label); if (!waiting) this.waiting.set(label, waiting = new Set());
            waiting.add(resolve);
          }
          dependency.listeners.add(() => { pending--; finish(); }); missing.push(dependency.resolve);
        }
      }
      if (n.children) for (const child of n.children) visit(child);
    };
    visit(node); ready = true;
    if (pending) { provisional = true; this.finalizers.add(finalize); } else finish();
  }
  end() { for (const finalize of this.finalizers) finalize(); this.finalizers.clear(); this.waiting.clear(); }
}
function textContent(nodes: Node[]): string { let result = ''; for (const n of nodes) result += n.value ?? textContent(n.children ?? []); return result; }

const fence = (s: string) => /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(s);
const directive = (s: string) => /^ {0,3}(:{2,})([\w-]+)(?:\{(.*)\})?\s*$/.exec(s);
const item = (s: string) => /^( *)([-+*]|\d+[.)])\s+(.*)$/.exec(s);
const quote = (s: string) => /^ {0,3}>/.test(s);
const heading = (s: string) => /^ {0,3}#{1,6}(?:\s|$)/.test(s);
const rule = (s: string) => /^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(s);
const setext = (s: string) => /^ {0,3}(?:=+|-+)\s*$/.test(s);
const tableDelimiter = (s: string) => s.includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(s);
const definition = (s: string) => /^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]*)>|(\S+?))(?:\s+["'(](.*)["')])?\s*$/.exec(s);

type Mode = 'paragraph' | 'list' | 'blockquote' | 'table' | 'code' | 'container';
interface Active {
  mode: Mode;
  node: Node;
  index: number;
  lines: string[];
  inline?: InlineState;
  inlinePending: string;
  mark: string;
  size: number;
  json?: JsonScanner;
  nested?: ReturnType<typeof streamParser>;
  pendingBreak: boolean;
  blank: boolean;
  indent: number;
  dirtyLine: boolean;
  revision: number;
  preview: () => Node;
}

export function streamParser(previews = true, path = '', references = new References()) {
  const nodes: Node[] = [];
  let vector = new BlockVector(); let cachedRoot: Root = { type: 'root', key: path, children: vector.view() };
  const changed: number[] = []; let dirty = false;
  function snapshot(): Root {
    if (!dirty) return cachedRoot;
    if (vector.length > nodes.length) vector = vector.take(nodes.length);
    for (const index of changed) if (index < nodes.length && index !== active?.index) vector = vector.set(index, nodes[index]);
    changed.length = 0; dirty = false;
    const tail = active?.preview;
    if (!BlockVector.reuse(cachedRoot.children, vector, tail)) cachedRoot = { type: 'root', key: path, children: vector.view(tail) };
    return cachedRoot;
  }
  let active: Active | undefined;
  let line = ''; let routed = false; let candidate = true; let candidateCount = 0; let candidateSpaces = 0; let candidateTrailing = false;
  let ended = false; let pendingCR = false;
  let hasReferences = false;
  const reference = () => { hasReferences = true; };
  const keyAt = (index: number) => path ? `${path}.${index}` : `${index}`;
  function preview(a: Active): Node {
    if (a.node.type === 'paragraph') {
      if (!a.inline) { a.inline = new InlineState(a.node.key); a.node.children = a.inline.children; }
      a.inline.push(a.inlinePending); a.inlinePending = '';
    }
    if (a.json) {
      const value = a.json.value;
      a.node.props = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }
    const node = a.node;
    if (a.nested) node.children = a.nested.root.children;
    return { ...node };
  }
  function begin() {
    const index = nodes.length; const key = keyAt(index);
    let version = -1; let published: Node;
    const a: Active = { mode: 'paragraph', node: { type: 'paragraph', key, children: [] }, index, lines: [], inlinePending: '', mark: '', size: 0, pendingBreak: false, blank: false, indent: 0, dirtyLine: false, revision: 0, preview: () => {
      if (version !== a.revision) { published = preview(a); version = a.revision; }
      return published;
    } };
    active = a;
    nodes.push(active.node);
    dirty = true;
  }
  function finishNode(node: Node, index: number) {
    nodes[index] = node;
    if (!hasReferences) { nodes[index] = previews ? freeze(node) : node; changed.push(index); dirty = true; return; }
    changed.push(index); dirty = true;
    references.track(node, next => { nodes[index] = next; changed.push(index); dirty = true; }, previews, hasReferences);
  }
  function commit() {
    if (!active) return;
    const a = active; active = undefined;
    if (a.mode === 'container') {
      a.nested!.end(false); hasReferences ||= a.nested!.hasReferences;
      a.node.children = a.nested!.root.children; finishNode(a.node, a.index);
    } else if (a.mode === 'code') {
      if (a.json) {
        const value = a.json.end(); a.node.props = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      }
      finishNode(a.node, a.index);
    } else {
      dirty = true;
      nodes.length = a.index;
      const parsed = a.mode === 'paragraph' && !a.dirtyLine
        ? [{ type: 'paragraph', key: a.node.key, children: a.inline && !a.inlinePending ? a.inline.finish(() => a.lines.join('\n'), reference) : inline(a.lines.join('\n'), a.node.key, reference) }]
        : blocks(a.lines, path, a.index, reference);
      for (const node of parsed) finishNode(node, nodes.length);
    }
  }
  function body(value: string) {
    const a = active!;
    if (a.pendingBreak) { a.pendingBreak = false; body('\n'); }
    if (a.mode === 'container') a.nested!.push(value);
    else if (a.json) a.json.push(value);
    else a.node.value += value;
  }
  function fragment(value: string) {
    if (!value) return;
    if (!active) begin();
    const a = active!;
    if (a.mode === 'code' || a.mode === 'container') {
      if (candidate) {
        if (a.mode === 'container' && a.nested!.inFence) candidate = false;
        for (let i = 0; i < value.length && candidate; i++) {
          const c = value[i];
          if (!candidateCount && c === ' ' && candidateSpaces < 3) candidateSpaces++;
          else if (c === a.mark && !candidateTrailing) candidateCount++;
          else if ((c === ' ' || c === '\t') && candidateCount >= a.size) candidateTrailing = true;
          else candidate = false;
        }
        if (!candidate) { body(line); routed = true; }
      } else { body(value); routed = true; }
    } else if (previews) {
      a.dirtyLine = true;
      if (a.pendingBreak) { a.inlinePending += '\n'; a.pendingBreak = false; }
      a.inlinePending += value;
    }
  }
  function resetLine() { line = ''; routed = false; candidate = true; candidateCount = 0; candidateSpaces = 0; candidateTrailing = false; }
  function accept(value: string) {
    if (active?.mode === 'code' || active?.mode === 'container') {
      const a = active;
      if (candidate && candidateCount >= a.size) { a.node.complete = true; commit(); }
      else {
        if (!routed) body(value);
        if (a.mode === 'container') a.nested!.push('\n');
        else a.pendingBreak = true;
      }
      return;
    }
    const def = definition(value);
    if (def) { commit(); references.define(def[1], { url: def[2] ?? def[3], title: def[4] }); return; }
    if (!value.trim()) {
      if (active?.mode === 'list') { active.lines.push(value); active.blank = true; }
      else commit();
      return;
    }
    const f = fence(value); const d = directive(value); const m = item(value);
    if (active && active.lines.length) {
      const a = active;
      if (a.mode === 'paragraph' && setext(value)) { a.lines.push(value); a.dirtyLine = true; commit(); return; }
      if (a.mode === 'paragraph' && tableDelimiter(value)) {
        a.lines.push(value); a.mode = 'table';
        if (previews) { const parsed = blocks(a.lines, path, a.index); a.node = parsed[parsed.length - 1]; }
        return;
      }
      const indented = a.mode === 'list' && value.length - value.trimStart().length > a.indent;
      const boundary = !indented && (
        !!f || !!d || heading(value) || rule(value) ||
        (m && a.mode !== 'list') || (quote(value) && a.mode !== 'blockquote') ||
        (a.mode === 'blockquote' && !quote(value)) ||
        (a.mode === 'table' && !value.includes('|')) ||
        (a.mode === 'list' && !m && a.blank)
      );
      if (boundary) commit();
    }
    if (!active) { begin(); if (previews) active!.inlinePending += value; }
    const a = active!;
    if (!a.lines.length) {
      if (f) {
        const info = f[2].trim(); const space = info.search(/\s/); const lang = space < 0 ? info : info.slice(0, space); const meta = space < 0 ? '' : info.slice(space).trim();
        a.mode = 'code'; a.mark = f[1][0]; a.size = f[1].length;
        if (lang.startsWith('ui:')) { a.json = new JsonScanner(); a.node = { type: 'component', key: a.node.key, name: lang.slice(3), props: {}, children: [], complete: false }; }
        else a.node = { type: 'code', key: a.node.key, lang, meta, value: '', complete: false };
        return;
      }
      if (d) {
        a.node = { type: 'component', key: a.node.key, name: d[2], props: attributes(d[3] ?? ''), children: [], complete: d[1].length === 2 };
        if (d[1].length === 2) { active = undefined; finishNode(a.node, a.index); }
        else { a.mode = 'container'; a.mark = ':'; a.size = d[1].length; a.nested = streamParser(previews, a.node.key, references); a.node.children = a.nested.root.children; }
        return;
      }
      if (heading(value) || rule(value)) { a.lines.push(value); a.dirtyLine = true; commit(); return; }
      if (m) { a.mode = 'list'; a.indent = m[1].length; }
      else if (quote(value)) a.mode = 'blockquote';
    }
    a.lines.push(value); a.pendingBreak = true; a.blank = false; a.dirtyLine = false;
    if (previews && (a.mode === 'list' || a.mode === 'blockquote')) {
      // Each completed line is parsed once; the active line continues incrementally.
      const parsed = blocks([value], a.node.key);
      if (a.mode === 'list' && parsed[0]?.type === 'list') {
        if (a.node.type !== 'list') a.node = { ...parsed[0], key: keyAt(a.index), children: [] };
        a.node.children!.push(...(parsed[0].children ?? []));
      } else if (a.mode === 'blockquote') {
        if (a.node.type !== 'blockquote') a.node = { type: 'blockquote', key: keyAt(a.index), children: [] };
        a.node.children!.push(...(parsed[0]?.children ?? []));
      }
      a.inline = undefined; a.inlinePending = '';
    } else if (previews && a.mode === 'table' && !tableDelimiter(value)) {
      const row = blocks([a.lines[0], a.lines[1], value], a.node.key)[0]?.children?.[1];
      if (row) a.node.children!.push(row);
    }
  }
  const update = { get root() { return snapshot(); } };
  return {
    push(chunk: string) {
      if (ended) throw new Error('Parser has ended');
      let start = 0;
      if (pendingCR && chunk) { pendingCR = false; if (chunk.charCodeAt(0) === 10) start = 1; }
      for (let i = start; i < chunk.length; i++) {
        const c = chunk.charCodeAt(i);
        if (c !== 10 && c !== 13) continue;
        const part = chunk.slice(start, i); line += part; fragment(part); accept(line); resetLine();
        if (c === 13) { if (chunk.charCodeAt(i + 1) === 10) i++; else if (i + 1 === chunk.length) pendingCR = true; }
        start = i + 1;
      }
      if (start < chunk.length) { const part = chunk.slice(start); line += part; fragment(part); }
      if (active) active.revision++;
      return update;
    },
    end(final = true) {
      if (!ended) { if (line) accept(line); resetLine(); commit(); ended = true; if (final) references.end(); }
      return update;
    },
    get root() { return snapshot(); },
    get hasReferences(): boolean { return hasReferences; },
    get inFence(): boolean { return active?.mode === 'code' || (active?.nested?.inFence ?? false); },
  };
}

export function parseDocument(text: string): Root {
  const lines = (text.includes('\r') ? text.replace(/\r\n?/g, '\n') : text).split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  const references = new References(); let close: RegExp | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (close) { if (close.test(line)) close = undefined; continue; }
    let p = 0; while (line.charCodeAt(p) === 32) p++;
    const c = line.charCodeAt(p); if (c !== 91 && c !== 96 && c !== 126) continue;
    const f = /^\s*(`{3,}|~{3,})/.exec(line);
    if (f) { close = new RegExp(`^\\s*${f[1][0]}{${f[1].length},}\\s*$`); continue; }
    const def = definition(line);
    if (def) { references.define(def[1], { url: def[2] ?? def[3], title: def[4] }); lines[i] = ''; }
  }
  const children = blocks(lines, '', 0, node => {
    const def = references.definitions.get(node.name!); const image = node.type === 'imageReference';
    if (def) { node.type = image ? 'image' : 'link'; node.url = safeUrl(def.url, image); node.title = def.title; if (image) { node.value = textContent(node.children ?? []); delete node.children; } else delete node.value; }
    else { node.type = 'text'; delete node.children; }
    delete node.name;
  });
  return { type: 'root', key: '', children };
}
