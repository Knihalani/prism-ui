import { useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MotionContext, ThemeContext } from './theme';
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
  const reduced = useReducedMotion(), theme = useContext(ThemeContext);
  const duration = motionDuration(theme.theme.tokens?.motionSpringDuration ?? '500ms', 500);
  const [value, setValue] = useState(target);
  const state = useRef({ position: target, velocity: 0, time: undefined as number | undefined });
  useEffect(() => {
    const current = state.current;
    if (reduced || !duration || typeof requestAnimationFrame !== 'function') { current.position = target; current.velocity = 0; current.time = undefined; setValue(target); return; }
    let frame = 0;
    const frequency = 2 * Math.PI / (response * duration / 500);
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
  }, [target, response, damping, reduced, duration]);
  return reduced || !duration ? target : value;
}

export function motionDuration(value: string, fallback: number) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? Math.max(0, number * (value.trim().endsWith('ms') ? 1 : 1000)) : fallback;
}

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
export function useCollapse<T extends HTMLElement = HTMLDivElement>(open: boolean, collapsedHeight = 0) {
  const ref = useRef<T>(null), animation = useRef<Animation | null>(null), initialized = useRef(false);
  const initialHeight = useRef(open ? 'auto' : `${collapsedHeight}px`);
  const reduced = useReducedMotion();
  useClientLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const from = element.getBoundingClientRect().height;
    element.inert = !open && !collapsedHeight;
    animation.current?.cancel(); animation.current = null;
    const style = element.ownerDocument.defaultView!.getComputedStyle(element);
    const duration = motionDuration(style.getPropertyValue(open ? '--prism-motion-base' : '--prism-motion-fast'), open ? 240 : 160);
    const easing = style.getPropertyValue(open ? '--prism-motion-ease' : '--prism-motion-ease-exit').trim() || (open ? 'cubic-bezier(.23,1,.32,1)' : 'cubic-bezier(.4,0,1,1)');
    const height = open ? 'auto' : `${collapsedHeight}px`;
    element.style.height = height;
    const to = open ? element.getBoundingClientRect().height : collapsedHeight;
    if (initialized.current && !reduced && duration && from !== to && element.animate) {
      const current = element.animate([{ height: `${from}px`, opacity: from === 0 ? 0 : 1 }, { height: `${to}px`, opacity: open || collapsedHeight ? 1 : 0 }], { duration, easing });
      current.finished?.catch(() => {});
      animation.current = current;
      current.onfinish = () => { if (animation.current === current) { animation.current = null; current.cancel(); element.style.height = height; } };
    }
    initialized.current = true;
  }, [open, collapsedHeight, reduced]);
  useEffect(() => () => { animation.current?.cancel(); }, []);
  return { ref, style: { overflow: 'hidden' as const, height: initialHeight.current }, 'aria-hidden': !open && !collapsedHeight };
}
