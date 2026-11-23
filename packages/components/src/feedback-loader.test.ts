import { expect, test } from 'bun:test';
import { createLoader } from './feedback-loader';

test('an empty loader is inert, shares pending and completed requests, and exposes the loaded value', async () => {
  let calls = 0;
  const loader = createLoader(async () => { calls++; return 'module'; });
  expect(loader.value).toBeUndefined();
  expect(calls).toBe(0);
  const pending = loader.load();
  expect(loader.load()).toBe(pending);
  await expect(pending).resolves.toBe('module');
  expect(loader.value).toBe('module');
  expect(loader.load()).toBe(pending);
  expect(calls).toBe(1);
});
test('synchronous and asynchronous failures clear the pending request for retry', async () => {
  for (const sync of [true, false]) {
    let calls = 0;
    const loader = createLoader(() => { if (++calls > 1) return Promise.resolve('retry'); if (sync) throw new Error('Failed'); return Promise.reject(new Error('Failed')); });
    await expect(loader.load()).rejects.toThrow('Failed');
    expect(loader.value).toBeUndefined();
    await expect(loader.load()).resolves.toBe('retry');
    expect(calls).toBe(2);
  }
});
