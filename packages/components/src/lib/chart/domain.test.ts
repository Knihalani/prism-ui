import { expect, test } from 'bun:test';
import { createExtentTracker, createStableDomain } from './domain';

test('stable domains only expand, contain values and change rarely across 1000 points', () => {
  const stable = createStableDomain({ hysteresis: 0.1, nice: true, includeZero: true });
  let previous: [number, number] | undefined;
  let changes = 0;
  for (let i = 0; i < 1000; i++) {
    const value = i + Math.sin(i) * 0.1;
    const domain = stable.update([value]);
    expect(domain[0]).toBeLessThanOrEqual(value); expect(domain[1]).toBeGreaterThanOrEqual(value);
    expect(domain[0]).toBeLessThanOrEqual(0);
    if (previous) { expect(domain[0]).toBeLessThanOrEqual(previous[0]); expect(domain[1]).toBeGreaterThanOrEqual(previous[1]); }
    if (!previous || domain[0] !== previous[0] || domain[1] !== previous[1]) changes++;
    previous = domain;
  }
  expect(changes).toBeLessThan(25);
  const expanded = stable.domain; expect(stable.update([1, 2, 3])).toEqual(expanded);
  stable.reset(); expect(stable.update([1, 2, 3])[1]).toBeLessThan(expanded[1]);
});
test('headroom, min/max overloads, equal values, negatives, invalid inputs and reset', () => {
  const stable = createStableDomain({ nice: false, hysteresis: 0.1 });
  expect(stable.update([NaN, null, Infinity])).toEqual([0, 1]);
  expect(stable.update({ min: 10, max: 20 })).toEqual([9, 21]);
  expect(stable.update(10.1, 20.1)).toEqual([9, 21]);
  const before = stable.domain; const after = stable.update(-10, 15); expect(after[0]).toBeLessThan(-10); expect(after[1]).toBe(before[1]);
  const detached = stable.domain; detached[0] = 999; expect(stable.domain[0]).toBeLessThan(-10);
  expect(stable.update(NaN)).toEqual(after);
  for (const value of [0, -5, 5]) { const equal = createStableDomain().update([value]); expect(equal[0]).toBeLessThan(value); expect(equal[1]).toBeGreaterThan(value); }
  expect(createStableDomain({ nice: false, includeZero: true }).update([0])).toEqual([0, 1]);
  const negative = createStableDomain({ includeZero: true }).update([-9, -2]); expect(negative[1]).toBe(0); expect(negative[0]).toBeLessThanOrEqual(-9);
});
test('extent tracker examines only appended items and resets on truncation', () => {
  let reads = 0;
  const tracker = createExtentTracker<{ value: number | null }>(row => { reads++; return row.value; });
  const input = [{ value: 2 }, { value: 3 }];
  expect(tracker.extent).toBeUndefined(); expect(tracker.update(input)).toEqual([2, 3]);
  expect(tracker.update(input)).toEqual([2, 3]); expect(reads).toBe(2);
  input.push({ value: -1 }); expect(tracker.update(input)).toEqual([-1, 3]); expect(reads).toBe(3);
  expect(tracker.append([{ value: 10 }, { value: null }])).toEqual([-1, 10]); expect(tracker.count).toBe(5);
  expect(tracker.update([{ value: 8 }])).toEqual([8, 8]);
  tracker.reset(); expect(tracker.count).toBe(0); expect(tracker.extent).toBeUndefined();
  expect(createExtentTracker().append([NaN, null])).toBeUndefined();
});
