import { compile, type Formula } from '@prism-ui/state';

export type ViewValue = string | number | boolean | null | undefined | ViewValue[] | { [key: string]: ViewValue };
export interface ViewNode { type?: string; [key: string]: ViewValue }
export interface ViewScope { view: string; locals: ReadonlySet<string>; item?: string; index?: number }
export type Read = (path: string) => unknown;

const unsafe = (key: string) => key === '__proto__' || key === 'constructor' || key === 'prototype';
const openSet = new WeakSet<object>();
/** True for snapshot copies on the streaming spine, i.e. objects whose JSON has not closed yet. */
export const isOpen = (value: unknown) => !!value && typeof value === 'object' && openSet.has(value as object);
/**
 * Streamed JSON only grows at its right edge: every array element but the last, and every object key but the
 * last, is closed and never mutates again. Closed values are returned by reference (so memoised subtrees keep
 * their identity); only the open spine is copied, which makes each streaming update O(depth).
 */
export function snapshot<T>(value: T, streaming: boolean): T {
  if (!streaming || !value || typeof value !== 'object') return value;
  let copy: any;
  if (Array.isArray(value)) { copy = value.slice(); if (copy.length) copy[copy.length - 1] = snapshot(copy[copy.length - 1], true); }
  else { copy = { ...value }; const keys = Object.keys(copy); const last = keys[keys.length - 1]; if (last !== undefined) copy[last] = snapshot(copy[last], true); }
  openSet.add(copy); return copy;
}

/** Resolve a binding path: `$item.x` (current list item), `$view.x` (view-local), `$global.x`, declared state keys are view-local. */
export function resolvePath(path: string, scope: ViewScope): string | undefined {
  if (typeof path !== 'string' || !path) return;
  const dot = path.indexOf('.'), head = dot < 0 ? path : path.slice(0, dot), rest = dot < 0 ? '' : path.slice(dot);
  let out: string | undefined;
  if (head === '$item') out = scope.item === undefined ? undefined : scope.item + rest;
  else if (head === '$view') out = rest ? scope.view + rest : scope.view;
  else if (head === '$global') out = rest.slice(1) || undefined;
  else if (scope.locals.has(head)) out = scope.view + '.' + path;
  else out = path;
  return out && !out.split('.').some(unsafe) ? out : undefined;
}
/** Read a path; `*` segments map over arrays (`todos.*.done`). */
export function readPath(read: Read, path: string): unknown {
  const star = path.indexOf('.*');
  if (star < 0) return read(path);
  const list = read(path.slice(0, star)), rest = path.slice(star + 2);
  return Array.isArray(list) ? list.map((_, i) => readPath(read, path.slice(0, star) + '.' + i + rest)) : [];
}
export const watchPath = (path: string) => { const star = path.indexOf('.*'); return star < 0 ? path : path.slice(0, star); };

const codes = new Map<string, number>(), names = new Map<number, string>();
/** Map an interned string code back to its string so `a ? 'x' : 'y'` can yield text. */
export const decode = (value: unknown) => typeof value === 'number' && value <= -1e12 && names.has(value) ? names.get(value) : value;
function code(value: unknown): unknown {
  if (typeof value === 'boolean') return +value;
  if (value == null) return 0;
  if (Array.isArray(value)) return value.map(code);
  if (typeof value !== 'string') return value;
  if (!value) return 0;
  if (value.trim() && !Number.isNaN(+value)) return +value;
  let n = codes.get(value);
  if (n === undefined) { if (codes.size > 4096) { codes.clear(); names.clear(); } codes.set(value, n = -1e12 - codes.size); names.set(n, value); }
  return n;
}
type Compiled = { formula: Formula; literals: string[]; deps: string[] };
const compiled = new Map<string, Compiled | null>();
/** Formula engine plus string literals, booleans, `===`, `.*` wildcards and `$item`/`$index`. */
export function compileExpr(expr: string): Compiled | null {
  let hit = compiled.get(expr);
  if (hit !== undefined) return hit;
  const literals: string[] = [];
  const source = expr.replace(/'([^']*)'|"([^"]*)"/g, (_, a, b) => '$s' + (literals.push(a ?? b) - 1))
    .replace(/([=!])==/g, '$1=').replace(/\.\*/g, '.$$$$').replace(/\[(\d+)\]/g, '.$1')
    .replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\s+/g, '!');
  try { const formula = compile(source); hit = { formula, literals, deps: formula.deps.filter(dep => !/^\$s\d+$|^(?:true|false|null|\$index)$/.test(dep)).map(dep => dep.replaceAll('.$$', '.*')) }; }
  catch { hit = null; }
  if (compiled.size > 1000) compiled.clear();
  compiled.set(expr, hit); return hit;
}
export function evaluate(expr: string, scope: ViewScope, read: Read): number {
  const c = compileExpr(String(expr)); if (!c) return NaN;
  try {
    return c.formula((name: string) => {
      if (name === 'true') return 1; if (name === 'false' || name === 'null') return 0;
      if (name === '$index') return scope.index ?? 0;
      const literal = /^\$s(\d+)$/.exec(name); if (literal) return code(c.literals[+literal[1]]);
      const path = resolvePath(name.replaceAll('.$$', '.*'), scope);
      return path === undefined ? 0 : code(readPath(read, path));
    });
  } catch { return NaN; }
}
export const truthy = (value: unknown, scope: ViewScope, read: Read) => typeof value === 'string' ? !!evaluate(value, scope, read) : value === undefined ? true : !!value;

