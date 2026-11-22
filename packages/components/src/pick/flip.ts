import { useEffect, useLayoutEffect, useRef } from 'react';
import { createFlip } from '../shared';

export function useFlip(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<ReturnType<typeof createFlip> | undefined>(undefined), running = useRef<ReturnType<typeof createFlip> | undefined>(undefined);
  const order = useRef('');
  useLayoutEffect(() => {
    running.current?.cancel();
    const elements = new Map(Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-option]') ?? [], element => [element.dataset.option!, element]));
    const nextOrder = JSON.stringify([...elements.keys()]);
    const next = createFlip({ duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', reducedMotion: enabled ? 'auto' : true });
    next.measure(elements);
    if (enabled && order.current !== nextOrder) {
      previous.current?.play(elements);
      running.current = previous.current;
      if (ref.current) ref.current.scrollLeft = 0;
    }
    order.current = nextOrder;
    previous.current = next;
  });
  useEffect(() => () => { running.current?.cancel(); previous.current?.cancel(); }, []);
  return ref;
}
