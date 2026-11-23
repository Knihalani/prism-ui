import { useCallback, useLayoutEffect, useRef } from 'react';
import { createFlip, useReducedMotion } from '@prism-ui/react';

export function useFlip(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null), flip = useRef<ReturnType<typeof createFlip> | null>(null), pending = useRef(false);
  const reduced = useReducedMotion();
  const elements = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-option]') ?? []);
  const measure = useCallback(() => {
    if (!ref.current) { flip.current?.cancel(); return; }
    const style = getComputedStyle(ref.current);
    const token = style.getPropertyValue('--prism-pick-motion-base').trim() || style.getPropertyValue('--prism-motion-spring-duration').trim() || style.getPropertyValue('--prism-motion-base').trim() || '0ms';
    const next = createFlip({ duration: enabled && !reduced ? parseFloat(token) * (token.endsWith('ms') ? 1 : 1000) || 0 : 0, easing: style.getPropertyValue('--prism-pick-motion-spring').trim() || style.getPropertyValue('--prism-motion-spring').trim() || undefined });
    next.measure(elements());
    flip.current?.cancel();
    flip.current = next;
    pending.current = true;
  }, [enabled, reduced]);
  useLayoutEffect(() => { if (pending.current) { pending.current = false; if (enabled && !reduced) flip.current?.play(elements()); else flip.current?.cancel(); } });
  useLayoutEffect(() => () => flip.current?.cancel(), [enabled, reduced]);
  return { ref, measure };
}
