import type { ChartProps, ChartSeries, ChartType } from '../../chart/use-chart';
import { arcLabel, arcPath, pie } from './pie';
import { areaPath, barPath, linePath } from './path';
import { placeLabels, relaxPieLabels, thinAxisLabels } from './labels';
import { scaleBand, scaleLinear } from './scale';
import { niceTicks } from './ticks';
import { stack } from './stack';
import type { DataRow } from './pivot';
import type { Point } from './path';

const semanticColor = (name: string) => `var(--prism-chart-${name}, var(--prism-${name}, var(--prism-chart-text, var(--prism-text))))`;
const palette = ['accent', 'info', 'positive', 'warning', 'danger'].map(semanticColor);
palette.push(`color-mix(in srgb, ${palette[0]} 55%, ${palette[4]})`, `color-mix(in srgb, ${palette[2]} 55%, ${palette[1]})`, `color-mix(in srgb, ${palette[3]} 55%, ${palette[4]})`);
export const seriesColor = (series: ChartSeries, index: number) => series.color ?? `var(--prism-chart-${index % 8 + 1}, ${palette[index % 8]})`;
export const chartNumber = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

export interface GeometryInput {
  data: DataRow[]; shown: ChartSeries[]; series: ChartSeries[]; type: ChartType;
  props: Pick<ChartProps, 'complete' | 'stacked' | 'curve' | 'annotations'>;
  domains: { capacity: number }; width: number; height: number; x: string;
  valueFormat: (value: unknown) => string;
  targetDomain: readonly [number, number] | null; displayDomain: readonly [number, number];
}
export function chartGeometry({ data, shown, series, type, props, domains, width, height, x, valueFormat, targetDomain, displayDomain }: GeometryInput) {
  const domain = targetDomain ?? [0, 1] as [number, number];
  const left = width <= 320 ? 48 : 70, right = Math.max(left + 40, width - 26), top = 42, bottom = height - 38;
  const yScale = scaleLinear({ domain: displayDomain, range: [bottom, top] });
  while (domains.capacity < data.length) domains.capacity *= 2;
  const band = scaleBand({ domain: Array.from({ length: props.complete === false ? domains.capacity : data.length }, (_, i) => i), range: [left, right], paddingInner: .28, paddingOuter: .15 });
  const xs = data.map((_, i) => band.map(i) + band.bandwidth / 2);
  const stacks = props.stacked && type !== 'line' ? stack(data, shown.map(item => item.key), { offset: 'diverging' }) : undefined;
  const layers = shown.map((item, s) => {
    const topPoints: (Point | null)[] = data.map((row, i) => chartNumber(row[item.key]) === null ? null : [xs[i], yScale.map(stacks?.[s][i][1] ?? chartNumber(row[item.key]))]);
    const baseline: (Point | null)[] = data.map((_, i) => [xs[i], yScale.map(stacks?.[s][i][0] ?? 0)]);
    const curve = props.curve ?? 'monotone', line = linePath(topPoints, { curve });
    return { key: item.key, color: seriesColor(item, series.findIndex(value => value.key === item.key)),
      d: type === 'area' ? areaPath(topPoints, baseline, { curve }) : line,
      line,
      points: topPoints,
      bars: data.map((row, i) => {
        const from = stacks?.[s][i][0] ?? 0, to = stacks?.[s][i][1] ?? chartNumber(row[item.key]) ?? 0;
        const barWidth = band.bandwidth / (props.stacked ? 1 : Math.max(1, shown.length));
        const start = yScale.map(from), end = yScale.map(to);
        return barPath({ x: band.map(i) + (props.stacked ? 0 : s * barWidth), y: Math.min(start, end), width: barWidth, height: Math.abs(end - start), radius: 3, topOnly: true });
      }),
    };
  });
  const radius = Math.max(24, Math.min(width / 2 - 80, (bottom - top) / 2 - 12)), cx = width / 2, cy = (top + bottom) / 2;
  const arcs = pie(data.map(row => Math.max(0, chartNumber(shown[0] ? row[shown[0].key] : null) ?? 0)), { padAngle: .025 });
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
}
