import { useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MotionContext } from './theme';
import { PrismContext } from './context';
export { spring } from './spring';
export type { SpringOptions } from './spring';
export { createFlip } from './flip';
export type { FlipOptions, FlipElements } from './flip';

const mediaQuery = '(prefers-reduced-motion: reduce)';
const snapshot = () => typeof matchMedia === 'function' && matchMedia(mediaQuery).matches;
const subscribe = (notify: () => void) => {
  if (typeof matchMedia !== 'function') return () => {};
  const media = matchMedia(mediaQuery);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
export function useReducedMotion(): boolean {
  const enabled = useContext(MotionContext), prism = useContext(PrismContext);
  const reduced = useSyncExternalStore(subscribe, snapshot, () => false);
  return reduced || !enabled || prism?.animate === false;
}

export interface SpringValueOptions { response?: number; damping?: number }
export function useSpringValue(target: number, { response = .35, damping = .85 }: SpringValueOptions = {}): number {
  if (!Number.isFinite(target) || !Number.isFinite(response) || response <= 0 || !Number.isFinite(damping) || damping <= 0) throw new RangeError('Invalid spring value');
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  const state = useRef({ position: target, velocity: 0, time: undefined as number | undefined });
  useEffect(() => {
    const current = state.current;
    if (reduced || typeof requestAnimationFrame !== 'function') { current.position = target; current.velocity = 0; current.time = undefined; setValue(target); return; }
    let frame = 0;
    const frequency = 2 * Math.PI / response;
    const tick = (time: number) => {
      let remaining = current.time === undefined ? 0 : Math.min((time - current.time) / 1000, .064);
      current.time = time;
      while (remaining > 0) {
        const dt = Math.min(remaining, .001, 1 / (frequency * Math.max(1, damping) * 20));
        current.velocity += ((target - current.position) * frequency ** 2 - 2 * damping * frequency * current.velocity) * dt;
        current.position += current.velocity * dt; remaining -= dt;
      }
      if (Math.abs(current.position - target) < .001 && Math.abs(current.velocity) < .001) {
        current.position = target; current.velocity = 0; current.time = undefined; setValue(target); return;
      }
      setValue(current.position); frame = requestAnimationFrame(tick);
    };
    if (current.position !== target || current.velocity) frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, response, damping, reduced]);
  return reduced ? target : value;
}

export function motionDuration(value: string, fallback: number) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? Math.max(0, number * (value.trim().endsWith('ms') ? 1 : 1000)) : fallback;
}

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
export function useCollapse<T extends HTMLElement = HTMLDivElement>(open: boolean) {
  const ref = useRef<T>(null), animation = useRef<Animation | null>(null), initialized = useRef(false);
  const initialOpen = useRef(open);
  const reduced = useReducedMotion();
  useClientLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const from = element.getBoundingClientRect().height;
    element.inert = !open;
    animation.current?.cancel(); animation.current = null;
    const style = element.ownerDocument.defaultView!.getComputedStyle(element);
    const duration = motionDuration(style.getPropertyValue('--prism-motion-base'), 240);
    const easing = style.getPropertyValue('--prism-motion-ease').trim() || 'cubic-bezier(.23,1,.32,1)';
    element.style.height = open ? 'auto' : '0px';
    const to = open ? element.getBoundingClientRect().height : 0;
    if (initialized.current && !reduced && duration && from !== to && element.animate) {
      const current = element.animate([{ height: `${from}px`, opacity: from === 0 ? 0 : 1 }, { height: `${to}px`, opacity: open ? 1 : 0 }], { duration, easing });
      animation.current = current;
      current.onfinish = () => { if (animation.current === current) { animation.current = null; current.cancel(); element.style.height = open ? 'auto' : '0px'; } };
    }
    initialized.current = true;
  }, [open, reduced]);
  useEffect(() => () => { animation.current?.cancel(); }, []);
  return { ref, style: { overflow: 'hidden' as const, height: initialOpen.current ? 'auto' : '0px' }, 'aria-hidden': !open };
}
