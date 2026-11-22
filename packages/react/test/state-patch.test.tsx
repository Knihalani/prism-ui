import './setup';
import { afterEach, expect, spyOn, test } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { createStore } from '@prism-ui/state';
import { Prism } from '../src';

afterEach(cleanup);
const patches = {
  leaf: '> ::state{set={"step":1}}\n> ::state{set={"step":2}}\n',
  fence: '> ```ui:state\n> {"set":{"step":1}}\n> ```\n>\n> ```ui:state\n> {"set":{"step":2}}\n> ```\n',
};
for (const [syntax, patch] of Object.entries(patches)) for (const size of [1, 3, 7]) {
  test(`blockquote ${syntax} state patches apply once in final order with ${size}-character chunks`, async () => {
    const source = '> Intro\n> continued\n>\n' + patch;
    const store = createStore(), steps: number[] = [];
    store.subscribe('step', () => steps.push(store.get('step')));
    const apply = spyOn(store, 'apply');
    let frame: FrameRequestCallback | undefined;
    const raf = globalThis.requestAnimationFrame, cancel = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = callback => { frame = callback; return 1; };
    globalThis.cancelAnimationFrame = () => { frame = undefined; };
    try {
      let controller!: ReadableStreamDefaultController<string>;
      const stream = new ReadableStream<string>({ start(value) { controller = value; } });
      render(<StrictMode><Prism stream={stream} store={store} /></StrictMode>);
      for (let i = 0; i < source.length; i += size) {
        await act(async () => {
          controller.enqueue(source.slice(i, i + size));
          await Promise.resolve(); await Promise.resolve();
          const publish = frame; frame = undefined; publish?.(0);
        });
      }
      const provisional = steps.slice();
      await act(async () => { controller.close(); });
      expect(steps).toEqual([1, 2]); expect(store.get('step')).toBe(2);
      expect(apply.mock.calls).toEqual([[{ set: { step: 1 } }], [{ set: { step: 2 } }]]);
      expect(provisional).toEqual([]);
    } finally { apply.mockRestore(); globalThis.requestAnimationFrame = raf; globalThis.cancelAnimationFrame = cancel; }
  });
}

test('a different patch at the same key applies, but replaying either signature does not', () => {
  const store = createStore(), apply = spyOn(store, 'apply');
  const first = '```ui:state\n{"set":{"step":1}}\n```\n', second = '```ui:state\n{"set":{"step":2}}\n```\n';
  try {
    const view = render(<StrictMode><Prism source={first} store={store} /></StrictMode>);
    view.rerender(<StrictMode><Prism source={second} store={store} /></StrictMode>);
    expect(store.get('step')).toBe(2);
    act(() => store.set('step', 9));
    view.rerender(<StrictMode><Prism source={first} store={store} /></StrictMode>);
    view.rerender(<StrictMode><Prism source={second} store={store} /></StrictMode>);
    expect(store.get('step')).toBe(9); expect(apply).toHaveBeenCalledTimes(2);
  } finally { apply.mockRestore(); }
});
