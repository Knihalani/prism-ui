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

/** A path briefly highlights when another component or the host changes it. */
export function useFlash(path: string): boolean {
  const store = useStore(), component = useContext(ComponentContext);
  const origin = component?.receipt ?? component?.id;
  const target = useMemo(() => ({ store, path, origin }), [store, path, origin]);
  const [flashing, setFlashing] = useState<typeof target>();
  useEffect(() => {
    let previous = target.store.get(target.path);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = target.store.subscribe(target.path, () => {
      const value = target.store.get(target.path);
      if (Object.is(value, previous)) return;
      previous = value;
      if (!target.store.hydrated || (target.origin !== undefined && origins.get(target.store) === target.origin)) return;
      clearTimeout(timer);
      setFlashing(target);
      timer = setTimeout(() => setFlashing(undefined), 600);
    });
    return () => { unsubscribe(); clearTimeout(timer); };
  }, [target]);
  return flashing === target;
}
