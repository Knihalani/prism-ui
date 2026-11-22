import { expect, test } from 'bun:test';
import { defaultRegistry } from '@prism-ui/react';
import { parse } from '@prism-ui/core';
import { createStore } from '@prism-ui/state';
import { examples, kitchenSink } from '../src/fixtures';
import { parsePatch } from '../src/patch';
import { createReplay } from '../src/replay';
import { createParser } from '../src/instrumented-core';
import { metrics, resetMetrics } from '../src/metrics';

test('every registered directive has a parseable fixture', () => {
  const fixtures = examples();
  expect(fixtures.map(f => f.id).sort()).toEqual(defaultRegistry.list().map(d => d.name).sort());
  for (const fixture of fixtures) expect(parse(fixture.source).children.length).toBeGreaterThan(0);
  expect(parse(kitchenSink).children.filter(n => n.type === 'component').length).toBeGreaterThanOrEqual(5);
});

test('agent patches apply set/merge/delete, including empty maps', () => {
  const store = createStore({ initial: { old: 1, rent: 1200, plan: { seats: 3 } } });
  store.apply(parsePatch('{"set":{"rent":1800},"merge":{"plan":{"enabled":true}},"delete":["old"]}'));
  expect(store.snapshot()).toEqual({ rent: 1800, plan: { seats: 3, enabled: true } });
  store.apply(parsePatch('{"set":{}}')); expect(store.get('rent')).toBe(1800);
});

test('invalid patch shapes and malformed JSON fail without touching the store', () => {
  for (const value of ['', '{', 'null', '[]', '{}', '{"typo":1}', '{"set":null}', '{"merge":[]}', '{"delete":[1]}']) expect(() => parsePatch(value)).toThrow();
});

test('replay yields chunks in order, without splitting surrogate pairs', async () => {
  let finished = 0; const replay = createReplay('a🌈b!', () => ({ chars: 2, delay: 0 }), () => finished++);
  const chunks: string[] = []; for await (const chunk of replay.stream) chunks.push(chunk);
  expect(chunks).toEqual(['a🌈', 'b!']); expect(finished).toBe(1);
  const empty = createReplay('', () => ({ chars: 4, delay: 0 }), () => finished++);
  for await (const chunk of empty.stream) throw new Error(chunk);
  expect(finished).toBe(2);
});

test('failed replay option reads finalize before rejecting', async () => {
  let finished = 0;
  const broken = createReplay('x', () => { throw new Error('Invalid replay options'); }, () => finished++);
  await expect(broken.stream[Symbol.asyncIterator]().next()).rejects.toThrow('Invalid replay options');
  expect(finished).toBe(1);
});

test('replay pauses, resumes and stops while paused without a stuck read', async () => {
  let finished = false; const replay = createReplay('abcdef', () => ({ chars: 2, delay: 0 }), () => { finished = true; });
  replay.pause(true); const iterator = replay.stream[Symbol.asyncIterator](); let settled = false;
  const pending = iterator.next().then(value => { settled = true; return value; });
  await new Promise(resolve => setTimeout(resolve, 10)); expect(settled).toBe(false);
  replay.pause(false); expect((await pending).value).toBe('ab');
  replay.pause(true); const stopped = iterator.next(); replay.stop(); expect((await stopped).done).toBe(true); expect(finished).toBe(true);
});

test('instrumentation counts real parser chunks and preserves frozen identities', () => {
  resetMetrics(); const parser = createParser(); parser.push('first\n\n'); const first = parser.root.children[0]; parser.push('second'); parser.push('');
  expect(parser.end().root.children[0]).toBe(first); expect(Object.isFrozen(first)).toBe(true);
  expect(metrics.chunks).toBe(2); expect(metrics.bytes).toBe(13); expect(metrics.parseMs).toBeGreaterThanOrEqual(0);
  resetMetrics(); expect(metrics).toEqual({ chunks: 0, bytes: 0, parseMs: 0, commits: 0 });
});
