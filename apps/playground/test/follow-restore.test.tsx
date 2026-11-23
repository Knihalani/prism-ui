import '../../../packages/react/test/setup';
import { expect, test } from 'bun:test';
import { act, fireEvent, render } from '@testing-library/react';
import { usePlaygroundController, type PlaygroundController } from '../src/usePlayground';

test('switching from a following chat restores a paused chat without losing its reading position', () => {
  const original = { raf: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame };
  let frame: FrameRequestCallback | undefined, controller!: PlaygroundController;
  globalThis.requestAnimationFrame = callback => { frame = callback; return 1; };
  globalThis.cancelAnimationFrame = () => { frame = undefined; };
  function Surface() {
    const c = controller = usePlaygroundController({});
    return <div ref={node => {
      c.scroll.current = node;
      if (node) Object.defineProperties(node, { scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 100 } });
    }} onScroll={event => { c.current.scroll = event.currentTarget.scrollTop; }} />;
  }
  const tick = () => act(() => { const callback = frame; frame = undefined; callback?.(0); });
  try {
    const view = render(<Surface />), node = view.container.firstElementChild as HTMLElement;
    tick();
    fireEvent.wheel(node, { deltaY: -50 });
    node.scrollTop = 850; fireEvent.scroll(node);
    const paused = controller.current;
    expect(paused.following).toBe(false); expect(paused.scroll).toBe(850);
    act(() => controller.newChat()); tick();
    const following = controller.current;
    expect(controller.following).toBe(true);
    act(() => controller.switchTo(paused));
    fireEvent.scroll(node); tick();
    expect(controller.following).toBe(false); expect(paused.following).toBe(false);
    expect(node.scrollTop).toBe(850); expect(paused.scroll).toBe(850); expect(frame).toBeUndefined();
    act(() => controller.switchTo(following)); tick();
    expect(controller.following).toBe(true); expect(node.scrollTop).toBe(900);
    view.unmount(); expect(frame).toBeUndefined();
  } finally { globalThis.requestAnimationFrame = original.raf; globalThis.cancelAnimationFrame = original.cancel; }
});
