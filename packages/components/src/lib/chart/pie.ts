import { formatCoord } from './path';

const tau = Math.PI * 2;
export interface PieOptions { startAngle?: number; endAngle?: number; padAngle?: number; sort?: boolean | ((a: number, b: number) => number) }
export interface PieArc { index: number; order: number; value: number; startAngle: number; endAngle: number; padAngle: number }
export function pie(values: readonly (number | null | undefined)[], { startAngle = 0, endAngle = tau, padAngle = 0, sort = false }: PieOptions = {}): PieArc[] {
  if (![startAngle, endAngle, padAngle].every(Number.isFinite)) return [];
  const span = Math.max(-tau, Math.min(tau, endAngle - startAngle));
  const direction = span < 0 ? -1 : 1;
  const pad = Math.min(Math.abs(span) / Math.max(1, values.length), Math.max(0, padAngle));
  const clean = values.map(value => value != null && Number.isFinite(value) && value > 0 ? value : 0);
  let max = 0;
  for (const value of clean) if (value > max) max = value;
  const total = max ? clean.reduce((sum, value) => sum + value / max, 0) : 0;
  const order = values.map((_, index) => index);
  if (sort) order.sort((a, b) => typeof sort === 'function' ? sort(clean[a], clean[b]) : clean[b] - clean[a]);
  const arcs = new Array<PieArc>(values.length);
  let angle = startAngle;
  for (let rank = 0; rank < order.length; rank++) {
    const index = order[rank];
    const size = total ? (Math.abs(span) - pad * values.length) * (clean[index] / max) / total : 0;
    const next = angle + direction * (size + pad);
    arcs[index] = { index, order: rank, value: clean[index], startAngle: angle + direction * pad / 2, endAngle: next - direction * pad / 2, padAngle: pad };
    angle = next;
  }
  return arcs;
}
export interface ArcGeometry { innerRadius?: number; outerRadius: number; startAngle: number; endAngle: number; cornerRadius?: number; precision?: number }
export function polar(radius: number, angle: number): [number, number] { return [radius * Math.sin(angle), -radius * Math.cos(angle)]; }
export function arcPath({ innerRadius = 0, outerRadius, startAngle, endAngle, cornerRadius = 0, precision = 2 }: ArcGeometry): string {
  if (![innerRadius, outerRadius, startAngle, endAngle].every(Number.isFinite)) return '';
  let inner = Math.max(0, innerRadius), outer = Math.max(0, outerRadius);
  if (inner > outer) [inner, outer] = [outer, inner];
  const span = Math.min(tau, Math.abs(endAngle - startAngle));
  if (!outer || outer === inner || span < 1e-12) return '';
  const direction = endAngle < startAngle ? -1 : 1;
  const end = startAngle + direction * span;
  const sweep = direction > 0 ? 1 : 0;
  const f = (value: number) => formatCoord(value, precision);
  const p = (radius: number, angle: number) => { const [x, y] = polar(radius, angle); return `${f(x)},${f(y)}`; };
  const a = (radius: number, angle: number, large: number, turn = sweep) => `A${f(radius)},${f(radius)},0,${large},${turn},${p(radius, angle)}`;
  if (span >= tau - 1e-10) {
    let path = `M${p(outer, startAngle)}` + a(outer, startAngle + direction * Math.PI, 1) + a(outer, end, 1) + 'Z';
    if (inner) path += `M${p(inner, startAngle)}` + a(inner, startAngle - direction * Math.PI, 1, 1 - sweep) + a(inner, startAngle - direction * tau, 1, 1 - sweep) + 'Z';
    return path;
  }
  const corner = Math.max(0, Math.min(Number.isFinite(cornerRadius) ? cornerRadius : 0, (outer - inner) / 2, outer * Math.sin(Math.min(Math.PI, span) / 2) / 2));
  const outerInset = corner ? Math.min(span / 2, Math.asin(corner / outer)) : 0;
  let path = `M${p(outer - corner, startAngle)}`;
  if (corner) path += `Q${p(outer, startAngle)},${p(outer, startAngle + direction * outerInset)}`;
  path += a(outer, end - direction * outerInset, span - outerInset * 2 > Math.PI ? 1 : 0);
  if (corner) path += `Q${p(outer, end)},${p(outer - corner, end)}`;
  if (inner) {
    const inset = corner ? Math.min(span / 2, Math.asin(Math.min(1, corner / inner))) : 0;
    path += `L${p(inner + corner, end)}`;
    if (corner) path += `Q${p(inner, end)},${p(inner, end - direction * inset)}`;
    path += a(inner, startAngle + direction * inset, span - inset * 2 > Math.PI ? 1 : 0, 1 - sweep);
    if (corner) path += `Q${p(inner, startAngle)},${p(inner + corner, startAngle)}`;
  } else path += 'L0,0';
  return path + 'Z';
}
export function arcCentroid({ innerRadius = 0, outerRadius, startAngle, endAngle }: ArcGeometry): [number, number] { return polar((innerRadius + outerRadius) / 2, (startAngle + endAngle) / 2); }
export function arcLabel(arc: ArcGeometry, { offset = 16, labelOffset = 12 }: { offset?: number; labelOffset?: number } = {}) {
  const angle = (arc.startAngle + arc.endAngle) / 2;
  const edge = polar(arc.outerRadius, angle), knee = polar(arc.outerRadius + offset, angle);
  const side = Math.sin(angle) >= 0 ? 1 : -1;
  const end: [number, number] = [side * (arc.outerRadius + offset + labelOffset), knee[1]];
  return { x: end[0], y: end[1], side, anchor: side > 0 ? 'start' as const : 'end' as const, leader: [edge, knee, end] as const };
}
