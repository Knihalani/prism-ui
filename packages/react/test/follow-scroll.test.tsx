import './setup';
import { expect, mock, test } from 'bun:test';
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { useFollowScroll } from '../src';

test('follow scroll observes height, coalesces writes, respects intent, resumes and disconnects', () => {
  const original = { observer: globalThis.ResizeObserver, raf: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame };
  let frame: FrameRequestCallback | undefined, resize!: () => void, latest!: ReturnType<typeof useFollowScroll>;
  const observe = mock(), disconnect = mock();
  globalThis.requestAnimationFrame = callback => { frame = callback; return 1; };
  globalThis.cancelAnimationFrame = () => { frame = undefined; };
  globalThis.ResizeObserver = class { constructor(callback: () => void) { resize = callback; } observe = observe; disconnect = disconnect; } as unknown as typeof ResizeObserver;
  function Surface() { const ref = useRef<HTMLDivElement>(null); latest = useFollowScroll(ref); return <div ref={ref}><article>Content</article></div>; }
  const tick = () => act(() => { const callback = frame; frame = undefined; callback?.(0); });
  try {
    const view = render(<Surface />), node = view.container.firstElementChild as HTMLElement;
    let height = 500, top = 0, writes = 0;
    Object.defineProperties(node, {
      scrollHeight: { get: () => height }, clientHeight: { get: () => 100 },
      scrollTop: { get: () => top, set: value => { top = value; writes++; }, configurable: true },
    });
    expect(observe).toHaveBeenCalledWith(node.firstElementChild);
    act(() => { resize(); resize(); }); tick();
    expect(top).toBe(400); expect(writes).toBe(1); expect(node.style.overflowAnchor).toBe('none');
    act(() => node.dispatchEvent(new Event('scroll')));
    height = 700; act(resize); tick(); expect(top).toBe(600);
    act(resize); tick(); expect(writes).toBe(2);
    act(() => node.dispatchEvent(new WheelEvent('wheel', { deltaY: -20 })));
    expect(latest.following).toBe(false); expect(node.style.overflowAnchor).toBe('');
    height = 900; act(resize); tick(); expect(top).toBe(600);
    act(() => { top = 700; node.dispatchEvent(new Event('scroll')); });
    expect(latest.following).toBe(false);
    act(() => { top = 800; node.dispatchEvent(new Event('scroll')); });
    expect(latest.following).toBe(true);
    act(() => node.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp' })));
    expect(latest.following).toBe(false);
    act(() => latest.jumpToLatest()); tick(); expect(latest.following).toBe(true);
    act(() => { top = 200; node.dispatchEvent(new Event('scroll')); });
    expect(latest.following).toBe(false);
    act(() => latest.jumpToLatest());
    view.unmount(); expect(frame).toBeUndefined(); expect(disconnect).toHaveBeenCalled();
  } finally {
    globalThis.ResizeObserver = original.observer; globalThis.requestAnimationFrame = original.raf; globalThis.cancelAnimationFrame = original.cancel;
  }
});

test('empty scroll refs are safe and attach when a scroller appears', () => {
  function Surface({ show }: { show: boolean }) { const ref = useRef<HTMLDivElement>(null); useFollowScroll(ref); return show ? <div ref={ref} /> : null; }
  const view = render(<Surface show={false} />);
  view.rerender(<Surface show />);
  expect(view.container.firstElementChild).not.toBeNull();
  view.rerender(<Surface show={false} />);
});
