import type { Node } from './ast';
import { inline } from './inline';

/** Provisional inline tree; only the current lexical construct remains mutable. */
export class InlineState {
  readonly children: Node[] = [];
  private frames: { marker: string; children: Node[] }[] = [{ marker: '', children: this.children }];
  private run = '';
  private escaped = false;
  private code?: Node;
  private codeMarker = '';
  private token = '';
  private tokenKind = '';
  private tokenNode?: Node;
  private tokenTarget?: Node[];
  private quote = '';
  private depth = 0;
  private previous = '';
  private syntax = false;
  constructor(private path: string) {}
  private target() { return this.frames[this.frames.length - 1].children; }
  private add(node: Node) { const target = this.target(); node.key = `${this.path}.${target.length}`; target.push(node); }
  private text(value: string) {
    if (!value) return;
    const target = this.target(); const last = target[target.length - 1];
    if (last?.type === 'text' && last !== this.tokenNode) last.value += value;
    else this.add({ type: 'text', key: '', value });
  }
  private flush(buffer: string) { this.text(buffer); return ''; }
  private delimiter(next: string) {
    const run = this.run; this.run = '';
    if (this.code) {
      if (run === this.codeMarker) { this.normalizeCode(); this.code = undefined; this.codeMarker = ''; }
      else this.code.value += run;
      return;
    }
    if (run[0] === '`') { const node: Node = { type: 'inlineCode', key: '', value: '' }; this.add(node); this.code = node; this.codeMarker = run; return; }
    const frame = this.frames[this.frames.length - 1];
    if (run === frame.marker) { this.frames.pop(); return; }
    if (!next || next.charCodeAt(0) <= 32 || (run[0] === '~' && run.length < 2)) { this.text(run); return; }
    const children: Node[] = [];
    this.add({ type: run[0] === '~' ? 'delete' : run.length > 1 ? 'strong' : 'emphasis', key: '', children });
    this.frames.push({ marker: run, children });
  }
  private normalizeCode() {
    const value = this.code!.value!;
    if (value[0] === ' ' && value[value.length - 1] === ' ' && /[^ ]/.test(value)) this.code!.value = value.slice(1, -1);
  }
  private finishToken() {
    const target = this.tokenTarget!;
    target.pop();
    const rekey = (node: Node, path: string) => { node.key = path; node.children?.forEach((child, index) => rekey(child, `${path}.${index}`)); };
    const parsed = inline(this.token, this.path);
    for (const node of parsed) { rekey(node, `${this.path}.${target.length}`); target.push(node); }
    this.token = ''; this.tokenKind = ''; this.tokenNode = undefined; this.tokenTarget = undefined; this.quote = ''; this.depth = 0;
  }
  push(source: string) {
    let buffer = '';
    for (let i = 0; i < source.length; i++) {
      const c = source[i]; const code = source.charCodeAt(i);
      if (this.tokenKind) {
        if (this.tokenKind === 'word' && code <= 32) { this.finishToken(); i--; continue; }
        this.token += c; this.tokenNode!.value = this.token;
        if (this.tokenKind === 'angle' && c === '>') this.finishToken();
        else if (this.tokenKind === 'bracket') {
          if (this.quote) { if (this.previous !== '\\' && c === this.quote) this.quote = ''; }
          else if (c === '"' || c === "'") this.quote = c;
          else if (c === '(' || c === '{' || c === '[') this.depth++;
          else if (c === ')' || c === '}' || c === ']') {
            this.depth--;
            if (this.depth === 0 && c !== ']') this.finishToken();
          } else if (this.depth === 0 && code <= 32) { this.finishToken(); }
        } else if (this.tokenKind === 'directive') {
          if (this.quote) { if (this.previous !== '\\' && c === this.quote) this.quote = ''; }
          else if (c === '"' || c === "'") this.quote = c;
          else if (code <= 32 && this.depth === 0) this.finishToken();
          else if (c === '[' || c === '{') this.depth++;
          else if (c === ']' || c === '}') { this.depth--; if (!this.depth && c === '}') this.finishToken(); }
        }
        this.previous = c; continue;
      }
      if (this.run && c !== this.run[0]) { buffer = this.flush(buffer); this.delimiter(c); }
      if (this.code) {
        if (c === '`') this.run += c;
        else { this.code.value += c === '\n' ? ' ' : c; }
        this.previous = c; continue;
      }
      if (this.escaped) { buffer = this.flush(buffer); if (c === '\n') this.add({ type: 'break', key: '' }); else this.text(c); this.escaped = false; this.previous = c; continue; }
      if (c === '\\') { this.syntax = true; buffer = this.flush(buffer); this.escaped = true; }
      else if (c === '*' || c === '_' || c === '~' || c === '`') {
        this.syntax = true;
        if (c === '_' && /\w/.test(this.previous) && /\w/.test(source[i + 1] ?? '')) buffer += c;
        else { buffer = this.flush(buffer); this.run += c; }
      } else if (c === '[' || c === '<' || c === ':' || (c === 'h' && (!this.previous || this.previous.charCodeAt(0) <= 32))) {
        this.syntax = true;
        buffer = this.flush(buffer); this.token = c; this.tokenKind = c === '<' ? 'angle' : c === ':' ? 'directive' : c === 'h' ? 'word' : 'bracket';
        this.depth = c === '[' ? 1 : 0;
        this.tokenNode = { type: 'text', key: '', value: c }; this.add(this.tokenNode); this.tokenTarget = this.target();
      } else if (c === '\n') {
        this.syntax = true;
        buffer = this.flush(buffer); const target = this.target(); const last = target[target.length - 1];
        if (this.previous === ' ' && last?.type === 'text' && last.value?.endsWith('  ')) { last.value = last.value.trimEnd(); this.add({ type: 'break', key: '' }); }
        else this.text('\n');
      } else { if (c === '!') this.syntax = true; buffer += c; }
      this.previous = c;
    }
    this.text(buffer);
  }
  finish(source: () => string, resolve?: (node: Node) => void): Node[] {
    // Resolve provisional tokens once, using the batch parser's precedence rules.
    if (this.syntax) return inline(source(), this.path, resolve);
    if (this.run) this.delimiter('');
    if (this.code) this.normalizeCode();
    if (this.tokenKind) this.finishToken();
    if (this.escaped) this.text('\\');
    const normalize = (nodes: Node[], path: string) => {
      let count = 0;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.type === 'text' && nodes[count - 1]?.type === 'text') { nodes[count - 1].value += node.value ?? ''; continue; }
        node.key = `${path}.${count}`; if (node.children) normalize(node.children, node.key); nodes[count++] = node;
      }
      nodes.length = count;
    };
    normalize(this.children, this.path); return this.children;
  }
}
