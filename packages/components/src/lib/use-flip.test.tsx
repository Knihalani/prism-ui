import '../../../react/test/setup';
import { expect, mock, test } from 'bun:test';
import { act, render } from '@testing-library/react';
import { Prism, createRegistry } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { useFlip } from './use-flip';

for (const enabled of [true, false]) test(`shared FLIP waits for the committed layout and cleans up (enabled=${enabled})`, async () => {
  const request = globalThis.requestAnimationFrame, cancel = globalThis.cancelAnimationFrame;
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  globalThis.requestAnimationFrame = callback => { frames.set(++next, callback); return next; };
  globalThis.cancelAnimationFrame = id => { frames.delete(id); };
  const store = createStore();
  function Probe() { const ref = useFlip(enabled); return <div ref={ref} data-probe=""><div data-option="a" /><div data-option="b" /></div>; }
  const registry = createRegistry([{ name: 'probe', component: Probe }]);
  const view = render(<Prism source={'```ui:probe\n{}\n```'} registry={registry} store={store} />);
  try {
    const parent = view.container.querySelector('[data-probe]')!, [a, b] = Array.from(parent.children) as HTMLElement[];
    const animate = mock(() => ({ cancel() {}, onfinish: null, oncancel: null }) as unknown as Animation);
    for (const element of [a, b]) {
      element.getBoundingClientRect = () => new DOMRect(0, Array.from(parent.children).indexOf(element) * 100, 100, 100);
      element.animate = animate;
    }
    act(() => store.set('order', 1));
    await Promise.resolve();
    expect(animate).not.toHaveBeenCalled();
    parent.insertBefore(b, a);
    act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(16)); });
    expect(animate).toHaveBeenCalledTimes(enabled ? 2 : 0);
    act(() => store.set('order', 2));
    view.unmount();
    expect(frames.size).toBe(0);
  } finally { view.unmount(); globalThis.requestAnimationFrame = request; globalThis.cancelAnimationFrame = cancel; }
});

test('shared FLIP accepts an empty list', async () => {
  const store = createStore();
  function Probe() { const ref = useFlip(true); return <div ref={ref} />; }
  const view = render(<Prism source={'```ui:probe\n{}\n```'} registry={createRegistry([{ name: 'probe', component: Probe }])} store={store} />);
  act(() => store.set('order', 1));
  await Promise.resolve();
  view.unmount();
});
