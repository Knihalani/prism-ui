import type { ChartProps, ChartSeries, ChartType } from './use-chart';

const object = (value: any) => value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value : undefined;
const type = (value: unknown) => ['line', 'bar', 'area', 'pie'].includes(value as string) ? value as ChartType : undefined;
const series = (value: unknown): ChartSeries[] | undefined => Array.isArray(value) ? value.filter(item => object(item) && typeof item.key === 'string' && item.key).map(item => ({ key: item.key, label: text(item.label), color: text(item.color) })) : undefined;
export function streamProps(props: ChartProps): ChartProps {
  return { ...props, title: text(props.title), subtitle: text(props.subtitle), insight: text(props.insight), yLabel: text(props.yLabel),
    x: text(props.x), type: type(props.type), series: series(props.series),
    data: Array.isArray(props.data) ? props.data.filter(object).map(row => Object.fromEntries(Object.entries(row).filter(([, value]) => value == null || ['string', 'number', 'boolean'].includes(typeof value)))) : [],
    height: typeof props.height === 'number' && Number.isFinite(props.height) ? Math.max(180, Math.min(900, props.height)) : undefined,
    currency: text(props.currency), format: ['number', 'currency', 'percent', 'compact'].includes(props.format!) ? props.format : undefined,
    curve: ['linear', 'step', 'monotone'].includes(props.curve!) ? props.curve : undefined,
    annotations: Array.isArray(props.annotations) ? props.annotations.filter(item => object(item) && typeof item.label === 'string' && item.label && (typeof item.x === 'string' || typeof item.x === 'number' && Number.isFinite(item.x))) : [],
    pivots: Array.isArray(props.pivots) ? props.pivots.filter(item => object(item) && typeof item.label === 'string' && item.label).map(item => ({ label: item.label, type: type(item.type), x: text(item.x), series: series(item.series) })) : [],
  };
}
