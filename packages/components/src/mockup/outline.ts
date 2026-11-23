import { getStroke } from 'perfect-freehand';
import { pathStrokes, simplifyDrawingPoints, type FeedbackPoint } from './engine/feedback';

export function strokeOutline(points: readonly FeedbackPoint[], width: number, height: number, pressure?: readonly number[]) {
  if (!points.length || width <= 0 || height <= 0) return '';
  const samples = pressure ? points : simplifyDrawingPoints([...points]);
  const outline = getStroke(samples.map(([x, y], i) => [x * width / 100, y * height / 100, pressure?.[i] ?? .5]), {
    size: 4, thinning: .6, smoothing: .65, streamline: .4, simulatePressure: !pressure,
    start: { taper: 10 }, end: { taper: 14 }, last: true,
  });
  if (!outline.length) return '';
  return `M${outline.map(p => p.join(' ')).join('L')}Z`;
}

export function drawingOutline(path: string, width: number, height: number, pressure?: readonly (readonly number[])[]) {
  try { return pathStrokes(path).map((points, i) => strokeOutline(points, width, height, pressure?.[i])).join(''); } catch { return ''; }
}

export function regionDimensions(first: FeedbackPoint, last: FeedbackPoint, width: number, height: number, scale = 1) {
  return `${Math.round(Math.abs(last[0] - first[0]) / 100 * width / scale)} × ${Math.round(Math.abs(last[1] - first[1]) / 100 * height / scale)}`;
}
