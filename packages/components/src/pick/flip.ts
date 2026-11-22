import { useLayoutEffect, useRef } from 'react';

export function useFlip(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null), previous = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>(), animations: Animation[] = [];
    const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-option]') ?? []), order = [...previous.current.keys()];
    const reordered = elements.some((element, index) => element.dataset.option !== order[index]);
    elements.forEach(element => {
      const id = element.dataset.option!, rect = element.getBoundingClientRect(), before = previous.current.get(id);
      next.set(id, rect);
      if (enabled && reordered && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && !element.closest('.prism-root[data-animate="false"]') && before && element.animate && (before.x !== rect.x || before.y !== rect.y)) {
        animations.push(element.animate([{ transform: `translate(${before.x - rect.x}px, ${before.y - rect.y}px)` }, { transform: 'translate(0, 0)' }], { duration: 380, easing: 'cubic-bezier(.22,1.2,.36,1)' }));
      }
    });
    previous.current = next;
    return () => animations.forEach(animation => animation.cancel());
  });
  return ref;
}
