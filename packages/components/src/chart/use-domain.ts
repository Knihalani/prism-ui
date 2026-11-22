import { useEffect, useRef, useState } from 'react';
import { motionProgress } from '../num/use-tween';

type Domain = [number, number];
export function useDomain(target: Domain | null, animate: boolean, duration = 180, easing = 'ease-out') {
  const [display, setDisplay] = useState(target), current = useRef(target);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const moving = animate && !reduced && duration > 0 && typeof requestAnimationFrame === 'function';
  useEffect(() => {
    const start = current.current;
    if (!target || !start || !moving) { current.current = target; setDisplay(target); return; }
    let frame = 0, began: number | undefined;
    const tick = (time: number) => {
      began ??= time;
      const progress = Math.min(1, (time - began) / duration), eased = progress === 1 ? 1 : motionProgress(progress, easing);
      current.current = [start[0] + (target[0] - start[0]) * eased, start[1] + (target[1] - start[1]) * eased];
      setDisplay(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target?.[0], target?.[1], moving, duration, easing]);
  return moving ? display ?? target ?? [0, 1] as Domain : target ?? [0, 1] as Domain;
}
