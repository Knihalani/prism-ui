import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Store } from '@prism-ui/state';
import { ComponentContext, useStore } from './context';

type Origin = object | string;
const origins = new WeakMap<Store, Origin>();

/** Tag synchronous store writes with their component's identity. */
export function useLocalWrite() {
  const store = useStore(), component = useContext(ComponentContext);
  const origin = component?.receipt ?? component?.id;
  return useCallback(<T>(write: () => T): T => {
    if (origin === undefined) return write();
    const previous = origins.get(store);
    origins.set(store, origin);
    try { return write(); }
    finally {
      if (previous === undefined) origins.delete(store);
      else origins.set(store, previous);
    }
  }, [store, origin]);
}

/** Subscribed paths briefly highlight when another component or the host changes them. */
export function useFlash(path: string | readonly string[]): boolean {
  const store = useStore(), component = useContext(ComponentContext);
  const origin = component?.receipt ?? component?.id;
  const key = JSON.stringify(typeof path === 'string' ? [path] : path);
  const target = useMemo(() => ({ store, paths: JSON.parse(key) as string[], origin }), [store, key, origin]);
  const [flashing, setFlashing] = useState<typeof target>();
  useEffect(() => {
    let previous = target.paths.map(path => target.store.get(path));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      const value = target.paths.map(path => target.store.get(path));
      if (value.every((item, index) => Object.is(item, previous[index]))) return;
      previous = value;
      if (!target.store.hydrated || (target.origin !== undefined && origins.get(target.store) === target.origin)) return;
      clearTimeout(timer);
      setFlashing(target);
      timer = setTimeout(() => setFlashing(undefined), 600);
    };
    const unsubscribe = target.paths.map(path => target.store.subscribe(path, update));
    return () => { unsubscribe.forEach(off => off()); clearTimeout(timer); };
  }, [target]);
  return flashing === target;
}
