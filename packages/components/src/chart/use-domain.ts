import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@prism-ui/react';
function motionProgress(progress: number, easing: string): number {
  const presets: Record<string, string> = { ease: '.25,.1,.25,1', 'ease-in': '.42,0,1,1', 'ease-out': '0,0,.58,1', 'ease-in-out': '.42,0,.58,1' };
  const points = (presets[easing] ?? /^cubic-bezier\((.*)\)$/.exec(easing)?.[1])?.split(',').map(Number);
  if (!points || points.length !== 4 || !points.every(Number.isFinite)) return progress;
  const [x1, y1, x2, y2] = points;
  const sample = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (sample(mid, x1, x2) < progress) lo = mid; else hi = mid; }
  return sample((lo + hi) / 2, y1, y2);
}

type Domain = [number, number];
export function useDomain(target: Domain | null, animate: boolean, duration = 180, easing = 'ease-out') {
  const [display, setDisplay] = useState(target), current = useRef(target);
  const reduced = useReducedMotion();
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
