import { useCallback, useContext, useLayoutEffect, useMemo, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
import { compile, type Formula } from '@prism-ui/state';
import { ComponentContext, message, usePrism, useStore, type Action } from './context';
import { useLocalWrite } from './flash';

export function useStoreValue<T = unknown>(path: string): T {
  const store = useStore();
  const subscribe = useCallback((fn: () => void) => store.subscribe(path, fn), [store, path]);
  const snapshot = useCallback(() => store.get(path) as T, [store, path]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
export function useComponentState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const component = useContext(ComponentContext); if (!component) throw Error('Component provider required');
  const store = useStore(), path = component.id + '.' + key, [fallback] = useState(initial);
  const localWrite = useLocalWrite();
  const current = useStoreValue<T | undefined>(path);
  useLayoutEffect(() => { if (store.get(path) === undefined) localWrite(() => store.set(path, fallback)); }, [store, path, fallback, localWrite]);
  const set = useCallback<Dispatch<SetStateAction<T>>>(value => {
    localWrite(() => store.update(path, (old: T | undefined) => typeof value === 'function' ? (value as (value: T) => T)(old === undefined ? fallback : old) : value));
  }, [store, path, fallback, localWrite]);
  return [current === undefined ? fallback : current, set];
}
export function useFormula(expr: string): number {
  const store = useStore();
  const formula = useMemo<Formula>(() => { try { return compile(expr); } catch { return Object.assign(() => NaN, { deps: [] }); } }, [expr]);
  const subscribe = useCallback((fn: () => void) => { const offs = formula.deps.map(path => store.subscribe(path, fn)); return () => offs.forEach(off => off()); }, [store, formula]);
  const snapshot = useCallback(() => { try { return formula(store.get); } catch { return NaN; } }, [store, formula]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
export function useActionDispatch() {
  const prism = usePrism(), component = useContext(ComponentContext);
  if (!component) throw Error('Component provider required');
  return useCallback((type: string, payload?: unknown, explicit?: string, delivered?: (action: Action) => void) => {
    const { name, id, props, def } = component;
    const action: Action = { type, component: name, id, payload, context: { component: name, props, state: prism.store.get(id) }, message: '' };
    action.message = explicit ?? def?.message?.(action) ?? message(action); prism.emit(action, delivered);
  }, [prism, component]);
}
export function useEmit(): (type: string, payload?: unknown, explicit?: string) => void {
  return useActionDispatch();
}
