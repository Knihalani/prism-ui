export { compile, evaluate, FormulaError } from './formula';
export type { Scope, Formula } from './formula';
export type Adapter = { load(namespace: string): object | Promise<object>; save(namespace: string, data: object): void };
export type Patch = { set?: Record<string, unknown>; merge?: Record<string, unknown>; delete?: string[] };
export type WriteOptions = { history?: boolean };
type HistoryEntry = { state: any; paths: string[] };
const within = (path: string, scope: string) => path === scope || path.startsWith(scope + '.');
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
function write(v: any, keys: string[], value: any, remove = false, record = false): any {
  const [key, ...rest] = keys;
  const old = v != null && Object.hasOwn(v, key) ? v[key] : undefined;
  const next = rest.length ? write(old, rest, value, remove, record) : value;
  if (Object.is(old, next) && !(remove && !rest.length && v != null && Object.hasOwn(v, key)) && !(record && Array.isArray(v))) return v;
  const out: any = !record && Array.isArray(v) ? v.slice() : !record && v == null && /^\d+$/.test(key) ? [] : { ...(v && typeof v === 'object' ? v : {}) };
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
function fillMissing(source: any, destination: any): any {
  if (destination === undefined) return source;
  if (!plain(source) || !plain(destination)) return destination;
  return Object.fromEntries([...new Set([...Object.keys(source), ...Object.keys(destination)])].map(key => [key, fillMissing(source[key], destination[key])]));
}
function moveTree(tree: any, from: string, to: string, record = false) {
  const source = read(tree, from.split('.'));
  if (source === undefined) return tree;
  const nested = to.startsWith(from + '.'), destination = read(tree, to.split('.'));
  tree = write(tree, from.split('.'), undefined, true);
  const parents = from.split('.');
  while (parents.length > 1) {
    parents.pop();
    const value = read(tree, parents);
    if (!value || typeof value !== 'object' || Object.keys(value).length) break;
    tree = write(tree, parents, undefined, true);
  }
  return write(tree, to.split('.'), fillMissing(source, nested ? destination : read(tree, to.split('.'))), false, record);
}
function changedPaths(previous: any, next: any, paths: Set<string>, path = '') {
  if (Object.is(previous, next)) return;
  if ((plain(previous) && plain(next)) || (Array.isArray(previous) && Array.isArray(next))) {
    for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) changedPaths(previous[key], next[key], paths, path ? path + '.' + key : key);
  } else if (path) paths.add(path);
}
export function createStore({ persist, namespace = '', initial = {} }: { persist?: Adapter; namespace?: string; initial?: Record<string, unknown> } = {}) {
  let state = clean(initial), depth = 0, before = state, loading = false, recordHistory = false, historyDisabled = 0;
  const pending = new Set<string>();
  const past: HistoryEntry[] = [], future: HistoryEntry[] = [], changed = new Set<string>();
  const listeners = new Map<string, Set<() => void>>();
  function flush(history = recordHistory) {
    if (!changed.size) return;
    const paths = [...changed], previous = before;
    if (history) { past.push({ state: before, paths }); if (past.length > 100) past.shift(); future.length = 0; }
    changed.clear(); before = state; recordHistory = false;
    if (loading) paths.forEach(path => pending.add(path));
    else persist?.save(namespace, copy(state));
    for (const [path, fns] of listeners) if (paths.some(p => path === '*' || p === path || p.startsWith(path + '.') || path.startsWith(p + '.')) || (path.endsWith('.length') && !Object.is(read(previous, path.split('.')), store.get(path)))) for (const fn of [...fns]) fn();
  }
  function change(path: string, value: unknown, remove = false, options: WriteOptions = {}) {
    const keys = path.split('.');
    if (!keys.every(safe)) return;
    const next = write(state, keys, value, remove);
    if (next === state) return;
    state = next; changed.add(path); recordHistory ||= options.history !== false && historyDisabled === 0;
    if (!depth) flush();
  }
  const store = {
    get(path?: string): any { return path === undefined ? state : read(state, path.split('.')); },
    set(path: string, value: unknown, options: WriteOptions = {}) { if (!Object.is(store.get(path), value)) change(path, value && typeof value === 'object' ? clean(value) : value, false, options); },
    update(path: string, fn: (value: any) => unknown, options: WriteOptions = {}) { const old = store.get(path), next = fn(old); if (!Object.is(old, next)) store.set(path, next, options); },
    subscribe(path: string, fn: () => void) { let set = listeners.get(path); if (!set) listeners.set(path, set = new Set()); set.add(fn); return () => { set.delete(fn); }; },
    batch(fn: () => void, options: WriteOptions = {}) { depth++; if (options.history === false) historyDisabled++; try { fn(); } finally { if (options.history === false) historyDisabled--; if (!--depth) flush(); } },
    undo(scope?: string) { travel(past, future, scope); },
    redo(scope?: string) { travel(future, past, scope); },
    canUndo(scope?: string) { return past.some(step => scope === undefined || step.paths.some(path => within(path, scope))); },
    canRedo(scope?: string) { return future.some(step => scope === undefined || step.paths.some(path => within(path, scope))); },
    move(from: string, to: string, options: { record?: boolean } = {}) {
      if (from === to || ![...from.split('.'), ...to.split('.')].every(safe)) return;
      const rename = (path: string) => within(path, from) ? [to + path.slice(from.length)] : within(from, path) ? [path, to] : [path];
      if (depth) {
        before = moveTree(before, from, to, options.record);
        const paths = [...changed].flatMap(rename); changed.clear(); paths.forEach(path => changed.add(path));
      }
      store.batch(() => {
        const previous = state; state = moveTree(state, from, to, options.record);
        let moved = previous !== state;
        for (const step of [...past, ...future]) {
          const paths = step.paths.flatMap(rename);
          moved ||= paths.length !== step.paths.length || paths.some((path, index) => path !== step.paths[index]);
          step.paths = [...new Set(paths)]; step.state = moveTree(step.state, from, to, options.record);
        }
        if (moved) { changed.add(from); changed.add(to); }
      }, { history: false });
    },
    apply(patch: Patch, options: WriteOptions = {}) { if (!plain(patch)) return; store.batch(() => {
      for (const [p, v] of Object.entries(plain(patch.set) ? patch.set! : {})) store.set(p, v);
      for (const [p, v] of Object.entries(plain(patch.merge) ? patch.merge! : {})) change(p, merge(store.get(p), clean(v)));
      for (const p of Array.isArray(patch.delete) ? patch.delete : []) if (typeof p === 'string') change(p, undefined, true);
    }, options); },
    snapshot() { return copy(state); },
    get hydrated() { return !loading; },
    ready: Promise.resolve(),
  };
  function restore(target: any, source: any, paths: string[]) {
    function pathValue(target: any, source: any, keys: string[]): any {
      const [key, ...rest] = keys, absent = source == null || !Object.hasOwn(source, key);
      const value = rest.length ? pathValue(target?.[key], source?.[key], rest) : source?.[key];
      const remove = absent && (!rest.length || value != null && typeof value === 'object' && !Object.keys(value).length);
      const next = write(target, [key], value, remove);
      if (Array.isArray(next) && Array.isArray(source) && next.length > source.length) {
        let length = next.length;
        while (length > source.length && !Object.hasOwn(next, length - 1)) length--;
        if (length !== next.length) { const trimmed = next.slice(); trimmed.length = length; return trimmed; }
      }
      return next;
    }
    for (const path of paths) {
      target = pathValue(target, source, path.split('.'));
    }
    return target;
  }
  function travel(from: HistoryEntry[], to: HistoryEntry[], scope?: string) {
    if (depth || !from.length) return;
    if (scope !== undefined) {
      let index = from.length - 1;
      while (index >= 0 && !from[index].paths.some(path => within(path, scope))) index--;
      if (index < 0) return;
      const step = from[index], paths = step.paths.filter(path => within(path, scope));
      const next = restore(state, step.state, paths);
      for (let i = index + 1; i < from.length; i++) from[i].state = restore(from[i].state, step.state, paths);
      step.paths = step.paths.filter(path => !within(path, scope));
      if (!step.paths.length) from.splice(index, 1);
      to.push({ state, paths }); state = next;
      for (const path of paths) changed.add(path);
      flush(false); return;
    }
    const step = from.pop()!, paths = new Set<string>(step.paths);
    changedPaths(state, step.state, paths);
    to.push({ state, paths: [...paths] }); state = step.state;
    for (const p of paths) changed.add(p);
    flush(false);
  }
  function hydrated() {
    loading = false;
    if (pending.size) { pending.clear(); persist?.save(namespace, copy(state)); }
  }
  function load(data: object) {
    const previous = state; state = merge(state, clean(data)); before = state;
    for (const path of pending) {
      const keys = path.split('.'), parent = read(previous, keys.slice(0, -1));
      state = write(state, keys, read(previous, keys), parent == null || !Object.hasOwn(parent, keys.at(-1)!));
    }
    before = state; hydrated();
    for (const [p, fns] of listeners) if (p === '*' ? previous !== state : !Object.is(read(previous, p.split('.')), store.get(p))) for (const fn of [...fns]) fn();
  }
  if (persist) {
    try {
      const data = persist.load(namespace);
      if (data instanceof Promise) { loading = true; store.ready = data.then(load, hydrated); }
      else load(data);
    } catch { hydrated(); }
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
