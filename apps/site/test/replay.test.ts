import { expect, test } from 'bun:test';
import { createReplay } from '../src/replay';

test('replay yields complete Unicode characters and finishes with the full reply', async () => {
  const frames: string[] = [];
  for await (const text of createReplay('Hi ↗🌿', 0).stream) frames.push(text);
  expect(frames).toEqual(['H', 'Hi', 'Hi ', 'Hi ↗', 'Hi ↗🌿']);
});
test('empty replay completes without yielding a frame', async () => {
  const frames: string[] = [];
  for await (const text of createReplay('', 0).stream) frames.push(text);
  expect(frames).toEqual([]);
});
test('stopping replay releases its pending timer without yielding more content', async () => {
  const replay = createReplay('abc', 0), iterator = replay.stream[Symbol.asyncIterator]();
  expect((await iterator.next()).value).toBe('a');
  const pending = iterator.next();
  replay.stop();
  expect((await pending).done).toBe(true);
});
