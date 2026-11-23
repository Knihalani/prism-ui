export interface SurfaceRect { left: number; top: number; width: number; height: number }
export function placeReadout(width: number, height: number, x: number, y: number, labelWidth: number, labelHeight: number, gap = 6) {
  const fit = (corner: number, size: number, limit: number) => Math.max(0, Math.min(limit - size - gap, corner + size + gap > limit ? corner - size - gap : corner + gap));
  return { left: fit(x, labelWidth, width), top: fit(y, labelHeight, height) };
}
const overlap = (a: SurfaceRect, b: SurfaceRect) => Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

export function placeComposer(surface: SurfaceRect, anchor: { x: number; y: number }, viewport: { width: number; height: number; left?: number; top?: number }, height = 210, avoid?: SurfaceRect) {
  const left = viewport.left ?? 0, top = viewport.top ?? 0, available = Math.max(0, viewport.height - 24);
  height = Math.min(height, available);
  const minX = Math.max(left + 12, Math.min(left + viewport.width - 12, surface.left + 12)), maxX = Math.max(minX, Math.min(left + viewport.width - 12, surface.left + surface.width - 12));
  const width = Math.max(0, Math.min(260, maxX - minX)), constrainY = surface.height >= height + 24 && surface.top < top + viewport.height - height - 12 && surface.top + surface.height > top + height + 12;
  const minY = Math.min(top + viewport.height - height - 12, Math.max(top + 12, constrainY ? surface.top + 12 : top + 12)), maxY = Math.max(minY, Math.min(top + viewport.height - height - 12, constrainY ? surface.top + surface.height - height - 12 : Infinity));
  const pin = { left: anchor.x - 17, top: anchor.y - 17, width: 34, height: 34 };
  const candidates = [
    { left: anchor.x - 24, top: anchor.y + 24 }, { left: anchor.x - 24, top: anchor.y - height - 24 },
    { left: anchor.x + 24, top: anchor.y - height / 2 }, { left: anchor.x - width - 24, top: anchor.y - height / 2 },
  ].map(p => ({ left: Math.max(minX, Math.min(maxX - width, p.left)), top: Math.max(minY, Math.min(maxY, p.top)), width, height }));
  const score = (r: SurfaceRect) => overlap(r, pin) * 10 + (avoid ? overlap(r, avoid) * 20 : 0);
  const chosen = candidates.reduce((best, next) => score(next) < score(best) ? next : best);
  const x = anchor.x - chosen.left, y = anchor.y - chosen.top;
  const side = y <= 0 ? 'top' : y >= height ? 'bottom' : x <= 0 ? 'left' : 'right';
  return { left: chosen.left, top: chosen.top, width, side, caretX: Math.max(12, Math.min(width - 12, x)), caretY: Math.max(12, Math.min(height - 12, y)), transformOrigin: `${x}px ${y}px` };
}
