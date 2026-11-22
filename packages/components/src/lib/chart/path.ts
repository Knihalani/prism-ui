export type Point = readonly [number, number | null] | { x: number; y: number | null };
export type MaybePoint = Point | null | undefined;
export interface PathOptions { curve?: 'linear' | 'monotone' | 'step'; precision?: number; defined?: (point: MaybePoint, index: number) => boolean }
export function pointX(point: Point): number { return 'x' in point ? point.x : point[0]; }
export function pointY(point: Point): number | null { return 'y' in point ? point.y : point[1]; }
export function defined(point: MaybePoint): point is Point { return point != null && Number.isFinite(pointX(point)) && pointY(point) != null && Number.isFinite(pointY(point)); }
export function formatCoord(value: number, precision = 2): string { return Number.isFinite(value) ? String(Number(value.toFixed(Math.max(0, Math.min(12, Math.floor(precision)))))) : '0'; }

function segment(points: readonly Point[], { curve = 'linear', precision = 2 }: PathOptions): string {
  if (!points.length) return '';
  const f = (value: number) => formatCoord(value, precision);
  let path = `M${f(pointX(points[0]))},${f(pointY(points[0])!)}`;
  let slopes: Float64Array | undefined, tangents: Float64Array | undefined;
  if (curve === 'monotone' && points.length > 1) {
    slopes = new Float64Array(points.length - 1); tangents = new Float64Array(points.length);
    for (let i = 0; i < slopes.length; i++) {
      const dx = pointX(points[i + 1]) - pointX(points[i]);
      slopes[i] = dx ? (pointY(points[i + 1])! - pointY(points[i])!) / dx : 0;
    }
    tangents[0] = slopes[0]; tangents[tangents.length - 1] = slopes[slopes.length - 1];
    for (let i = 1; i < tangents.length - 1; i++) tangents[i] = slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
    for (let i = 0; i < slopes.length; i++) {
      if (!slopes[i]) { tangents[i] = tangents[i + 1] = 0; continue; }
      const a = tangents[i] / slopes[i], b = tangents[i + 1] / slopes[i];
      const norm = Math.hypot(a, b);
      if (norm > 3) { const factor = 3 / norm; tangents[i] = factor * a * slopes[i]; tangents[i + 1] = factor * b * slopes[i]; }
    }
  }
  for (let i = 1; i < points.length; i++) {
    const x0 = pointX(points[i - 1]), y0 = pointY(points[i - 1])!, x = pointX(points[i]), y = pointY(points[i])!;
    if (curve === 'step') { const mid = (x0 + x) / 2; path += `H${f(mid)}V${f(y)}H${f(x)}`; }
    else if (tangents) {
      const dx = (x - x0) / 3;
      path += `C${f(x0 + dx)},${f(y0 + tangents[i - 1] * dx)},${f(x - dx)},${f(y - tangents[i] * dx)},${f(x)},${f(y)}`;
    } else path += `L${f(x)},${f(y)}`;
  }
  return path;
}
export function linePath(points: readonly MaybePoint[], options: PathOptions = {}): string {
  let path = '';
  let run: Point[] = [];
  for (let i = 0; i <= points.length; i++) {
    const point = points[i];
    if (i < points.length && defined(point) && (!options.defined || options.defined(point, i))) run.push(point);
    else if (run.length) { path += segment(run, options); run = []; }
  }
  return path;
}
export function areaPath(top: readonly MaybePoint[], baseline: number | readonly MaybePoint[] = 0, options: PathOptions = {}): string {
  let path = '';
  let upper: Point[] = [], lower: Point[] = [];
  for (let i = 0; i <= top.length; i++) {
    const point = top[i];
    const bottom: MaybePoint = typeof baseline === 'number' ? defined(point) ? [pointX(point), baseline] : null : baseline[i];
    if (i < top.length && defined(point) && defined(bottom) && (!options.defined || options.defined(point, i))) { upper.push(point); lower.push(bottom); }
    else if (upper.length) { path += segment(upper, options) + segment(lower.reverse(), options).replace(/^M/, 'L') + 'Z'; upper = []; lower = []; }
  }
  return path;
}
export interface BarRect { x: number; y: number; width: number; height: number; radius?: number; topOnly?: boolean; precision?: number }
export function barPath({ x, y, width, height, radius = 0, topOnly = false, precision = 2 }: BarRect): string {
  if (![x, y, width, height].every(Number.isFinite) || !width || !height) return '';
  if (width < 0) { x += width; width = -width; }
  if (height < 0) { y += height; height = -height; }
  const r = Math.max(0, Math.min(Number.isFinite(radius) ? radius : 0, width / 2, height / 2));
  const f = (value: number) => formatCoord(value, precision);
  const right = x + width, bottom = y + height;
  let path = `M${f(x + r)},${f(y)}H${f(right - r)}Q${f(right)},${f(y)},${f(right)},${f(y + r)}`;
  if (topOnly) path += `V${f(bottom)}H${f(x)}V${f(y + r)}`;
  else path += `V${f(bottom - r)}Q${f(right)},${f(bottom)},${f(right - r)},${f(bottom)}H${f(x + r)}Q${f(x)},${f(bottom)},${f(x)},${f(bottom - r)}V${f(y + r)}`;
  return path + `Q${f(x)},${f(y)},${f(x + r)},${f(y)}Z`;
}
