import './setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { usePrismStream } from '../src';

afterEach(cleanup);
test('StrictMode replays a ReadableStream effect without cancelling or locking it', async () => {
  let controller!: ReadableStreamDefaultController<string>, cancels = 0;
  const stream = new ReadableStream<string>({ start(value) { controller = value; }, cancel() { cancels++; } });
  function View() { const result = usePrismStream(stream, { throttle: 0 }); return <div data-done={result.done}>{result.error ? String(result.error) : JSON.stringify(result.root)}</div>; }
  const view = render(<StrictMode><View /></StrictMode>);
  await act(async () => { controller.enqueue('# Ready\n\n'); await Promise.resolve(); controller.enqueue('Finished'); controller.close(); });
  expect(view.container.textContent).toContain('Finished'); expect(view.container.textContent).not.toContain('TypeError');
  expect(view.container.firstElementChild?.getAttribute('data-done')).toBe('true'); expect(cancels).toBe(0);
});

test('an acquired ReadableStream still cancels on actual unmount', async () => {
  let cancels = 0;
  const stream = new ReadableStream<string>({ cancel() { cancels++; } });
  function View() { usePrismStream(stream); return null; }
  const view = render(<StrictMode><View /></StrictMode>);
  await act(async () => { await Promise.resolve(); });
  expect(stream.locked).toBe(true); expect(cancels).toBe(0);
  view.unmount(); await act(async () => { await Promise.resolve(); });
  expect(cancels).toBe(1); expect(stream.locked).toBe(false);
});
