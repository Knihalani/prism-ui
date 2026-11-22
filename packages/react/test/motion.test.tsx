import './setup';
import { expect, test, mock } from 'bun:test';
import { act } from 'react';
import { render, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { ThemeScope, createTheme, spring, useCollapse, useReducedMotion, useSpringValue } from '../src';
import { snappy, bouncy } from '../src/spring';

function values(easing: string) { return easing.slice(7, -1).split(',').map(Number); }
test('spring samples settle at one, critically damped and overdamped curves are monotonic', () => {
  for (const damping of [1, 1.5, 3]) {
    const result = spring({ response: .35, damping });
    const points = values(result.easing);
    expect(points).toHaveLength(40); expect(points[0]).toBe(0); expect(points.at(-1)).toBe(1);
    expect(points.every((value, i) => i === 0 || value >= points[i - 1])).toBe(true);
    expect(result.duration).toBeGreaterThan(0);
    expect(result).toEqual(spring({ response: .35, damping }));
  }
  expect(Math.max(...values(spring({ response: .4, damping: .7 }).easing))).toBeGreaterThan(1);
  expect(values(spring({ response: .4, damping: .7, samples: 2 }).easing)).toEqual([0, 1]);
});
test('invalid spring parameters fail rather than hanging', () => {
  for (const options of [{ response: 0, damping: 1 }, { response: 1, damping: 0 }, { response: Infinity, damping: 1 }, { response: 1, damping: 1, samples: 1 }, { response: 1, damping: 1, samples: 2.5 }]) expect(() => spring(options)).toThrow(RangeError);
});

test('CSS token defaults match generated spring curves and public token names', async () => {
  const css = await Bun.file(new URL('../src/theme.css', import.meta.url)).text();
  const defaults = {
    motionInstant: '90ms', motionFast: '160ms', motionBase: '240ms', motionSlow: '420ms',
    motionEase: 'cubic-bezier(.23,1,.32,1)', motionEaseInOut: 'cubic-bezier(.65,0,.35,1)', motionEaseExit: 'cubic-bezier(.4,0,1,1)',
    motionSpring: snappy.easing, motionSpringDuration: '500ms', motionSpringBouncy: bouncy.easing, motionSpringBouncyDuration: '600ms',
    motionStagger: '28ms', motionDistance: '6px', motionScale: '.97', motionBlur: '2px',
  };
  for (const [name, value] of Object.entries(createTheme(defaults))) expect(css).toContain(`${name}: ${value};`);
  expect(css).toContain('--prism-motion-base: var(--prism-motion-fast) !important');
  expect(css).toContain('--prism-motion-spring-duration: 0ms !important');
});

function fakeFrames() {
  const originalRequest = globalThis.requestAnimationFrame, originalCancel = globalThis.cancelAnimationFrame;
  const callbacks = new Map<number, FrameRequestCallback>();
  let id = 0, time = 0;
  globalThis.requestAnimationFrame = callback => { callbacks.set(++id, callback); return id; };
  globalThis.cancelAnimationFrame = handle => { callbacks.delete(handle); };
  return {
    tick(ms = 16) { time += ms; const pending = [...callbacks.values()]; callbacks.clear(); act(() => pending.forEach(callback => callback(time))); },
    count: () => callbacks.size,
    restore() { globalThis.requestAnimationFrame = originalRequest; globalThis.cancelAnimationFrame = originalCancel; },
  };
}
test('spring value preserves position and velocity when retargeted, settles and cleans up', () => {
  const frames = fakeFrames();
  try {
    const view = renderHook(({ target }) => useSpringValue(target), { initialProps: { target: 0 } });
    expect(frames.count()).toBe(0);
    view.rerender({ target: 100 }); frames.tick(); frames.tick(); frames.tick();
    const position = view.result.current;
    expect(position).toBeGreaterThan(0); expect(position).toBeLessThan(100);
    view.rerender({ target: -100 });
    expect(view.result.current).toBe(position);
    frames.tick(1);
    expect(view.result.current).toBeGreaterThan(position);
    for (let i = 0; i < 200 && frames.count(); i++) frames.tick();
    expect(view.result.current).toBe(-100); expect(frames.count()).toBe(0);
    view.rerender({ target: 50 }); expect(frames.count()).toBe(1);
    view.unmount(); expect(frames.count()).toBe(0);
  } finally { frames.restore(); }
});
test('reduced motion responds to media changes and animate=false, including nested scopes', () => {
  const original = globalThis.matchMedia;
  let matches = false;
  const listeners = new Set<() => void>();
  globalThis.matchMedia = (() => ({ get matches() { return matches; }, addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) })) as unknown as typeof matchMedia;
  const frames = fakeFrames();
  try {
    const view = renderHook(({ target }) => ({ value: useSpringValue(target), reduced: useReducedMotion() }), { initialProps: { target: 0 } });
    expect(view.result.current.reduced).toBe(false);
    view.rerender({ target: 10 }); expect(frames.count()).toBe(1);
    act(() => { matches = true; listeners.forEach(fn => fn()); });
    expect(view.result.current).toEqual({ value: 10, reduced: true }); expect(frames.count()).toBe(0);
    view.rerender({ target: 20 }); expect(view.result.current.value).toBe(20);
    act(() => { matches = false; listeners.forEach(fn => fn()); });
    expect(view.result.current.reduced).toBe(false); view.unmount(); expect(listeners.size).toBe(0);
    const disabled = renderHook(() => ({ reduced: useReducedMotion(), value: useSpringValue(12) }), { wrapper: ({ children }) => <ThemeScope animate={false}><ThemeScope>{children}</ThemeScope></ThemeScope> });
    expect(disabled.result.current).toEqual({ reduced: true, value: 12 }); expect(frames.count()).toBe(0);
  } finally { frames.restore(); globalThis.matchMedia = original; }
});

