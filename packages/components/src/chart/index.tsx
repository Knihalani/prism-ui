import { createElement, memo, useEffect, useId, useRef, useState, type ElementType, type HTMLAttributes, type KeyboardEvent, type PointerEvent } from 'react';
import { defineComponent, registerComponent, usePart, usePrism, useSlot, type PrismComponentProps } from '@prism-ui/react';
import { nearestX, pointX, pointY } from '../lib/chart';
import { useFrame } from '../frame';
import { chartSchema, seriesColor, useChart, type ChartModel, type ChartProps } from './use-chart';

export { chartSchema, useChart } from './use-chart';
export type { ChartProps, ChartSeries, ChartType, ChartPivot, ChartAnnotation, ChartModel, ChartSelectPayload, ChartPivotPayload } from './use-chart';
interface ElementProps extends HTMLAttributes<HTMLElement> { as?: ElementType; [key: string]: any }
function Element({ as = 'div', ...props }: ElementProps) { return createElement(as, props); }
function Part({ part, state, style, ...props }: ElementProps & { part: string; state?: string }) {
  const attrs = usePart('chart', part, state), View = useSlot('chart', part, Element);
  return <View {...attrs} {...props} style={{ ...style, ...attrs.style }} />;
}
const Plot = memo(function Plot({ geometry: g, id, pivot }: { geometry: ChartModel['geometry']; id: string; pivot: number }) {
  return <Part part="plot" as="g" key={pivot}>
    <defs>{g.layers.map((layer, index) => <linearGradient key={layer.key} id={`${id}-${index}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={layer.color} stopOpacity=".32" /><stop offset="100%" stopColor={layer.color} stopOpacity=".03" /></linearGradient>)}</defs>
    {g.type !== 'pie' && <>
      {g.ticks.map(tick => <g key={tick.value}><Part part="grid" as="line" x1={g.left} x2={g.right} y1={tick.y} y2={tick.y} /><Part part="tick" as="text" x={g.left - 12} y={tick.y + 4} textAnchor="end">{tick.label}</Part></g>)}
      {g.labels.map(label => <Part key={label.index} part="tick" as="text" x={g.xs[label.index]} y={g.bottom + 24} textAnchor="middle">{label.text}</Part>)}
    </>}
    {g.type === 'pie' ? <g transform={`translate(${g.cx},${g.cy})`}>
      {g.slices.map(slice => <Part key={slice.index} part="slice" as="path" d={slice.d} fill={slice.color} data-index={slice.index} data-series={0}><title>{slice.text}: {slice.value}</title></Part>)}
      {g.pieLabels.placed.map(label => <g key={label.index} pointerEvents="none"><Part part="leader" as="path" d={`M${label.leader[0].join(',')}L${label.leader[1].join(',')}L${label.x},${label.y + 8}`} /><Part part="tick" as="text" x={label.x} y={label.y + 12} textAnchor={label.anchor}>{label.text}<Part part="slice-value" as="tspan">{` · ${label.formatted}`}</Part></Part></g>)}
    </g> : g.layers.map((layer, s) => <g key={layer.key}>
      {g.type === 'bar' ? layer.bars.map((d, index) => <Part key={index} part="bar" as="path" d={d} fill={layer.color} data-index={index} data-series={s} />) : <>
        {g.type === 'area' && <Part part="area" as="path" d={layer.d} fill={`url(#${id}-${s})`} />}
        <Part part="line" as="path" d={layer.line} stroke={layer.color} fill="none" pathLength="1" />
        {layer.points.map((point, index) => point && <Part key={index} part="point" as="circle" cx={pointX(point)} cy={pointY(point)} r="3" fill={layer.color} data-index={index} data-series={s} />)}
      </>}
    </g>)}
    {g.type !== 'pie' && g.annotations.map((annotation, index) => <Part key={index} part="annotation" as="g" pointerEvents="none">
      <Part part="marker" as="line" x1={g.xs[annotation.index]} x2={g.xs[annotation.index]} y1={annotation.y + annotation.h} y2={g.bottom} />
      <Part part="pill" as="rect" x={annotation.x} y={annotation.y} width={annotation.w} height={annotation.h} rx="6" />
      <Part part="annotation-label" as="text" x={annotation.x + 8} y={annotation.y + 15}>{annotation.label}</Part>
    </Part>)}
  </Part>;
});
function ActiveMark({ vm }: { vm: ChartModel }) {
  const g = vm.geometry, active = vm.active;
  if (!active || active.index < 0 || !vm.shown.length) return null;
  const layer = g.layers[active.series];
  if (vm.type === 'pie') { const slice = g.slices[active.index]; return slice ? <Part part="highlight" as="path" d={slice.d} transform={`translate(${g.cx},${g.cy})`} fill="none" stroke={slice.color} strokeWidth="5" pointerEvents="none" /> : null; }
  const point = layer?.points[active.index];
  return <g pointerEvents="none"><Part part="crosshair" as="line" x1={g.xs[active.index]} x2={g.xs[active.index]} y1={g.top} y2={g.bottom} />
    {vm.type === 'bar' ? <Part part="highlight" as="path" d={layer?.bars[active.index]} fill={layer?.color} /> : point && <Part part="highlight" as="circle" cx={pointX(point)} cy={pointY(point)} r="5" fill={layer.color} />}
  </g>;
}
export function Chart({ props, complete }: PrismComponentProps<ChartProps>) {
  const ctx = usePrism(), container = useRef<HTMLDivElement>(null), [width, setWidth] = useState(640);
  const id = `prism-chart-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  useEffect(() => {
    const element = container.current; if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => { const next = entries[0]?.contentRect.width; if (next && next > 0) setWidth(Math.max(280, Math.round(next))); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const vm = useChart({ ...props, complete }, ctx, width), g = vm.geometry;
  const frame = useFrame({ component: 'chart', title: props.title, undo: true });
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!vm.data.length || !vm.shown.length) return;
    let index = vm.activeIndex, series = vm.activeSeries;
    if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = vm.data.length - 1;
    else if (event.key === 'ArrowRight' || vm.type === 'pie' && event.key === 'ArrowDown') index = (index + 1) % vm.data.length;
    else if (event.key === 'ArrowLeft' || vm.type === 'pie' && event.key === 'ArrowUp') index = (index - 1 + vm.data.length) % vm.data.length;
    else if (event.key === 'ArrowDown') series = (series + 1) % vm.shown.length;
    else if (event.key === 'ArrowUp') series = (series - 1 + vm.shown.length) % vm.shown.length;
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); vm.selectPoint(index, series); return; }
    else return;
    event.preventDefault(); vm.activate({ index, series });
  };
  const pointer = (event: PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    if (!vm.data.length) return null;
    const target = (event.target as globalThis.Element).closest?.('[data-index]');
    if (target) return { index: Number(target.getAttribute('data-index')), series: Number(target.getAttribute('data-series') ?? 0) };
    if (vm.type === 'pie') return null;
    const rect = event.currentTarget.getBoundingClientRect(), x = (event.clientX - rect.left) * g.width / (rect.width || g.width);
    if (x < g.left || x > g.right) return null;
    return { index: nearestX(g.xs, x), series: vm.activeSeries };
  };
  const active = vm.active && vm.active.index >= 0 ? vm.active : null;
  const tooltipX = active && vm.type !== 'pie' ? g.xs[active.index] / width * 100 : 55;
  return <Part part="root" state={complete ? 'done' : 'streaming'} role="figure" aria-labelledby={`${id}-title`} onKeyDown={frame.rootProps.onKeyDown} data-animate={ctx.animate ? undefined : 'false'} data-mode={vm.answer ? 'answer' : 'chart'}>
    <Part part="header"><div><Part part="title" as="h3" id={`${id}-title`}>{props.insight ?? props.title ?? 'Chart'}</Part>{props.insight && props.title && <Part part="subtitle">{props.title}</Part>}{props.subtitle && <Part part="subtitle">{props.subtitle}</Part>}</div>
      <Part part="actions"><Part part="ask" as="button" type="button" aria-label="Ask about this chart" onClick={frame.onAsk}>?</Part><Part part="undo" as="button" type="button" aria-label="Undo chart change" disabled={!frame.canUndo} onClick={frame.onUndo}>↶</Part></Part>
    </Part>
    {!!props.pivots?.length && <Part part="pivots" role="group" aria-label="Chart views">{props.pivots.map((pivot, index) => <Part key={index} part="pivot" as="button" type="button" aria-pressed={vm.pivot === index} onClick={() => vm.choosePivot(index)}>{pivot.label}</Part>)}</Part>}
    <div ref={container} {...usePart('chart', 'viewport')} style={{ position: 'relative', height: g.height, ...ctx.styles.chart?.viewport }}>
      <svg {...usePart('chart', 'svg')} width="100%" height={g.height} viewBox={`0 0 ${width} ${g.height}`} data-y-domain={g.domain.join(',')} role="img" aria-label={`${props.title ?? 'Chart'}. Use arrow keys to explore; Enter selects a point.`} tabIndex={0} onKeyDown={onKeyDown} onFocus={() => { if (!vm.active && vm.data.length) vm.activate({ index: vm.activeIndex, series: 0 }); }} onPointerMove={event => { const next = pointer(event); if (next && (next.index !== vm.active?.index || next.series !== vm.active?.series)) vm.activate(next); }} onPointerLeave={() => { if (document.activeElement !== container.current?.querySelector('svg')) vm.activate(null); }} onClick={event => { const next = pointer(event); if (next) { vm.activate(next); vm.selectPoint(next.index, next.series); } }}>
        <title>{props.title ?? props.insight ?? 'Chart'}</title><desc>{props.subtitle ?? props.yLabel ?? 'Interactive chart. A data table follows for screen readers.'}</desc>
        <Plot geometry={g} id={id} pivot={vm.pivot} />
        <ActiveMark vm={vm} />
        {vm.type === 'pie' && <><Part part="total" as="text" x={g.cx} y={g.cy - 2} textAnchor="middle">{vm.valueFormat(g.total)}</Part><Part part="total-caption" as="text" x={g.cx} y={g.cy + 18} textAnchor="middle">{vm.shown[0]?.label ?? 'Total'}</Part></>}
        {props.yLabel && vm.type !== 'pie' && <Part part="tick" as="text" x={g.left} y={14}>{props.yLabel}</Part>}
        {!vm.data.length && <Part part="skeleton" as="rect" x={g.left} y={g.top} width={g.right - g.left} height={g.bottom - g.top} rx="8" />}
      </svg>
      {active && <Part part="tooltip" role="tooltip" style={{ left: `${tooltipX}%`, top: 42, transform: tooltipX > 50 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}><Part part="tooltip-title">{String(vm.data[active.index][vm.x] ?? active.index + 1)}</Part>{vm.type === 'pie' && props.annotations?.filter(annotation => String(annotation.x) === String(vm.data[active.index][vm.x])).map((annotation, index) => <Part key={index} part="tooltip-annotation">{annotation.label}</Part>)}{vm.shown.map((series, index) => <Part key={series.key} part="tooltip-row" state={index === active.series ? 'active' : undefined}><span>{series.label}</span><strong>{vm.valueFormat(vm.data[active.index][series.key])}</strong></Part>)}</Part>}
      {!vm.data.length && <Part part="empty">{complete ? 'No chart data' : 'Loading chart…'}</Part>}
    </div>
    {props.legend !== false && <Part part="legend" aria-label="Series">{vm.series.map((series, index) => <Part key={series.key} part="legend-item" as="button" type="button" aria-pressed={vm.shown.some(item => item.key === series.key)} aria-label={`Toggle ${series.label}`} onClick={() => vm.toggleSeries(series.key)} onKeyDown={(event: KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); vm.toggleSeries(series.key); } }}><Part part="swatch" as="span" style={{ background: seriesColor(series, index) }} />{series.label}</Part>)}</Part>}
    <Part part="summary"><table><caption>{props.title ?? 'Chart'} data</caption><thead><tr><th scope="col">{vm.x}</th>{vm.series.map(series => <th key={series.key} scope="col">{series.label}</th>)}</tr></thead><tbody>{vm.data.map((row, index) => <tr key={index}><th scope="row">{String(row[vm.x] ?? index + 1)}</th>{vm.series.map(series => <td key={series.key}>{vm.valueFormat(row[series.key])}</td>)}</tr>)}</tbody></table></Part>
    <Part part="status" role="status" aria-live="polite">{vm.announcement}</Part>
  </Part>;
}
export const chartDefinition = defineComponent({ name: 'chart', schema: chartSchema, component: Chart, syntax: 'fence',
  docs: 'Responsive SVG; insight/annotations/pivots enable Answer mode. Point click/Enter emits select {x: category, series: key, value: number|null}. View chips emit pivot {pivot: zero-based index, label}. Pie: first visible series, rows as slices. Legend keeps one visible. Views support undo.',
  examples: ['```ui:chart\n{"type":"line","title":"Revenue","x":"month","series":[{"key":"revenue","label":"Revenue"}],"data":[{"month":"Jan","revenue":120}],"insight":"Revenue is growing","annotations":[{"x":"Jan","label":"Launch"}],"pivots":[{"label":"Bars","type":"bar"}]}\n```'] });
registerComponent(chartDefinition);
