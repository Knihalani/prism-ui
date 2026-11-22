export { compile, evaluate, FormulaError } from './formula';
export type { Scope, Formula } from './formula';
export type Adapter = { load(namespace: string): object | Promise<object>; save(namespace: string, data: object): void };
export type Patch = { set?: Record<string, unknown>; merge?: Record<string, unknown>; delete?: string[] };
const safe = (key: string) => !['__proto__', 'prototype', 'constructor'].includes(key);
const plain = (v: any) => v && Object.getPrototypeOf(v) === Object.prototype;
function clean(v: any): any {
  if (!v || typeof v !== 'object') return v;
  const out: any = Array.isArray(v) ? [] : {};
  for (const key of Object.keys(v)) if (safe(key)) out[key] = clean(v[key]);
  return out;
}
const copy = (v: any) => JSON.parse(JSON.stringify(v));
const read = (v: any, path: string[]) => path.reduce((v, k) => v != null && safe(k) && Object.hasOwn(v, k) ? v[k] : undefined, v);
function write(v: any, keys: string[], value: any, remove = false): any {
  const [key, ...rest] = keys;
  const old = v != null && Object.hasOwn(v, key) ? v[key] : undefined;
  const next = rest.length ? write(old, rest, value, remove) : value;
  if (Object.is(old, next) && !(remove && !rest.length && v != null && Object.hasOwn(v, key))) return v;
  const out: any = Array.isArray(v) ? v.slice() : v == null && /^\d+$/.test(key) ? [] : { ...(v && typeof v === 'object' ? v : {}) };
  if (remove && !rest.length) delete out[key];
  else out[key] = next;
  return out;
}
function merge(a: any, b: any): any {
  if (!plain(b)) return b;
  let out = plain(a) ? a : {};
  for (const k of Object.keys(b)) out = write(out, [k], plain(b[k]) ? merge(out?.[k], b[k]) : b[k]);
  return out;
}
export function createStore({ persist, namespace = '', initial = {} }: { persist?: Adapter; namespace?: string; initial?: Record<string, unknown> } = {}) {
  let state = clean(initial), depth = 0, before = state, loading = false;
  const pending = new Set<string>();
  const past: any[] = [], future: any[] = [], changed = new Set<string>();
  const listeners = new Map<string, Set<() => void>>();
  function flush(history = true) {
    if (!changed.size) return;
    const paths = [...changed];
    if (history) { past.push({ state: before, paths }); if (past.length > 100) past.shift(); future.length = 0; }
    changed.clear(); before = state;
    if (loading) paths.forEach(path => pending.add(path));
    else persist?.save(namespace, copy(state));
    for (const [path, fns] of listeners) if (paths.some(p => path === '*' || p === path || p.startsWith(path + '.') || path.startsWith(p + '.'))) for (const fn of [...fns]) fn();
  }
  function change(path: string, value: unknown, remove = false) {
    const keys = path.split('.');
    if (!keys.every(safe)) return;
    const next = write(state, keys, value, remove);
    if (next === state) return;
    state = next; changed.add(path);
    if (!depth) flush();
  }
  const store = {
    get(path?: string): any { return path === undefined ? state : read(state, path.split('.')); },
    set(path: string, value: unknown) { if (!Object.is(store.get(path), value)) change(path, value && typeof value === 'object' ? clean(value) : value); },
    update(path: string, fn: (value: any) => unknown) { const old = store.get(path), next = fn(old); if (!Object.is(old, next)) store.set(path, next); },
    subscribe(path: string, fn: () => void) { let set = listeners.get(path); if (!set) listeners.set(path, set = new Set()); set.add(fn); return () => { set.delete(fn); }; },
    batch(fn: () => void) { depth++; try { fn(); } finally { if (!--depth) flush(); } },
    undo() { travel(past, future); },
    redo() { travel(future, past); },
    get canUndo() { return !!past.length; },
    get canRedo() { return !!future.length; },
    apply(patch: Patch) { if (!plain(patch)) return; store.batch(() => {
      for (const [p, v] of Object.entries(plain(patch.set) ? patch.set! : {})) store.set(p, v);
      for (const [p, v] of Object.entries(plain(patch.merge) ? patch.merge! : {})) change(p, merge(store.get(p), clean(v)));
      for (const p of Array.isArray(patch.delete) ? patch.delete : []) if (typeof p === 'string') change(p, undefined, true);
    }); },
    snapshot() { return copy(state); },
    ready: Promise.resolve(),
  };
  function travel(from: any[], to: any[]) {
    if (depth || !from.length) return;
    const step = from.pop(); to.push({ state, paths: step.paths }); state = step.state;
    for (const p of step.paths) changed.add(p);
    flush(false);
  }
  function load(data: object) {
    const previous = state; state = merge(state, clean(data)); before = state;
    for (const path of pending) {
      const keys = path.split('.'), parent = read(previous, keys.slice(0, -1));
      state = write(state, keys, read(previous, keys), parent == null || !Object.hasOwn(parent, keys.at(-1)!));
    }
    before = state; loading = false;
    if (pending.size) { pending.clear(); persist?.save(namespace, copy(state)); }
    for (const [p, fns] of listeners) if (p === '*' ? previous !== state : !Object.is(read(previous, p.split('.')), store.get(p))) for (const fn of [...fns]) fn();
  }
  if (persist) {
    try {
      const data = persist.load(namespace);
      if (data instanceof Promise) { loading = true; store.ready = data.then(load); }
      else load(data);
    } catch (error) { store.ready = Promise.reject(error); }
  }
  return store;
}
export type Store = ReturnType<typeof createStore>;
export function memoryAdapter(): Adapter {
  const data = new Map<string, object>();
  return { load: ns => copy(data.get(ns) ?? {}), save: (ns, value) => { data.set(ns, copy(value)); } };
}
export function localStorageAdapter(key: string): Adapter {
  return {
    load(ns) { try { return JSON.parse(globalThis.localStorage?.getItem(key + ':' + ns) ?? '{}'); } catch { return {}; } },
    save(ns, data) { try { globalThis.localStorage?.setItem(key + ':' + ns, JSON.stringify(data)); } catch {} },
  };
}
