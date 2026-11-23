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
    expect(observe).toHaveBeenCalledTimes(1); expect(observe).toHaveBeenCalledWith(node);
    act(() => { resize(); resize(); }); tick();
    expect(top).toBe(400); expect(writes).toBe(1); expect(node.style.overflowAnchor).toBe('none');
    expect(node.style.scrollbarGutter).toBe('stable');
    act(() => node.dispatchEvent(new Event('scroll')));
    height = 700; act(resize); tick(); expect(top).toBe(600);
    act(resize); tick(); expect(writes).toBe(2);
    act(() => node.dispatchEvent(new WheelEvent('wheel', { deltaY: -20 })));
    expect(frame).toBeUndefined();
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
    expect(latest.following).toBe(true);
    tick(); expect(top).toBe(800);
    act(() => node.dispatchEvent(new Event('pointerdown')));
    act(() => { top = 200; node.dispatchEvent(new Event('scroll')); });
    expect(latest.following).toBe(false); expect(frame).toBeUndefined();
    act(() => node.ownerDocument.dispatchEvent(new Event('pointerup')));
    act(() => latest.jumpToLatest()); tick();
    act(() => { top = 200; node.dispatchEvent(new Event('scroll')); });
    expect(latest.following).toBe(true);
    act(() => node.firstElementChild!.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    act(() => node.dispatchEvent(new Event('scroll')));
    expect(latest.following).toBe(true);
    act(() => node.dispatchEvent(new Event('pointerdown')));
    act(() => node.ownerDocument.dispatchEvent(new Event('pointercancel')));
    act(() => node.dispatchEvent(new Event('scroll')));
    expect(latest.following).toBe(true);
    act(() => latest.jumpToLatest());
    view.unmount(); expect(frame).toBeUndefined(); expect(disconnect).toHaveBeenCalled();
    expect(node.style.scrollbarGutter).toBe('');
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

test('small upward gestures stay paused until moving downward near the bottom or reaching it', () => {
  const original = { raf: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame };
  let frame: FrameRequestCallback | undefined, latest!: ReturnType<typeof useFollowScroll>;
  globalThis.requestAnimationFrame = callback => { frame = callback; return 1; };
  globalThis.cancelAnimationFrame = () => { frame = undefined; };
  function Surface() { const ref = useRef<HTMLDivElement>(null); latest = useFollowScroll(ref); return <div ref={ref} />; }
  const touch = (node: HTMLElement, type: string, y: number) => {
    const event = new Event(type); Object.defineProperty(event, 'touches', { value: [{ clientY: y }] }); node.dispatchEvent(event);
  };
  try {
    const view = render(<Surface />), node = view.container.firstElementChild as HTMLElement;
    Object.defineProperties(node, { scrollHeight: { value: 1000 }, clientHeight: { value: 100 } });
    for (const gesture of ['wheel', 'touch']) {
      act(() => { latest.jumpToLatest(); const tick = frame; frame = undefined; tick?.(0); });
      expect(node.scrollTop).toBe(900);
      act(() => {
        if (gesture === 'wheel') node.dispatchEvent(new WheelEvent('wheel', { deltaY: -20 }));
        else { touch(node, 'touchstart', 100); touch(node, 'touchmove', 120); }
        node.scrollTop = 880; node.dispatchEvent(new Event('scroll'));
      });
      expect(latest.following).toBe(false); expect(frame).toBeUndefined(); expect(node.scrollTop).toBe(880);
      act(() => node.dispatchEvent(new Event('scroll')));
      expect(latest.following).toBe(false);
      act(() => { node.scrollTop = 885; node.dispatchEvent(new Event('scroll')); });
      expect(latest.following).toBe(true);
    }
    act(() => { node.dispatchEvent(new WheelEvent('wheel', { deltaY: -20 })); node.scrollTop = 899; node.dispatchEvent(new Event('scroll')); });
    expect(latest.following).toBe(true);
    view.unmount(); expect(frame).toBeUndefined();
  } finally { globalThis.requestAnimationFrame = original.raf; globalThis.cancelAnimationFrame = original.cancel; }
});

test('only upward wheel, touch and non-editing keys stop following; existing gutters survive cleanup', () => {
  let latest!: ReturnType<typeof useFollowScroll>;
  function Surface() { const ref = useRef<HTMLDivElement>(null); latest = useFollowScroll(ref); return <div ref={ref} style={{ scrollbarGutter: 'stable both-edges' }}><input /><textarea /><select /><span contentEditable="plaintext-only" /></div>; }
  const view = render(<Surface />), node = view.container.firstElementChild as HTMLElement;
  node.addEventListener('keydown', event => event.stopPropagation());
  const key = (target: Element, value: string, shiftKey = false) => act(() => { target.dispatchEvent(new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true })); });
  const touch = (type: string, clientY: number) => act(() => {
    const event = new Event(type); Object.defineProperty(event, 'touches', { value: [{ clientY }] }); node.dispatchEvent(event);
  });
  expect(node.style.scrollbarGutter).toBe('stable both-edges');
  for (const target of Array.from(node.children)) {
    for (const value of ['ArrowUp', 'PageUp', 'Home', ' ']) key(target, value, true);
    expect(latest.following).toBe(true);
  }
  for (const value of ['ArrowDown', 'PageDown', 'End', ' ']) key(node, value);
  act(() => node.dispatchEvent(new WheelEvent('wheel', { deltaY: 20 })));
  touch('touchstart', 100); touch('touchmove', 80);
  expect(latest.following).toBe(true);
  touch('touchmove', 90); expect(latest.following).toBe(false);
  for (const value of ['ArrowUp', 'PageUp', 'Home', ' ']) {
    act(() => latest.jumpToLatest()); key(node, value, value === ' '); expect(latest.following).toBe(false);
  }
  view.unmount(); expect(node.style.scrollbarGutter).toBe('stable both-edges');
});

