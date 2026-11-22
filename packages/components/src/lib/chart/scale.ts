import { floorTime, niceTicks, numericDomain, offsetTime, timeInterval, timeTicks } from './ticks';

export interface LinearOptions { domain?: readonly [number, number]; range?: readonly [number, number]; nice?: boolean; clamp?: boolean }
export interface LinearScale { domain: [number, number]; range: [number, number]; map(value: number | null | undefined): number; invert(value: number): number; ticks(count?: number): number[]; copy(overrides?: LinearOptions): LinearScale }
export function scaleLinear(options: LinearOptions = {}): LinearScale {
  let domain: [number, number] = [...options.domain ?? [0, 1]];
  if (!domain.every(Number.isFinite)) domain = [0, 1];
  if (options.nice) { const ticks = niceTicks(...domain); domain = [ticks[0], ticks[ticks.length - 1]]; }
  const range: [number, number] = [...options.range ?? [0, 1]];
  const normalize = (value: number, a: number, b: number) => {
    const t = a === b ? 0.5 : (value - a) / (b - a);
    return options.clamp ? Math.max(0, Math.min(1, t)) : t;
  };
  return {
    domain, range,
    map: (value: number | null | undefined) => value == null || !Number.isFinite(value) ? NaN : range[0] + normalize(value, ...domain) * (range[1] - range[0]),
    invert: (value: number) => domain[0] + normalize(value, ...range) * (domain[1] - domain[0]),
    ticks: (count = 5) => niceTicks(...domain, count),
    copy: (overrides: LinearOptions = {}) => scaleLinear({ ...options, domain, range, ...overrides }),
  };
}
export interface BandOptions<T> { domain: readonly T[]; range?: readonly [number, number]; paddingInner?: number; paddingOuter?: number; align?: number }
export interface BandScale<T> { domain: T[]; range: [number, number]; bandwidth: number; step: number; map(value: T): number; index(value: T): number; indexAt(value: number): number; invert(value: number): T | undefined; copy(overrides?: Partial<BandOptions<T>>): BandScale<T> }
export function scaleBand<T>({ domain: input, range: inputRange = [0, 1], paddingInner = 0, paddingOuter = 0, align = 0.5 }: BandOptions<T>): BandScale<T> {
  const range: [number, number] = [...inputRange];
  const domain = [...new Set(input)];
  const indices = new Map(domain.map((key, i) => [key, i]));
  const inner = Number.isFinite(paddingInner) ? Math.max(0, Math.min(1, paddingInner)) : 0;
  const outer = Number.isFinite(paddingOuter) ? Math.max(0, paddingOuter) : 0;
  const alignment = Number.isFinite(align) ? Math.max(0, Math.min(1, align)) : 0.5;
  const lo = Math.min(...range), hi = Math.max(...range);
  const step = domain.length ? (hi - lo) / Math.max(1, domain.length - inner + outer * 2) : 0;
  const bandwidth = step * (1 - inner);
  const start = lo + (hi - lo - step * (domain.length - inner)) * alignment;
  const position = (index: number) => start + (range[1] < range[0] ? domain.length - 1 - index : index) * step;
  function indexAt(value: number): number {
    if (!domain.length || !step || !Number.isFinite(value) || value < lo || value > hi) return -1;
    const visual = Math.max(0, Math.min(domain.length - 1, Math.round((value - start - bandwidth / 2) / step)));
    return range[1] < range[0] ? domain.length - 1 - visual : visual;
  }
  return {
    domain, range: [...range] as [number, number], bandwidth, step,
    map: (value: T) => { const index = indices.get(value); return index === undefined ? NaN : position(index); },
    index: (value: T) => indices.get(value) ?? -1,
    indexAt,
    invert: (value: number): T | undefined => domain[indexAt(value)],
    copy: (overrides: Partial<BandOptions<T>> = {}) => scaleBand({ domain, range, paddingInner: inner, paddingOuter: outer, align: alignment, ...overrides }),
  };
}
export interface TimeScaleOptions { domain?: readonly [Date | number, Date | number]; range?: readonly [number, number]; nice?: boolean; clamp?: boolean; utc?: boolean }
export interface TimeScale { domain: [Date, Date]; range: [number, number]; map(value: Date | number | null | undefined): number; invert(value: number): Date; ticks(count?: number): Date[]; copy(overrides?: TimeScaleOptions): TimeScale }
export function scaleTime(options: TimeScaleOptions = {}): TimeScale {
  let domain: [number, number] = options.domain ? [+options.domain[0], +options.domain[1]] : [0, 1];
  if (!domain.every(Number.isFinite)) domain = [0, 1];
  if (options.nice) {
    const reversed = domain[0] > domain[1];
    const [lo, hi] = numericDomain(...domain);
    const interval = timeInterval(lo, hi);
    const start = floorTime(lo, interval, options.utc ?? true);
    let end = floorTime(hi, interval, options.utc ?? true);
    if (+end < hi) end = offsetTime(end, interval, options.utc ?? true);
    domain = reversed ? [+end, +start] : [+start, +end];
  }
  const linear = scaleLinear({ ...options, domain, nice: false });
  return {
    domain: domain.map(value => new Date(value)) as [Date, Date], range: linear.range,
    map: (value: Date | number | null | undefined) => linear.map(value == null ? null : +value),
    invert: (value: number) => new Date(linear.invert(value)),
    ticks: (count = 5) => timeTicks(...domain, count, options),
    copy: (overrides: TimeScaleOptions = {}) => scaleTime({ ...options, domain, range: linear.range, ...overrides }),
  };
}