export type Formatter = (value: unknown, kind?: string, options?: Record<string, unknown>) => string;
const plainPath = /^\s*[$a-zA-Z_][\w$]*(?:\.(?:[\w$]+|\*))*\s*$/;
/** `"{{ seats * price | currency }}"` interpolation; plain paths keep strings, other expressions evaluate as numbers. */
export function template(text: string, scope: ViewScope, read: Read, format: Formatter): string {
  if (!text.includes('{{')) return text;
  return text.replace(/\{\{([^{}]*)\}\}/g, (_, body: string) => {
    const bar = formatBar(body), expr = bar < 0 ? body : body.slice(0, bar), kind = bar < 0 ? undefined : body.slice(bar + 1).trim();
    let value: unknown;
    if (plainPath.test(expr) && !/^\s*(?:true|false|null)\s*$/.test(expr)) { const path = expr.trim() === '$index' ? undefined : resolvePath(expr.trim(), scope); value = expr.trim() === '$index' ? scope.index : path === undefined ? undefined : readPath(read, path); }
    else value = decode(evaluate(expr, scope, read));
    return format(value, kind);
  });
}
/** Index of the `| format` separator, skipping `||`. */
export function formatBar(body: string) { for (let i = body.length - 1; i >= 0; i--) if (body[i] === '|' && body[i - 1] !== '|' && body[i + 1] !== '|') return i; return -1; }
const raw = (key: string) => key === 'children' || key === 'item' || key === 'tabs' || /^on[A-Z]/.test(key);
/** Resolve `$bind`/`$ref`/`$calc`, templates and `when` deep inside props; children/item templates and handlers stay raw. */
export function resolve(value: ViewValue, scope: ViewScope, read: Read, format: Formatter, depth = 0, data = false): unknown {
  if (typeof value === 'string') return template(value, scope, read, format);
  if (!value || typeof value !== 'object' || depth > 32) return value;
  if (Array.isArray(value)) return value.map(item => resolve(item, scope, read, format, depth + 1, data));
  if (typeof value.$bind === 'string' || typeof value.$ref === 'string') { const path = resolvePath((value.$bind ?? value.$ref) as string, scope); return path === undefined ? undefined : readPath(read, path); }
  if (typeof value.$calc === 'string') return decode(evaluate(value.$calc, scope, read));
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) if (!unsafe(key)) out[key] = !data && key === 'each' && typeof value.each === 'string' ? listAt(value.each, scope, read) : !data && raw(key) ? value[key] : resolve(value[key], scope, read, format, depth + 1, data);
  return out;
}
function listAt(path: string, scope: ViewScope, read: Read) { const resolved = resolvePath(path, scope); const list = resolved === undefined ? undefined : readPath(read, resolved); return Array.isArray(list) ? list : []; }
export const listPath = (each: ViewValue, scope: ViewScope) => typeof each === 'string' ? resolvePath(each, scope) : each && typeof each === 'object' && !Array.isArray(each) && typeof each.$ref === 'string' ? resolvePath(each.$ref, scope) : undefined;
export const bindPath = (value: ViewValue, scope: ViewScope) => value && typeof value === 'object' && !Array.isArray(value) && typeof value.$bind === 'string' ? resolvePath(value.$bind, scope) : undefined;
/** Paths a node depends on, for per-node subscriptions. */
export function collect(value: ViewValue, scope: ViewScope, into: Set<string>, depth = 0, descendants = false) {
  if (typeof value === 'string') {
    if (value.includes('{{')) for (const match of value.matchAll(/\{\{([^{}]*)\}\}/g)) { const bar = formatBar(match[1]); exprDeps(bar < 0 ? match[1] : match[1].slice(0, bar), scope, into); };
    return into;
  }
  if (!value || typeof value !== 'object' || depth > 32) return into;
  if (Array.isArray(value)) { for (const item of value) collect(item, scope, into, depth + 1, descendants); return into; }
  const path = typeof value.$bind === 'string' ? value.$bind : typeof value.$ref === 'string' ? value.$ref : undefined;
  if (path !== undefined) { const resolved = resolvePath(path, scope); if (resolved) into.add(watchPath(resolved)); return into; }
  if (typeof value.$calc === 'string') { exprDeps(value.$calc, scope, into); return into; }
  { const p = listPath(value.each, scope); if (p) into.add(watchPath(p)); }
  if (Array.isArray(value.tabs)) for (const tab of value.tabs) if (tab && typeof tab === 'object' && !Array.isArray(tab)) { collect(tab.label, scope, into, depth + 1); collect(tab.badge, scope, into, depth + 1); }
  for (const key of Object.keys(value)) if (!unsafe(key) && (descendants || !raw(key)) && key !== 'each') EXPR_KEYS.has(key) && typeof value[key] === 'string' ? exprDeps(value[key] as string, scope, into) : collect(value[key], scope, into, depth + 1, descendants);
  return into;
}
const EXPR_KEYS = new Set(['when', 'selected', 'disabled', 'filter']);
export function exprDeps(expr: string, scope: ViewScope, into: Set<string>) {
  const c = compileExpr(expr.trim());
  for (const dep of c?.deps ?? []) { const path = resolvePath(dep, scope); if (path) into.add(watchPath(path)); }
  return into;
}

