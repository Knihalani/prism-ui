import { expect, test } from 'bun:test';
import { filter, prepare, score } from './fuzzy';

test('case and diacritics normalize while retaining original highlight offsets', () => {
  expect(score('cafe', 'CAFÉ')?.indices).toEqual([0, 1, 2, 3]);
  expect(score('e', 'e\u0301clair')?.indices).toEqual([0]);
  expect(score('cat', 'Cat')?.score).toBeGreaterThan(0);
  expect(score('missing', 'cat')).toBeNull();
  expect(score('', '')).toEqual({ score: 0, indices: [] });
});
test('prefix, consecutive and word start bonuses improve ranking', () => {
  expect(score('cat', 'cat food')!.score).toBeGreaterThan(score('cat', 'scatter')!.score);
  expect(score('ab', 'ab')!.score).toBeGreaterThan(score('ab', 'a big')!.score);
  expect(score('bar', 'foo bar')!.score).toBeGreaterThan(score('bar', 'fooxbar')!.score);
});
test('tokens match in any order and all must match', () => {
  expect(score('brown quick', 'quick brown fox')?.indices).toEqual([0, 1, 2, 3, 4, 6, 7, 8, 9, 10]);
  expect(score('quick zebra', 'quick brown fox')).toBeNull();
});
test('filter sorts, limits, thresholds, nested keys and empty inputs', () => {
  const items = [{ user: { name: 'scatter' } }, { user: { name: 'cat' } }, { user: { name: 'dog' } }];
  const result = filter(items, 'cat', { keys: ['user.name'], limit: 1 });
  expect(result[0].item).toBe(items[1]);
  expect(result[0].matches).toEqual([0, 1, 2]);
  expect(filter(items, 'cat', { getText: item => item.user.name, threshold: 1e9 })).toEqual([]);
  expect(filter(items, '', { limit: 0 })).toEqual([]);
  expect(filter([], 'cat')).toEqual([]);
  expect(filter(['b', 'a'], '').map(result => result.item)).toEqual(['b', 'a']);
  expect(filter(items, 'nope', { keys: ['missing'] })).toEqual([]);
});
test('prepared indices reuse normalization and preserve result equivalence', () => {
  let calls = 0;
  const items = ['Café', 'category', 'dog'];
  const prepared = prepare(items, item => { calls++; return item; });
  expect(filter(prepared, 'ca')).toEqual(filter(items, 'ca'));
  expect(filter(prepared, 'caf')).toEqual(filter(items, 'caf'));
  expect(calls).toBe(3);
});
