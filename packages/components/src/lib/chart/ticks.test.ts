import { expect, test } from 'bun:test';
import { floorTime, niceNum, niceTicks, offsetTime, tickFormat, timeInterval, timeTicks } from './ticks';

test('nice ticks extend domain using 1–2–5 steps without float noise', () => {
  expect(niceTicks(0.03, 0.27, 6)).toEqual([0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]);
  expect(niceTicks(9, -1, 5)).toEqual([10, 5, 0, -5]);
  expect(niceNum(12)).toBe(10); expect(niceNum(12, false)).toBe(20);
  for (const [lo, hi] of [[-23, 76], [2, 2], [0, 0], [-100, -3], [1e-8, 7e-8]]) {
    const ticks = niceTicks(lo, hi);
    expect(ticks[0]).toBeLessThanOrEqual(lo); expect(ticks.at(-1)!).toBeGreaterThanOrEqual(hi);
    const step = ticks[1] - ticks[0];
    const fraction = step / 10 ** Math.floor(Math.log10(step));
    expect([1, 2, 5, 10].some(value => Math.abs(value - fraction) < 1e-8)).toBe(true);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i] - ticks[i - 1]).toBeCloseTo(step, 10);
  }
});
test('tick empty/error/large cases and precision helpers', () => {
  expect(niceTicks(NaN, 1)).toEqual([]); expect(niceTicks(0, Infinity)).toEqual([]); expect(niceTicks(0, 1, 0)).toEqual([]);
  expect(niceNum(-1)).toBe(0); expect(niceNum(Infinity)).toBe(0);
  expect(tickFormat(0.25)(0.75)).toBe('0.75'); expect(tickFormat(0.1)(0.30000000000004)).toBe('0.3');
  expect(tickFormat(1)(-0)).toBe('0'); expect(tickFormat(1)(NaN)).toBe('');
  expect(niceTicks(1e16, 1e16 + 2).length).toBeLessThan(10);
  expect(niceTicks(Number.MAX_VALUE, Number.MAX_VALUE).every(Number.isFinite)).toBe(true);
  expect(niceTicks(1e308, -1e308)).toEqual([1e308, -1e308]);
});
test('time interval selection covers milliseconds through years', () => {
  const spans = [4, 4000, 240000, 14400000, 345600000, 2419200000, 10519200000, 126230400000];
  expect(spans.map(span => timeInterval(0, span, 5).unit)).toEqual(['millisecond', 'second', 'minute', 'hour', 'day', 'week', 'month', 'year']);
  const month = timeTicks(Date.UTC(2024, 0, 15), Date.UTC(2024, 4, 15), 5);
  expect(month.map(date => date.getUTCDate())).toEqual([1, 1, 1, 1]);
  expect(month.map(date => date.getUTCMonth())).toEqual([1, 2, 3, 4]);
  expect(timeTicks(0, 4000, 5).map(Number)).toEqual([0, 1000, 2000, 3000, 4000]);
  expect(timeTicks(4000, 0, 5).map(Number)).toEqual([4000, 3000, 2000, 1000, 0]);
  expect(timeTicks(4, 4).map(Number)).toEqual([4]); expect(timeTicks(NaN, 5)).toEqual([]);
  expect(timeTicks(0, 500, 0)).toEqual([]);
});
test('calendar floors, leap years, weekly boundaries and local time', () => {
  const feb = new Date('2024-02-29T16:34:56.789Z');
  expect(floorTime(feb, { unit: 'month', step: 1 }).toISOString()).toBe('2024-02-01T00:00:00.000Z');
  expect(offsetTime(floorTime(feb, { unit: 'month', step: 1 }), { unit: 'month', step: 1 }).toISOString()).toBe('2024-03-01T00:00:00.000Z');
  expect(floorTime(feb, { unit: 'week', step: 1 }).getUTCDay()).toBe(0);
  const local = new Date(2024, 4, 17, 17, 35, 21);
  const floor = floorTime(local, { unit: 'hour', step: 3 }, false);
  expect(floor.getHours()).toBe(15); expect(floor.getMinutes()).toBe(0);
  const ticks = timeTicks(new Date(2024, 0, 15), new Date(2024, 4, 15), 5, { utc: false });
  expect(ticks.every(date => date.getDate() === 1 && date.getHours() === 0)).toBe(true);
});
test('local ticks follow daylight-saving calendar boundaries in an isolated timezone', () => {
  const module = new URL('./ticks.ts', import.meta.url).href;
  const script = `import {timeTicks} from ${JSON.stringify(module)};
    const days = timeTicks(new Date(2024,2,9), new Date(2024,2,12), 4, {utc:false});
    const hours = timeTicks(new Date(2024,10,3), new Date(2024,10,4), 9, {utc:false});
    console.log(JSON.stringify({
      days: days.map(d => d.getHours()),
      durations: days.slice(1).map((d,i) => (+d - +days[i]) / 3600000),
      hours: hours.map(d => d.getHours())
    }));`;
  const result = Bun.spawnSync({ cmd: [process.execPath, '--eval', script], env: { ...process.env, TZ: 'America/New_York' } });
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(new TextDecoder().decode(result.stdout))).toEqual({ days: [0, 0, 0, 0], durations: [24, 23, 24], hours: [0, 3, 6, 9, 12, 15, 18, 21, 0] });
});
