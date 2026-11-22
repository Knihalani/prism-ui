import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

export function motionProgress(progress: number, easing: string): number {
  const presets: Record<string, string> = { ease: '.25,.1,.25,1', 'ease-in': '.42,0,1,1', 'ease-out': '0,0,.58,1', 'ease-in-out': '.42,0,.58,1' };
  const points = (presets[easing] ?? /^cubic-bezier\((.*)\)$/.exec(easing)?.[1])?.split(',').map(Number);
  if (!points || points.length !== 4 || !points.every(Number.isFinite)) return progress;
  const [x1, y1, x2, y2] = points;
  const sample = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (sample(mid, x1, x2) < progress) lo = mid; else hi = mid; }
  return sample((lo + hi) / 2, y1, y2);
}

export function useNumberTween(result: number, enabled: boolean, root: RefObject<HTMLElement | null>) {
  const [display, setDisplay] = useState(result), shown = useRef(result), [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia('(prefers-reduced-motion: reduce)'), update = () => setReduced(query.matches);
    update(); query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  useLayoutEffect(() => {
    const style = root.current && getComputedStyle(root.current);
    const token = style?.getPropertyValue('--prism-calc-motion-base').trim() || style?.getPropertyValue('--prism-motion-base').trim() || '0ms';
    const duration = parseFloat(token) * (token.endsWith('ms') ? 1 : 1000);
    const easing = style?.getPropertyValue('--prism-calc-motion-spring').trim() || style?.getPropertyValue('--prism-motion-spring').trim() || 'linear';
    if (!enabled || reduced || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || !(duration > 0) || !Number.isFinite(result) || !Number.isFinite(shown.current)) { shown.current = result; setDisplay(result); return; }
    const start = performance.now(), from = shown.current; let frame: number;
    const tick = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - start) / duration));
      shown.current = progress === 1 ? result : from + (result - from) * motionProgress(progress, easing);
      setDisplay(shown.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    if (Object.is(from, result)) return;
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [result, enabled, reduced, root]);
  return enabled && !reduced && Number.isFinite(display) ? display : result;
}
