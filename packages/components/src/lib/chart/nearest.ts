import { defined, pointX, pointY, type MaybePoint, type Point } from './path';

export function nearestX(xs: ArrayLike<number | null | undefined>, x: number): number {
  if (!xs.length || !Number.isFinite(x)) return -1;
  function fallback(): number {
    let best = -1, distance = Infinity;
    for (let i = 0; i < xs.length; i++) { const value = xs[i]; if (value == null || !Number.isFinite(value)) continue; const d = Math.abs(value - x); if (d < distance) { best = i; distance = d; } }
    return best;
  }
  let lo = 0, hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const value = xs[mid];
    if (value == null || !Number.isFinite(value)) return fallback();
    if (value < x) lo = mid + 1; else hi = mid;
  }
  const right = Math.min(xs.length - 1, lo), left = Math.max(0, lo - 1);
  const a = xs[left], b = xs[right];
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return fallback();
  return x - a <= b - x ? left : right;
}
export interface NearestPoint { series: number; index: number; point: Point; distance: number }
export function nearestPoint(series: readonly (readonly MaybePoint[])[], x: number, y: number, maxDistance = Infinity): NearestPoint | undefined {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(maxDistance >= 0)) return undefined;
  let squared = maxDistance * maxDistance;
  let best: NearestPoint | undefined;
  for (let s = 0; s < series.length; s++) {
    for (let i = 0; i < series[s].length; i++) {
      const point = series[s][i];
      if (!defined(point)) continue;
      const dx = pointX(point) - x;
      if (dx * dx > squared) continue;
      const dy = pointY(point)! - y, distance = dx * dx + dy * dy;
      if (distance > squared || best && distance === squared) continue;
      squared = distance; best = { series: s, index: i, point, distance: Math.sqrt(distance) };
      if (!distance) return best;
    }
  }
  return best;
}
export function bandIndex(x: number, band: { indexAt(value: number): number }): number { return band.indexAt(x); }