test('mutations restart one bounded settle loop without observing content elements', () => {
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
    expect(watch).toHaveBeenCalledWith(node, { childList: true, characterData: true, attributes: true, subtree: true });
    tick();
    for (let i = 0; i < 24; i++) tick();
    expect(frame).toBeUndefined();
    request.mockClear(); observe.mockClear(); disconnect.mockClear();
    node.firstChild!.textContent += ' streamed'; height = 300;
    const notify = (type: string, target: Node) => mutated([{ type, target } as MutationRecord], {} as MutationObserver);
    act(() => { notify('characterData', node.firstChild!); notify('characterData', node.firstChild!); });
    expect(request).toHaveBeenCalledTimes(1); tick(); expect(top).toBe(200);
    height = 350; tick(); expect(top).toBe(250);
    for (let i = 0; i < 23; i++) tick();
    expect(frame).toBeDefined();
    height = 400; tick(); expect(top).toBe(300);
    for (let i = 0; i < 24; i++) tick();
    expect(frame).toBeUndefined();
    const child = document.createElement('span'); node.append(child);
    act(() => notify('childList', node)); tick();
    expect(observe).not.toHaveBeenCalled(); expect(disconnect).not.toHaveBeenCalled();
    observe.mockClear(); disconnect.mockClear(); request.mockClear();
    child.textContent = 'Nested text'; height = 500;
    act(() => notify('childList', child)); tick(); expect(top).toBe(400);
    child.style.height = '600px'; height = 600;
    act(() => notify('attributes', child)); tick(); expect(top).toBe(500);
    expect(observe).not.toHaveBeenCalled(); expect(disconnect).not.toHaveBeenCalled();
    view.unmount();
  } finally {
    globalThis.ResizeObserver = original.observer; globalThis.MutationObserver = original.mutations;
    globalThis.requestAnimationFrame = original.raf; globalThis.cancelAnimationFrame = original.cancel;
  }
});
