import './setup';
import { expect, test } from 'bun:test';
import { act, renderHook } from '@testing-library/react';
import { useDomain } from './use-domain';

test('domain animation interpolates, retargets, snaps without motion, and cancels on unmount', () => {
  const raf = globalThis.requestAnimationFrame, cancel = globalThis.cancelAnimationFrame, media = globalThis.matchMedia;
  let serial = 0;
  const frames = new Map<number, FrameRequestCallback>();
  globalThis.requestAnimationFrame = callback => { frames.set(++serial, callback); return serial; };
  globalThis.cancelAnimationFrame = id => { frames.delete(id); };
  globalThis.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof matchMedia;
  const step = (time: number) => act(() => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)); });
  try {
    const view = renderHook(({ target, animate }) => useDomain(target, animate), { initialProps: { target: [0, 40000] as [number, number], animate: true } });
    view.rerender({ target: [0, 80000], animate: true });
    expect(view.result.current[1]).toBe(40000);
    step(0); step(90);
    expect(view.result.current[1]).toBeGreaterThan(40000);
    expect(view.result.current[1]).toBeLessThan(80000);
    view.rerender({ target: [0, 140000], animate: true });
    step(100); step(280);
    expect(view.result.current).toEqual([0, 140000]);
    view.rerender({ target: [0, 100000], animate: false });
    expect(view.result.current).toEqual([0, 100000]);
    globalThis.matchMedia = (() => ({ matches: true, addEventListener() {}, removeEventListener() {} })) as unknown as typeof matchMedia;
    view.rerender({ target: [0, 200000], animate: true });
    expect(view.result.current).toEqual([0, 200000]);
    globalThis.matchMedia = (() => ({ matches: false })) as unknown as typeof matchMedia;
    view.rerender({ target: [0, 300000], animate: true });
    view.unmount();
    expect(frames.size).toBe(0);
  } finally { globalThis.requestAnimationFrame = raf; globalThis.cancelAnimationFrame = cancel; globalThis.matchMedia = media; }
});
