import { expect, test } from 'bun:test';
import { scaleBand, scaleLinear, scaleTime } from './scale';

test('linear scales map, invert, clamp, reverse, copy and nice', () => {
  const scale = scaleLinear({ domain: [-10, 10], range: [100, 0], clamp: true });
  expect(scale.map(0)).toBe(50); expect(scale.invert(50)).toBe(0);
  expect(scale.map(30)).toBe(0); expect(scale.invert(-100)).toBe(10);
  expect(scale.copy({ range: [0, 200] }).map(0)).toBe(100); expect(scale.map(0)).toBe(50);
  expect(scaleLinear({ domain: [0.3, 8.4], nice: true }).domain).toEqual([0, 10]);
  expect(scaleLinear({ domain: [5, 5], range: [0, 100] }).map(5)).toBe(50);
  expect(scaleLinear().map(null)).toBeNaN(); expect(scaleLinear().map(NaN)).toBeNaN();
  expect(scaleLinear({ domain: [NaN, 10] }).domain).toEqual([0, 1]);
  expect(scaleLinear({ domain: [10, 0] }).ticks()).toEqual([10, 5, 0]);
});
test('band geometry, lookup, padding, alignment, reversal and isolation', () => {
  const domain = ['a', 'b', 'c', 'b']; const range: [number, number] = [0, 300];
  const band = scaleBand({ domain, range, paddingInner: 0.2, paddingOuter: 0.1 });
  expect(band.domain).toEqual(['a', 'b', 'c']); expect(band.step).toBeCloseTo(100); expect(band.bandwidth).toBeCloseTo(80);
  expect(band.map('a')).toBeCloseTo(10); expect(band.map('b')).toBeCloseTo(110);
  expect(band.index('b')).toBe(1); expect(band.index('missing')).toBe(-1); expect(band.map('missing')).toBeNaN();
  expect(band.indexAt(99)).toBe(0); expect(band.indexAt(101)).toBe(1); expect(band.indexAt(301)).toBe(-1);
  expect(band.invert(250)).toBe('c'); expect(band.indexAt(NaN)).toBe(-1);
  range.reverse(); domain.push('d'); expect(band.map('a')).toBeCloseTo(10); expect(band.domain).toHaveLength(3);
  const reversed = band.copy({ range: [300, 0] }); expect(reversed.map('a')).toBeCloseTo(210); expect(reversed.indexAt(250)).toBe(0);
  expect(scaleBand({ domain: [], range: [0, 100] }).bandwidth).toBe(0);
  expect(scaleBand({ domain: ['a'], range: [0, 100] }).map('a')).toBe(0);
  expect(scaleBand({ domain: ['a'], paddingInner: 4, paddingOuter: -1 }).bandwidth).toBe(0);
});
test('time scales use dates, nice calendar bounds and invert', () => {
  const scale = scaleTime({ domain: [Date.UTC(2024, 0, 15), Date.UTC(2024, 4, 15)], range: [0, 100], nice: true });
  expect(scale.domain[0].getUTCDate()).toBe(1); expect(scale.domain[1].getUTCDate()).toBe(1);
  const value = new Date('2024-02-01T00:00:00Z'); expect(+scale.invert(scale.map(value))).toBe(+value);
  expect(scale.ticks().every(date => date.getUTCDate() === 1)).toBe(true);
  expect(scale.copy({ clamp: true }).map(0)).toBe(0); expect(scale.map(null)).toBeNaN();
  expect(scaleTime({ domain: [NaN, 100] }).domain.map(Number)).toEqual([0, 1]);
});
