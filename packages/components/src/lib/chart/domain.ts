import { niceTicks, numericDomain } from './ticks';

export interface StableDomainOptions { hysteresis?: number; nice?: boolean; includeZero?: boolean; tickCount?: number }
type ExtentValues = readonly (number | null | undefined)[] | { min: number; max: number };
export function createStableDomain({ hysteresis = 0.1, nice = true, includeZero = false, tickCount = 5 }: StableDomainOptions = {}) {
  let current: [number, number] | undefined;
  const headroom = Number.isFinite(hysteresis) ? Math.max(0, hysteresis) : 0.1;
  function update(values: ExtentValues | number, maxValue?: number): [number, number] {
    let min = Infinity, max = -Infinity;
    if (typeof values === 'number') { min = values; max = maxValue ?? values; }
    else if ('min' in values) { min = values.min; max = values.max; }
    else for (const value of values) if (value != null && Number.isFinite(value)) { if (value < min) min = value; if (value > max) max = value; }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return current ? [...current] : [0, 1];
    if (min > max) [min, max] = [max, min];
    if (includeZero) { min = Math.min(0, min); max = Math.max(0, max); }
    if (current && min >= current[0] && max <= current[1]) return [...current];
    const [lo, hi] = numericDomain(current ? Math.min(min, current[0]) : min, current ? Math.max(max, current[1]) : max);
    const pad = (hi - lo) * headroom;
    let nextMin = !current || min < current[0] ? lo - pad : current[0];
    let nextMax = !current || max > current[1] ? hi + pad : current[1];
    if (includeZero && min >= 0) nextMin = current ? Math.min(current[0], 0) : 0;
    if (includeZero && max <= 0) nextMax = current ? Math.max(current[1], 0) : 0;
    if (nextMin === nextMax) nextMax = nextMin + 1;
    if (nice) { const ticks = niceTicks(nextMin, nextMax, tickCount); if (ticks.length) { nextMin = ticks[0]; nextMax = ticks[ticks.length - 1]; } }
    current = [current ? Math.min(current[0], nextMin) : nextMin, current ? Math.max(current[1], nextMax) : nextMax];
    return [...current];
  }
  return { update, reset: () => { current = undefined; }, get domain(): [number, number] { return current ? [...current] : [0, 1]; } };
}
export function createExtentTracker<T = number | null | undefined>(accessor: (value: T, index: number) => number | null | undefined = value => value as number | null | undefined) {
  let min = Infinity, max = -Infinity, count = 0;
  function reset() { min = Infinity; max = -Infinity; count = 0; }
  function add(value: T, index: number) { const number = accessor(value, index); if (number != null && Number.isFinite(number)) { if (number < min) min = number; if (number > max) max = number; } }
  function extent(): [number, number] | undefined { return min <= max ? [min, max] : undefined; }
  return {
    append(values: readonly T[]) { for (let i = 0; i < values.length; i++) add(values[i], count++); return extent(); },
    update(values: readonly T[]) { if (values.length < count) reset(); for (; count < values.length; count++) add(values[count], count); return extent(); },
    reset, get extent() { return extent(); }, get count() { return count; },
  };
}