test('collapse measures visual height before cancel, reverses and restores auto height', () => {
  function Collapse({ open }: { open: boolean }) { return <div {...useCollapse(open)}>Content</div>; }
  const view = render(<Collapse open={false} />);
  const node = view.container.firstElementChild as HTMLElement;
  let visual: number | undefined;
  const order: string[] = [];
  node.getBoundingClientRect = () => { order.push('measure'); return { height: visual ?? (node.style.height === 'auto' ? 100 : 0) } as DOMRect; };
  const animations: { cancel: ReturnType<typeof mock>; onfinish: (() => void) | null }[] = [];
  node.animate = mock(() => { const animation = { cancel: mock(() => { order.push('cancel'); visual = undefined; }), onfinish: null }; animations.push(animation); return animation as unknown as Animation; });
  view.rerender(<Collapse open />);
  expect(node.animate).toHaveBeenLastCalledWith([{ height: '0px', opacity: 0 }, { height: '100px', opacity: 1 }], { duration: 240, easing: 'cubic-bezier(.23,1,.32,1)' });
  visual = 45; order.length = 0;
  view.rerender(<Collapse open={false} />);
  expect(order.slice(0, 2)).toEqual(['measure', 'cancel']);
  expect(node.animate).toHaveBeenLastCalledWith([{ height: '45px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 240, easing: 'cubic-bezier(.23,1,.32,1)' });
  expect(node.inert).toBe(true);
  animations.at(-1)!.onfinish!(); expect(node.style.height).toBe('0px');
  view.rerender(<Collapse open />); animations.at(-1)!.onfinish!(); expect(node.style.height).toBe('auto');
  expect(node.inert).toBe(false);
  view.unmount();
});
test('collapse is instant with animate=false and hooks render on the server', () => {
  function Collapse({ open }: { open: boolean }) { const props = useCollapse(open); const value = useSpringValue(5); return <div {...props}>{value}</div>; }
  const view = render(<ThemeScope animate={false}><Collapse open={false} /></ThemeScope>);
  const node = view.container.querySelector('[aria-hidden]') as HTMLElement;
  node.animate = mock();
  view.rerender(<ThemeScope animate={false}><Collapse open /></ThemeScope>);
  expect(node.style.height).toBe('auto'); expect(node.animate).not.toHaveBeenCalled();
  expect(renderToString(<Collapse open />)).toContain('5');
});
