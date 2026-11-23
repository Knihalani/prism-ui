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

test('direct streaming text follows mutations without rebuilding resize observations', () => {
  const original = { observer: globalThis.ResizeObserver, mutations: globalThis.MutationObserver, raf: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame };
  let frame: FrameRequestCallback | undefined, mutated!: MutationCallback;
  const observe = mock(), disconnect = mock(), watch = mock(), request = mock((callback: FrameRequestCallback) => { frame = callback; return 1; });
  globalThis.requestAnimationFrame = request;
  globalThis.cancelAnimationFrame = () => { frame = undefined; };
  globalThis.ResizeObserver = class { observe = observe; disconnect = disconnect; } as unknown as typeof ResizeObserver;
  globalThis.MutationObserver = class { constructor(callback: MutationCallback) { mutated = callback; } observe = watch; disconnect() {} } as unknown as typeof MutationObserver;
  function Surface() { const ref = useRef<HTMLDivElement>(null); useFollowScroll(ref); return <div ref={ref} style={{ height: 100, overflow: 'auto' }}>First</div>; }
  const tick = () => act(() => { const callback = frame; frame = undefined; callback?.(0); });
  try {
    const view = render(<Surface />), node = view.container.firstElementChild as HTMLElement;
    let height = 100, top = 0;
    Object.defineProperties(node, { scrollHeight: { get: () => height }, clientHeight: { get: () => 100 }, scrollTop: { get: () => top, set: value => { top = value; } } });
    expect(watch).toHaveBeenCalledWith(node, { childList: true, characterData: true, subtree: true });
    tick(); request.mockClear(); observe.mockClear(); disconnect.mockClear();
    node.firstChild!.textContent += ' streamed'; height = 300;
    const notify = (type: string, target: Node) => mutated([{ type, target } as MutationRecord], {} as MutationObserver);
    act(() => { notify('characterData', node.firstChild!); notify('characterData', node.firstChild!); });
    expect(request).toHaveBeenCalledTimes(1); tick(); expect(top).toBe(200);
    const child = document.createElement('span'); node.append(child);
    act(() => notify('childList', node)); tick();
    expect(observe).toHaveBeenCalledWith(child); expect(disconnect).toHaveBeenCalledTimes(1);
    observe.mockClear(); disconnect.mockClear(); request.mockClear();
    child.textContent = 'Nested text'; height = 500;
    act(() => notify('childList', child)); tick(); expect(top).toBe(400);
    expect(observe).not.toHaveBeenCalled(); expect(disconnect).not.toHaveBeenCalled();
    view.unmount();
  } finally {
    globalThis.ResizeObserver = original.observer; globalThis.MutationObserver = original.mutations;
    globalThis.requestAnimationFrame = original.raf; globalThis.cancelAnimationFrame = original.cancel;
  }
});
