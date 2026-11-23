import './setup';
import { afterEach, expect, spyOn, test } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';
import { Prism, createRegistry } from '../src';
import { mixedStream } from '../../core/test/stream-fixture';

afterEach(cleanup);
test('only top-level markdown blocks receive stable enter markers when motion is enabled', () => {
  const registry = createRegistry(), view = render(<Prism registry={registry} source={mixedStream + '\n---\n'} done={false} />);
  const root = view.container.querySelector('[data-prism-flow]')!;
  Array.from(root.children).filter(child => child.getAttribute('data-prism') !== 'unknown').forEach(child => {
    expect(child.hasAttribute('data-prism-enter')).toBe(true);
    expect(child.querySelector('[data-prism-enter]')).toBeNull();
  });
  const heading = root.firstElementChild;
  view.rerender(<Prism registry={registry} source={mixedStream + '\n---\n\nTail'} done={false} />);
  expect(root.firstElementChild).toBe(heading);
  view.rerender(<Prism registry={registry} source={mixedStream} animate={false} />);
  expect(view.container.querySelector('[data-prism-enter]')).toBeNull();
});
for (let size = 1; size <= 7; size++) {
  test(`streamed DOM matches static DOM with ${size}-character chunks and published previews`, async () => {
    let frame: FrameRequestCallback | undefined;
    const raf = globalThis.requestAnimationFrame, cancel = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = callback => { frame = callback; return 1; };
    globalThis.cancelAnimationFrame = () => { frame = undefined; };
    const errors = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const staticView = render(<Prism source={mixedStream} />), html = staticView.container.innerHTML;
      staticView.unmount();
      let controller!: ReadableStreamDefaultController<string>;
      const stream = new ReadableStream<string>({ start(value) { controller = value; } });
      const view = render(<Prism stream={stream} />);
      for (let i = 0; i < mixedStream.length; i += size) {
        await act(async () => {
          controller.enqueue(mixedStream.slice(i, i + size));
          await Promise.resolve();
          const publish = frame; frame = undefined; publish?.(0);
        });
      }
      await act(async () => { controller.close(); });
      const normalize = (html: string) => {
        const element = document.createElement('div'); element.innerHTML = html;
        element.querySelectorAll('*').forEach(node => {
          for (const name of ['data-prism-enter', 'data-prism-entered', 'data-entering']) node.removeAttribute(name);
          (node as HTMLElement).style.removeProperty('--prism-motion-index');
          if (!node.getAttribute('style')) node.removeAttribute('style');
        });
        return element.innerHTML;
      };
      expect(normalize(view.container.innerHTML)).toBe(normalize(html));
      expect(errors.mock.calls.filter(args => String(args[0]).includes('same key'))).toHaveLength(0);
    } finally { errors.mockRestore(); globalThis.requestAnimationFrame = raf; globalThis.cancelAnimationFrame = cancel; }
  });
}
