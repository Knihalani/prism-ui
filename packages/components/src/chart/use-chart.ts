import { useCallback, useMemo, useState } from 'react';
import { useComponentState, useEmit, type PrismContextValue } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { arcLabel, arcPath, areaPath, barPath, createExtentTracker, createStableDomain, linePath, niceTicks, pie, pivotLongToWide, pivotWideToLong, placeLabels, relaxPieLabels, scaleBand, scaleLinear, stack, thinAxisLabels, type DataRow, type Point } from '../lib/chart';
import { format } from '../lib/format';

export type ChartType = 'line' | 'bar' | 'area' | 'pie';
export interface ChartSeries { key: string; label?: string; color?: string }
export interface ChartPivot { label: string; type?: ChartType; series?: ChartSeries[]; x?: string }
export interface ChartAnnotation { x: string | number; label: string }
export interface ChartProps {
  id?: string; type?: ChartType; title?: string; subtitle?: string; x?: string; series?: ChartSeries[]; data?: DataRow[];
  insight?: string; annotations?: ChartAnnotation[]; pivots?: ChartPivot[]; stacked?: boolean;
  curve?: 'linear' | 'step' | 'monotone'; format?: 'number' | 'currency' | 'percent' | 'compact'; currency?: string;
  height?: number; yLabel?: string; legend?: boolean; complete?: boolean;
}
export interface ChartSelectPayload { x: unknown; series: string; value: number | null }
export interface ChartPivotPayload { pivot: number; label: string }
const seriesSchema = s.object({ key: s.string().describe('Numeric row key.'), label: s.string().optional().describe('Legend label.'), color: s.string().optional().describe('CSS color or token variable override.') });
const typeSchema = s.enum(['line', 'bar', 'area', 'pie']);
export const chartSchema = s.object({
  id: s.string().optional().describe('Stable state id.'), type: typeSchema.optional().describe('Default line; pie uses the first visible series.'),
  title: s.string().optional().describe('Chart heading.'), subtitle: s.string().optional().describe('Supporting context.'),
  x: s.string().optional().describe('Category key; defaults to first nonnumeric field.'),
  series: s.array(seriesSchema).optional().describe('Numeric series; defaults to first-row numeric keys.'),
  data: s.array(s.any()).optional().describe('Row objects; append while streaming.'),
  insight: s.string().optional().describe('Answer chart lead sentence.'),
  annotations: s.array(s.object({ x: s.union(s.string(), s.number()), label: s.string() })).optional().describe('X markers; opens on first match.'),
  pivots: s.array(s.object({ label: s.string(), type: typeSchema.optional(), series: s.array(seriesSchema).optional(), x: s.string().optional() })).optional().describe('View chips; x changes sum by category. Emits pivot {pivot: zero-based index, label}.'),
  stacked: s.boolean().optional().describe('Diverging stacks for bar and area charts.'),
  curve: s.enum(['linear', 'step', 'monotone']).optional().describe('Line/area interpolation (default monotone).'),
  format: s.enum(['number', 'currency', 'percent', 'compact']).optional().describe('Intl y/tooltip format (default number).'),
  currency: s.string().optional().describe('ISO currency code; defaults to Prism currency.'),
  height: s.number({ min: 180, max: 900 }).optional().describe('Fixed height in px (default 300).'),
  yLabel: s.string().optional().describe('Y-axis description.'), legend: s.boolean().optional().describe('Show series toggles (default true).'),
});
const empty: DataRow[] = [];
export const seriesColor = (series: ChartSeries, index: number) => series.color ?? `var(--prism-chart-${index % 8 + 1})`;
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
export function useChart(props: ChartProps, ctx: PrismContextValue, width = 640) {
  const [pivot, setPivot] = useComponentState('pivot', -1), [hidden, setHidden] = useComponentState<string[]>('hidden', []);
  const [interaction, setInteraction] = useState<{ index: number; series: number } | null>(null), emit = useEmit();
  const input = useMemo(() => (props.data ?? empty).filter(row => row && typeof row === 'object' && !Array.isArray(row)), [props.data]);
  const activePivot = props.pivots?.[pivot], type = activePivot?.type ?? props.type ?? 'line';
  const x = activePivot?.x ?? props.x ?? Object.keys(input[0] ?? {}).find(key => typeof input[0][key] !== 'number') ?? 'x';
  const series = useMemo(() => (activePivot?.series ?? props.series ?? Object.keys(input[0] ?? {}).filter(key => key !== x && number(input[0][key]) !== null).map(key => ({ key } as ChartSeries))).filter(item => item?.key && item.key !== x).map(item => ({ ...item, label: item.label ?? item.key })), [activePivot?.series, props.series, input, x]);
  const shown = useMemo(() => { const visible = series.filter(item => !hidden.includes(item.key)); return visible.length ? visible : series.slice(0, 1); }, [series, hidden]);
  const data = useMemo(() => {
    if (!activePivot?.x || activePivot.x === props.x) return input;
    const fields = { x, series: `_${x}`, value: `__${x}` };
    return pivotLongToWide(pivotWideToLong(input, { ...fields, keys: series.map(item => item.key) }), fields);
  }, [input, activePivot?.x, props.x, x, series]);
  const signature = JSON.stringify([pivot, type, x, shown.map(item => item.key), !!props.stacked]);
  const domains = useMemo(() => {
    const extent = (row: DataRow, max: boolean) => {
      const values = shown.map(item => number(row[item.key]) ?? 0);
      return props.stacked && type !== 'line' ? values.filter(value => max ? value > 0 : value < 0).reduce((a, b) => a + b, 0) : (max ? Math.max : Math.min)(0, ...values);
    };
    return { stable: createStableDomain({ hysteresis: .15, includeZero: true }), min: createExtentTracker<DataRow>(row => extent(row, false)), max: createExtentTracker<DataRow>(row => extent(row, true)), previous: [] as DataRow[], tail: '', capacity: 4 };
  }, [signature]);
  const valueFormat = useCallback((value: unknown) => format(value, props.format ?? 'number', { locale: ctx.format.locale, currency: props.currency ?? ctx.format.currencyCode, fallback: '—' }), [props.format, props.currency, ctx.format]);
  const height = props.height ?? 300;
  const geometry = useMemo(() => {
    const tailSignature = (row: DataRow | undefined) => JSON.stringify(shown.map(item => row?.[item.key]));
    if (domains.previous !== data && (props.complete !== false || data.length < domains.previous.length || domains.tail !== tailSignature(data[domains.previous.length - 1]))) { domains.min.reset(); domains.max.reset(); }
    const lo = domains.min.update(data), hi = domains.max.update(data);
    domains.previous = data; domains.tail = tailSignature(data.at(-1));
    const domain = lo && hi ? domains.stable.update(lo[0], hi[1]) : domains.stable.update([]);
    const left = 70, right = Math.max(left + 40, width - 26), top = 42, bottom = height - 38;
    const yScale = scaleLinear({ domain, range: [bottom, top] });
    while (domains.capacity < data.length) domains.capacity *= 2;
    const band = scaleBand({ domain: Array.from({ length: props.complete === false ? domains.capacity : data.length }, (_, i) => i), range: [left, right], paddingInner: .28, paddingOuter: .15 });
    const xs = data.map((_, i) => band.map(i) + band.bandwidth / 2);
    const stacks = props.stacked ? stack(data, shown.map(item => item.key), { offset: 'diverging' }) : undefined;
    const layers = shown.map((item, s) => {
      const topPoints: (Point | null)[] = data.map((row, i) => number(row[item.key]) === null ? null : [xs[i], yScale.map(stacks?.[s][i][1] ?? number(row[item.key]))]);
      const baseline: (Point | null)[] = data.map((_, i) => [xs[i], yScale.map(stacks?.[s][i][0] ?? 0)]);
      const curve = props.curve ?? 'monotone', line = linePath(topPoints, { curve });
      return { key: item.key, color: seriesColor(item, series.findIndex(value => value.key === item.key)),
        d: type === 'area' ? areaPath(topPoints, baseline, { curve }) : line,
        line,
        points: topPoints,
        bars: data.map((row, i) => {
          const from = stacks?.[s][i][0] ?? 0, to = stacks?.[s][i][1] ?? number(row[item.key]) ?? 0;
          const barWidth = band.bandwidth / (props.stacked ? 1 : Math.max(1, shown.length));
          const start = yScale.map(from), end = yScale.map(to);
          return barPath({ x: band.map(i) + (props.stacked ? 0 : s * barWidth), y: Math.min(start, end), width: barWidth, height: Math.abs(end - start), radius: 3, topOnly: true });
        }),
      };
    });
    const radius = Math.max(20, Math.min((right - left) / 2 - 70, (bottom - top) / 2 - 12)), cx = (left + right) / 2, cy = (top + bottom) / 2;
    const arcs = pie(data.map(row => Math.max(0, number(shown[0] ? row[shown[0].key] : null) ?? 0)), { padAngle: .025 });
    const slices = arcs.map((arc, i) => {
      const shape = { ...arc, innerRadius: radius * .65, outerRadius: radius, cornerRadius: 3 };
      const label = arcLabel(shape, { offset: 8, labelOffset: 8 });
      return { d: arcPath(shape), color: shown[0]?.color ?? `var(--prism-chart-${i % 8 + 1})`, ...label, value: arc.value, index: i, text: String(data[i][x] ?? i + 1) };
    });
    const pieLabels = relaxPieLabels(slices.filter(slice => slice.value > 0).map(slice => {
      const formatted = valueFormat(slice.value);
      return { ...slice, formatted, w: (slice.text.length + formatted.length + 3) * 6, h: 16, priority: slice.value };
    }), { minY: -height / 2 + 28, maxY: height / 2 - 28 });
    const ticks = niceTicks(...domain, 5).filter(value => value >= domain[0] && value <= domain[1]).map(value => ({ value, y: yScale.map(value), label: valueFormat(value) }));
    const labels = thinAxisLabels(data.map((row, i) => { const label = String(row[x] ?? i + 1); return { x: xs[i] - label.length * 3, y: bottom + 12, w: label.length * 6, h: 16, index: i, text: label }; }));
    const annotations = placeLabels((props.annotations ?? []).flatMap((annotation, i) => {
      const index = data.findIndex(row => String(row[x]) === String(annotation.x));
      if (index < 0) return [];
      const w = Math.min(right - left, annotation.label.length * 6 + 16);
      return [{ x: Math.max(left, Math.min(right - w, xs[index] - w / 2)), y: top - 30, w, h: 22, index, label: annotation.label, priority: -i }];
    }), { bounds: { x: left, y: 0, w: right - left, h: height - 40 } }).placed;
    return { width, height, type, domain, left, right, top, bottom, xs, yScale, layers, ticks, labels, annotations, slices, pieLabels, cx, cy, total: slices.reduce((sum, slice) => sum + slice.value, 0) };
  }, [data, shown, series, type, props.stacked, props.curve, props.annotations, props.complete, domains, width, height, x, valueFormat]);
  const annotated = props.annotations?.map(annotation => data.findIndex(row => String(row[x]) === String(annotation.x))).find(index => index >= 0) ?? (props.insight && data.length ? 0 : -1);
  const activeIndex = data.length ? Math.max(0, Math.min(data.length - 1, interaction?.index ?? (annotated >= 0 ? annotated : 0))) : -1;
  const activeSeries = type === 'pie' ? 0 : Math.max(0, Math.min(shown.length - 1, interaction?.series ?? 0));
  const active = interaction || annotated >= 0 ? { index: activeIndex, series: activeSeries } : null;
  const selectPoint = (index: number, seriesIndex: number) => {
    const row = data[index], item = shown[seriesIndex]; if (!row || !item) return;
    const payload: ChartSelectPayload = { x: row[x] ?? index, series: item.key, value: number(row[item.key]) };
    emit('select', payload);
  };
  return { geometry, type, x, series, shown, data, pivot, hidden, active, activeIndex, activeSeries, valueFormat,
    answer: !!(props.insight || props.annotations?.length || props.pivots?.length),
    activate: setInteraction, selectPoint,
    toggleSeries(key: string) { if (!shown.some(item => item.key === key) || shown.length > 1) setHidden(old => old.includes(key) ? old.filter(value => value !== key) : [...old, key]); },
    choosePivot(index: number) { const item = props.pivots?.[index]; if (!item) return; setPivot(index); setInteraction(null); const payload: ChartPivotPayload = { pivot: index, label: item.label }; emit('pivot', payload); },
    announcement: active && activeIndex >= 0 ? `${String(data[activeIndex][x] ?? activeIndex + 1)}. ${shown.map(item => `${item.label}: ${valueFormat(number(data[activeIndex][item.key]))}`).join('. ')}` : '',
  };
}
export type ChartModel = ReturnType<typeof useChart>;
