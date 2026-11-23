import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type MouseEvent } from 'react';
import { ComponentContext, useComponentState, useEmit, useFlash, useLocalWrite, useStrings, type PrismContextValue } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { arcLabel, arcPath, areaPath, barPath, createExtentTracker, createStableDomain, linePath, niceTicks, pie, pivotLongToWide, pivotWideToLong, placeLabels, relaxPieLabels, scaleBand, scaleLinear, stack, thinAxisLabels, type DataRow, type Point } from '../lib/chart';
import { format } from '../lib/format';
import { streamProps } from './stream-props';
import { useDomain } from './use-domain';
import { componentStrings } from '../strings';
import { interpolate } from '../interpolate';
import { useFrame } from '../frame';
import { nearestX, pointY } from '../lib/chart';

export const chartStrings = { ...componentStrings.chart, title: 'Chart', total: 'Total', instructions: '{title}. Use arrow keys to explore; Enter selects a point.', description: 'Interactive chart. A data table follows for screen readers.', toggleSeries: 'Toggle {series}', emptyValue: '—', pointLabel: '{category}: {value}', sliceValue: ' · {value}', dataCaption: '{title} {data}', announcement: '{category}. {values}', seriesValue: '{series}: {value}', valueSeparator: '. ', invalidData: 'No numeric values', tooltipLabel: 'Values for {category}', askMessage: 'Tell me more about this chart…', selectMessage: 'User select in chart: {payload}', pivotMessage: 'User pivot in chart: {payload}' };
export interface ChartPoint { index: number; row: DataRow; x: unknown; value: number | null }


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
const semanticColor = (name: string) => `var(--prism-chart-${name}, var(--prism-${name}, var(--prism-chart-text, var(--prism-text))))`;
const palette = ['accent', 'info', 'positive', 'warning', 'danger'].map(semanticColor);
palette.push(`color-mix(in srgb, ${palette[0]} 55%, ${palette[4]})`, `color-mix(in srgb, ${palette[2]} 55%, ${palette[1]})`, `color-mix(in srgb, ${palette[3]} 55%, ${palette[4]})`);
export const seriesColor = (series: ChartSeries, index: number) => series.color ?? `var(--prism-chart-${index % 8 + 1}, ${palette[index % 8]})`;
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
export function useChart(inputProps: ChartProps, ctx: PrismContextValue, fixedWidth?: number, fixedDuration?: number) {
  const strings = useStrings('chart', chartStrings), container = useRef<HTMLDivElement>(null), [measuredWidth, setWidth] = useState(640), [motion, setMotion] = useState({ duration: 180, easing: 'ease-out' });
  const id = `prism-chart-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`, localWrite = useLocalWrite(), component = useContext(ComponentContext), flashing = useFlash(component?.id ?? '');
  useEffect(() => {
    const element = container.current; if (!element || typeof ResizeObserver === 'undefined') return;
    const style = getComputedStyle(element), token = style.getPropertyValue('--prism-chart-motion-base').trim() || style.getPropertyValue('--prism-motion-base').trim(), duration = parseFloat(token) * (token.endsWith('ms') ? 1 : 1000);
    setMotion({ duration: Number.isFinite(duration) ? duration : 180, easing: style.getPropertyValue('--prism-chart-motion-ease').trim() || style.getPropertyValue('--prism-motion-ease').trim() || 'ease-out' });
    const observer = new ResizeObserver(entries => { const next = entries[0]?.contentRect.width; if (next && next > 0) setWidth(Math.max(1, Math.round(next))); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const width = fixedWidth ?? measuredWidth, duration = fixedDuration ?? motion.duration;
  const props = useMemo(() => streamProps(inputProps), [inputProps]);
  const frame = useFrame({ component: 'chart', title: props.title ?? strings.title, undo: true });
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
      const values = shown.map(item => number(row[item.key])).filter((value): value is number => value !== null);
      if (!values.length) return null;
      return props.stacked && type !== 'line' ? values.filter(value => max ? value > 0 : value < 0).reduce((a, b) => a + b, 0) : (max ? Math.max : Math.min)(0, ...values);
    };
    return { stable: createStableDomain({ hysteresis: .5, includeZero: true }), min: createExtentTracker<DataRow>(row => extent(row, false)), max: createExtentTracker<DataRow>(row => extent(row, true)), previous: [] as DataRow[], tail: '', capacity: 4 };
  }, [signature]);
  const valueFormat = useCallback((value: unknown) => format(value, props.format ?? 'number', { locale: ctx.format.locale, currency: props.currency ?? ctx.format.currencyCode, fallback: strings.emptyValue }), [props.format, props.currency, ctx.format, strings.emptyValue]);
  const height = props.height ?? 300;
  const targetDomain = useMemo(() => {
    const tailSignature = (row: DataRow | undefined) => JSON.stringify(shown.map(item => row?.[item.key]));
    if (domains.previous !== data && (props.complete !== false || data.length < domains.previous.length || domains.tail !== tailSignature(data[domains.previous.length - 1]))) { domains.min.reset(); domains.max.reset(); }
    const lo = domains.min.update(data), hi = domains.max.update(data);
    domains.previous = data; domains.tail = tailSignature(data.at(-1));
    if (!lo || !hi) return null;
    return (props.complete === false ? domains.stable : createStableDomain({ hysteresis: 0, includeZero: true })).update(lo[0], hi[1]);
  }, [data, domains, shown, props.complete]);
  const displayDomain = useDomain(targetDomain, ctx.animate, duration, motion.easing);
  const geometry = useMemo(() => {
    const domain = targetDomain ?? [0, 1] as [number, number];
    const left = width <= 320 ? 48 : 70, right = Math.max(left + 40, width - 26), top = 42, bottom = height - 38;
    const yScale = scaleLinear({ domain: displayDomain, range: [bottom, top] });
    while (domains.capacity < data.length) domains.capacity *= 2;
    const band = scaleBand({ domain: Array.from({ length: props.complete === false ? domains.capacity : data.length }, (_, i) => i), range: [left, right], paddingInner: .28, paddingOuter: .15 });
    const xs = data.map((_, i) => band.map(i) + band.bandwidth / 2);
    const stacks = props.stacked && type !== 'line' ? stack(data, shown.map(item => item.key), { offset: 'diverging' }) : undefined;
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
    const radius = Math.max(24, Math.min(width / 2 - 80, (bottom - top) / 2 - 12)), cx = width / 2, cy = (top + bottom) / 2;
    const arcs = pie(data.map(row => Math.max(0, number(shown[0] ? row[shown[0].key] : null) ?? 0)), { padAngle: .025 });
    const slices = arcs.map((arc, i) => {
      const shape = { ...arc, innerRadius: radius * .65, outerRadius: radius, cornerRadius: 3 };
      const label = arcLabel(shape, { offset: 8, labelOffset: 8 });
      return { d: arcPath(shape), color: seriesColor({ key: '', color: shown[0]?.color }, i), ...label, value: arc.value, index: i, text: String(data[i][x] ?? i + 1) };
    });
    const pieLabels = relaxPieLabels(slices.filter(slice => slice.value > 0).map(slice => {
      const formatted = valueFormat(slice.value);
      return { ...slice, formatted, w: (slice.text.length + formatted.length + 3) * 6, h: 16, priority: slice.value };
    }), { minY: -height / 2 + 28, maxY: height / 2 - 28 });
    const ticks = targetDomain ? niceTicks(...domain, width <= 320 ? 3 : 5).filter(value => value >= domain[0] && value <= domain[1]).map(value => ({ value, y: yScale.map(value), label: valueFormat(value) })) : [];
    const labels = thinAxisLabels(data.map((row, i) => { const label = String(row[x] ?? i + 1); return { x: xs[i] - label.length * 3, y: bottom + 12, w: label.length * 6, h: 16, index: i, text: label }; })).filter(label => width > 320 || [0, Math.floor((data.length - 1) / 2), data.length - 1].includes(label.index));
    const annotations = placeLabels((props.annotations ?? []).flatMap((annotation, i) => {
      const index = data.findIndex(row => String(row[x]) === String(annotation.x));
      if (index < 0) return [];
      const w = Math.min(right - left, annotation.label.length * 6 + 16);
      return [{ x: Math.max(left, Math.min(right - w, xs[index] - w / 2)), y: top - 30, w, h: 22, index, label: annotation.label, priority: -i }];
    }), { bounds: { x: left, y: 0, w: right - left, h: height - 40 } }).placed;
    return { width, height, type, domain, displayDomain, hasValues: !!targetDomain, left, right, top, bottom, xs, yScale, layers, ticks, labels, annotations, slices, pieLabels, cx, cy, total: slices.reduce((sum, slice) => sum + slice.value, 0) };
  }, [data, shown, series, type, props.stacked, props.curve, props.annotations, props.complete, domains, width, height, x, valueFormat, targetDomain, displayDomain]);
  const annotated = props.annotations?.map(annotation => data.findIndex(row => String(row[x]) === String(annotation.x))).find(index => index >= 0) ?? (props.insight && data.length ? 0 : -1);
  const activeIndex = data.length ? Math.max(0, Math.min(data.length - 1, interaction?.index ?? (annotated >= 0 ? annotated : 0))) : -1;
  const activeSeries = type === 'pie' ? 0 : Math.max(0, Math.min(shown.length - 1, interaction?.series ?? 0));
  const active = interaction || annotated >= 0 ? { index: activeIndex, series: activeSeries } : null;
  const selectPoint = (index: number, seriesIndex: number) => {
    const row = data[index], item = shown[seriesIndex]; if (!row || !item) return;
    const payload: ChartSelectPayload = { x: row[x] ?? index, series: item.key, value: number(row[item.key]) };
    emit('select', payload, interpolate(strings.selectMessage, { payload: JSON.stringify(payload) }));
  };
  const activate = (next: typeof interaction) => setInteraction(previous => previous?.index === next?.index && previous?.series === next?.series ? previous : next);
  const point = (index: number, item: ChartSeries = shown[0]): ChartPoint => ({ index, row: data[index], x: data[index]?.[x] ?? index + 1, value: number(data[index]?.[item?.key]) });
  const pointer = (event: PointerEvent<SVGSVGElement> | MouseEvent<SVGSVGElement>) => {
    if (!data.length) return null;
    const target = (event.target as globalThis.Element).closest?.('[data-index]');
    if (target) return { index: Number(target.getAttribute('data-index')), series: Number(target.getAttribute('data-series') ?? 0) };
    if (type === 'pie') return null;
    const rect = event.currentTarget.getBoundingClientRect(), position = (event.clientX - rect.left) * geometry.width / (rect.width || geometry.width);
    return position < geometry.left || position > geometry.right ? null : { index: nearestX(geometry.xs, position), series: activeSeries };
  };
  const tooltip = interaction && active && active.index >= 0 ? active : null;
  const tooltipHeight = (shown.length + 1) * 20 + 24;
  const anchor = tooltip && type !== 'pie' ? geometry.layers[tooltip.series]?.points[tooltip.index] : null, anchorY = anchor ? pointY(anchor) ?? geometry.cy : geometry.cy;
  const above = anchorY - tooltipHeight - 12, tooltipY = width <= 320 && tooltip ? Math.max(geometry.top + 8, Math.min(geometry.bottom - tooltipHeight, above >= geometry.top + 8 ? above : anchorY + 12)) : geometry.top + 8;
  return { geometry, props, strings, title: strings.title, heading: props.insight ?? strings.title, onAsk() { emit('ask', undefined, strings.askMessage); }, presentation: Object.fromEntries(Object.entries(frame.rootProps).filter(([key]) => key.startsWith('data-'))), container, width, id, frame, flashing, animate: ctx.animate, point, interaction, tooltip,
    tooltipX: tooltip && type !== 'pie' ? geometry.xs[tooltip.index] : width / 2,
    tooltipY,
    invalid: props.complete !== false && data.length > 0 && series.length > 0 && !geometry.hasValues,
    onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
      if (!data.length || !shown.length) return;
      let index = activeIndex, seriesIndex = activeSeries;
      if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = data.length - 1;
      else if (event.key === 'ArrowRight' || type === 'pie' && event.key === 'ArrowDown') index = (index + 1) % data.length;
      else if (event.key === 'ArrowLeft' || type === 'pie' && event.key === 'ArrowUp') index = (index - 1 + data.length) % data.length;
      else if (event.key === 'ArrowDown') seriesIndex = (seriesIndex + 1) % shown.length;
      else if (event.key === 'ArrowUp') seriesIndex = (seriesIndex - 1 + shown.length) % shown.length;
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectPoint(index, seriesIndex); return; }
      else return;
      event.preventDefault(); activate({ index, series: seriesIndex });
    },
    onPointerMove(event: PointerEvent<SVGSVGElement>) { const next = pointer(event); if (next) activate(next); },
    onPointerLeave() { if (document.activeElement !== container.current?.querySelector('svg')) activate(null); },
    onFocus() { if (data.length) activate({ index: activeIndex, series: activeSeries }); },
    onClick(event: MouseEvent<SVGSVGElement>) { const next = pointer(event); if (next) { activate(next); selectPoint(next.index, next.series); } },
    type, x, series, shown, data, pivot, hidden, active, activeIndex, activeSeries, valueFormat,
    answer: !!(props.insight || props.annotations?.length || props.pivots?.length),
    activate, selectPoint,
    toggleSeries(key: string) { if (!shown.some(item => item.key === key) || shown.length > 1) localWrite(() => setHidden(old => old.includes(key) ? old.filter(value => value !== key) : [...old, key])); },
    choosePivot(index: number) { const item = props.pivots?.[index]; if (!item) return; localWrite(() => setPivot(index)); setInteraction(null); const payload: ChartPivotPayload = { pivot: index, label: item.label }; emit('pivot', payload, interpolate(strings.pivotMessage, { payload: JSON.stringify(payload) })); },
    announcement: active && activeIndex >= 0 ? interpolate(strings.announcement, { category: String(data[activeIndex][x] ?? activeIndex + 1), values: shown.map(item => interpolate(strings.seriesValue, { series: item.label!, value: valueFormat(number(data[activeIndex][item.key])) })).join(strings.valueSeparator) }) : '',
  };
}
export type ChartModel = ReturnType<typeof useChart>;
