import { useLayoutEffect, useMemo, useRef } from 'react';
import { createFlip, usePrism } from '@prism-ui/react';

export function useFlip<T extends HTMLElement = HTMLDivElement>(enabled: boolean, selector = '[data-option]') {
  const ref = useRef<T>(null), pending = useRef(false), flip = useMemo(() => createFlip(), []);
  const frame = useRef<number | undefined>(undefined);
  const { store } = usePrism();
  const elements = () => Array.from(ref.current?.querySelectorAll(selector) ?? []);
  useLayoutEffect(() => store.subscribe('*', () => {
    if (!pending.current) {
      flip.measure(elements()); pending.current = true;
      frame.current = requestAnimationFrame(() => { if (pending.current) { if (enabled) flip.play(elements()); else flip.cancel(); pending.current = false; } });
    }
  }), [store, enabled, selector, flip]);
  useLayoutEffect(() => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    if (enabled && pending.current) flip.play(elements());
    else if (!enabled) flip.cancel();
    pending.current = false;
  });
  useLayoutEffect(() => () => { if (frame.current !== undefined) cancelAnimationFrame(frame.current); pending.current = false; flip.cancel(); }, [flip]);
  return ref;
}