export type Handler = { set?: Record<string, ViewValue>; toggle?: string | string[]; push?: Record<string, ViewValue>; remove?: string | string[]; action?: string; payload?: ViewValue; message?: string };
export type Write = { set(path: string, value: unknown): void; get(path: string): unknown; remove(path: string): void };
let sequence = 0;
/** Apply a handler (or list) and return the action to emit, if any. Values are read before any write. */
export function run(spec: unknown, scope: ViewScope, store: Write, format: Formatter, extra?: Record<string, unknown>): { type: string; payload: unknown; message?: string } | undefined {
  const specs = (Array.isArray(spec) ? spec : [spec]).filter((s): s is Handler => !!s && typeof s === 'object');
  const read: Read = path => store.get(path);
  const writes: (() => void)[] = []; let action: { type: string; payload: unknown; message?: string } | undefined;
  for (const h of specs) {
    for (const [key, value] of Object.entries(h.set ?? {})) { const path = resolvePath(key, scope); const next = resolve(value, scope, read, format, 0, true); if (path) writes.push(() => store.set(path, next)); }
    for (const key of ([] as string[]).concat(h.toggle ?? [])) { const path = resolvePath(key, scope); if (path) { const next = !store.get(path); writes.push(() => store.set(path, next)); } }
    for (const [key, value] of Object.entries(h.push ?? {})) {
      const path = resolvePath(key, scope); if (!path) continue;
      let next = resolve(value, scope, read, format, 0, true);
      if (next && typeof next === 'object' && !Array.isArray(next) && !('id' in next)) next = { id: 'i' + Date.now().toString(36) + (++sequence).toString(36), ...next };
      if (typeof next === 'string' && !next.trim()) continue;
      writes.push(() => { const list = store.get(path); store.set(path, [...(Array.isArray(list) ? list : []), next]); });
    }
    for (const key of ([] as string[]).concat(h.remove ?? [])) { const path = resolvePath(key, scope); if (path) writes.push(() => store.remove(path)); }
    if (typeof h.action === 'string' && h.action) action = { type: h.action, payload: h.payload === undefined ? extra : resolve(h.payload, scope, read, format, 0, true), message: typeof h.message === 'string' ? template(h.message, scope, read, format) : undefined };
  }
  writes.forEach(write => write());
  return action;
}
