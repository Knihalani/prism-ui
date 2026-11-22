import { useLayoutEffect, useRef } from 'react';

export function useFlip(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null), previous = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>(), animations: Animation[] = [];
    const style = ref.current && getComputedStyle(ref.current);
    const durationToken = style?.getPropertyValue('--prism-pick-motion-base').trim() || style?.getPropertyValue('--prism-motion-base').trim() || '0ms';
    const duration = Number.parseFloat(durationToken) * (durationToken.endsWith('ms') ? 1 : 1000);
    const easing = style?.getPropertyValue('--prism-pick-motion-spring').trim() || style?.getPropertyValue('--prism-motion-spring').trim() || 'linear';
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.querySelectorAll<HTMLElement>('[data-option]').forEach(element => {
      const id = element.dataset.option!, rect = element.getBoundingClientRect(), before = previous.current.get(id);
      next.set(id, rect);
      if (enabled && !reduced && duration > 0 && before && element.animate && (before.x !== rect.x || before.y !== rect.y)) {
        animations.push(element.animate([{ transform: `translate(${before.x - rect.x}px, ${before.y - rect.y}px)` }, { transform: 'translate(0, 0)' }], { duration, easing }));
      }
    });
    previous.current = next;
    return () => animations.forEach(animation => animation.cancel());
  });
  return ref;
}
