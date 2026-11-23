export type DataRow = Record<string, unknown>;
export type AggregateOp = 'sum' | 'avg' | 'min' | 'max' | 'count';
function write(target: DataRow, key: string, value: unknown) {
  Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true });
}
export interface AggregateOptions { x: string; series?: string; value: string; op?: AggregateOp }
export function aggregate(rows: readonly DataRow[], { x, series, value, op = 'sum' }: AggregateOptions): DataRow[] {
  interface Group { x: unknown; series: unknown; sum: number; valid: number; count: number; min: number; max: number }
  const groups = new Map<unknown, Map<unknown, Group>>();
  const ordered: Group[] = [];
  for (const row of rows) {
    const xValue = row[x], seriesValue = series ? row[series] : undefined;
    let bySeries = groups.get(xValue);
    if (!bySeries) { bySeries = new Map(); groups.set(xValue, bySeries); }
    let group = bySeries.get(seriesValue);
    if (!group) { group = { x: xValue, series: seriesValue, sum: 0, valid: 0, count: 0, min: Infinity, max: -Infinity }; bySeries.set(seriesValue, group); ordered.push(group); }
    group.count++;
    const number = row[value];
    if (typeof number === 'number' && Number.isFinite(number)) { group.sum += number; group.valid++; group.min = Math.min(group.min, number); group.max = Math.max(group.max, number); }
  }
  return ordered.map(group => {
    const result: DataRow = { [x]: group.x };
    if (series) write(result, series, group.series);
    const number = op === 'count' ? group.count : op === 'sum' ? group.sum : !group.valid ? null : op === 'avg' ? group.sum / group.valid : op === 'min' ? group.min : group.max;
    write(result, value, number);
    return result;
  });
}
export interface LongToWideOptions { x: string; series: string; value: string; aggregate?: AggregateOp }
export function pivotLongToWide(rows: readonly DataRow[], { x, series, value, aggregate: op = 'sum' }: LongToWideOptions): DataRow[] {
  const result = new Map<unknown, DataRow>();
  for (const row of aggregate(rows, { x, series, value, op })) {
    let target = result.get(row[x]);
    if (!target) { target = { [x]: row[x] }; result.set(row[x], target); }
    const key = String(row[series]);
    if (key === x) throw new Error('Series key collides with the x field');
    write(target, key, row[value]);
  }
  return [...result.values()];
}
export function pivotWideToLong(rows: readonly DataRow[], { x, keys, series = 'series', value = 'value' }: { x: string; keys: readonly string[]; series?: string; value?: string }): DataRow[] {
  const result: DataRow[] = [];
  for (const row of rows) for (const key of keys) if (Object.hasOwn(row, key)) result.push({ [x]: row[x], [series]: key, [value]: row[key] });
  return result;
}
export function switchX<T extends DataRow>(rows: readonly T[], field: keyof T, xField = 'x'): DataRow[] { return rows.map(row => ({ ...row, [xField]: row[field] })); }
export function topN(rows: readonly DataRow[], key: string, n: number, { otherLabel = 'Other', labelKey = 'label' }: { otherLabel?: string; labelKey?: string } = {}): DataRow[] {
  const number = (row: DataRow) => typeof row[key] === 'number' && Number.isFinite(row[key]) ? row[key] as number : 0;
  const sorted = [...rows].sort((a, b) => number(b) - number(a));
  const limit = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : n === Infinity ? rows.length : 0;
  const result = sorted.slice(0, limit).map(row => ({ ...row }));
  if (limit < sorted.length) result.push({ [labelKey]: otherLabel, [key]: sorted.slice(limit).reduce((sum, row) => sum + number(row), 0) });
  return result;
}
export function sortBy<T>(rows: readonly T[], key: keyof T | ((row: T) => unknown), direction: 'asc' | 'desc' = 'asc'): T[] {
  const get = typeof key === 'function' ? key : (row: T) => row[key];
  return [...rows].sort((a, b) => {
    const x = get(a), y = get(b);
    const missingX = x == null || typeof x === 'number' && !Number.isFinite(x);
    const missingY = y == null || typeof y === 'number' && !Number.isFinite(y);
    if (missingX || missingY) return Number(missingX) - Number(missingY);
    const order = typeof x === 'number' && typeof y === 'number' ? x - y : x instanceof Date && y instanceof Date ? +x - +y : String(x).localeCompare(String(y));
    return direction === 'desc' ? -order : order;
  });
}
