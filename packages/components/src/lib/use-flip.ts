import { useLayoutEffect, useMemo, useRef } from 'react';
import { createFlip, usePrism } from '@prism-ui/react';

export function useFlip(enabled: boolean, selector = '[data-option]') {
  const ref = useRef<HTMLDivElement>(null), pending = useRef(false), flip = useMemo(() => createFlip(), []);
  const { store } = usePrism();
  const elements = () => Array.from(ref.current?.querySelectorAll(selector) ?? []);
  useLayoutEffect(() => store.subscribe('*', () => {
    if (enabled && !pending.current) {
      flip.measure(elements()); pending.current = true;
      queueMicrotask(() => { if (pending.current) { flip.play(elements()); pending.current = false; } });
    }
  }), [store, enabled, selector, flip]);
  useLayoutEffect(() => {
    if (enabled && pending.current) flip.play(elements());
    else if (!enabled) flip.cancel();
    pending.current = false;
  });
  useLayoutEffect(() => () => { pending.current = false; flip.cancel(); }, [flip]);
  return ref;
}
