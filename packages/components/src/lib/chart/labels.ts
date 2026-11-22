export interface LabelBox { x: number; y: number; w: number; h: number; priority?: number }
export interface LabelBounds { x: number; y: number; w: number; h: number }
export function overlaps(a: LabelBounds, b: LabelBounds, gap = 0): boolean { return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y; }
function valid(box: LabelBounds): boolean { return [box.x, box.y, box.w, box.h].every(Number.isFinite) && box.w >= 0 && box.h >= 0; }
export function thinAxisLabels<T extends LabelBox>(labels: readonly T[], { orientation = 'horizontal', gap = 4, keepEnds = true }: { orientation?: 'horizontal' | 'vertical'; gap?: number; keepEnds?: boolean } = {}): T[] {
  const input = labels.filter(valid).sort((a, b) => orientation === 'horizontal' ? a.x - b.x : a.y - b.y);
  if (input.length < 2) return input;
  const fits = (a: T, b: T) => orientation === 'horizontal' ? a.x + a.w + gap <= b.x : a.y + a.h + gap <= b.y;
  for (let stride = 1; stride <= input.length; stride++) {
    const selected: T[] = [];
    for (let i = 0; i < input.length; i += stride) selected.push(input[i]);
    if (keepEnds && selected[selected.length - 1] !== input[input.length - 1]) selected.push(input[input.length - 1]);
    if (selected.every((label, i) => !i || fits(selected[i - 1], label))) return selected;
  }
  return keepEnds ? [input[0], input[input.length - 1]] : [input[0]];
}
export interface PlacementOptions { offsets?: readonly (readonly [number, number])[]; gap?: number; bounds?: LabelBounds }
export function placeLabels<T extends LabelBox>(labels: readonly T[], { offsets, gap = 2, bounds }: PlacementOptions = {}): { placed: T[]; dropped: T[] } {
  const placed: T[] = [], dropped: T[] = [];
  const sorted = [...labels].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  for (const label of sorted) {
    if (!valid(label)) { dropped.push(label); continue; }
    const candidates = offsets ?? [[0, 0], [0, -label.h - gap], [0, label.h + gap], [-label.w - gap, 0], [label.w + gap, 0]];
    let found = false;
    for (const [dx, dy] of candidates) {
      const candidate = { ...label, x: label.x + dx, y: label.y + dy };
      if (bounds && (candidate.x < bounds.x || candidate.y < bounds.y || candidate.x + candidate.w > bounds.x + bounds.w || candidate.y + candidate.h > bounds.y + bounds.h)) continue;
      if (placed.some(other => overlaps(candidate, other, gap))) continue;
      placed.push(candidate); found = true; break;
    }
    if (!found) dropped.push(label);
  }
  return { placed, dropped };
}
export function relaxPieLabels<T extends LabelBox & { side?: number }>(labels: readonly T[], { minY = -Infinity, maxY = Infinity, gap = 2 }: { minY?: number; maxY?: number; gap?: number } = {}): { placed: T[]; dropped: T[] } {
  const placed: T[] = [], dropped: T[] = [];
  for (const side of [-1, 1]) {
    let group = labels.filter(label => ((label.side ?? label.x) < 0 ? -1 : 1) === side && valid(label)).map(label => ({ ...label }));
    while (group.length && group.reduce((sum, label) => sum + label.h, gap * (group.length - 1)) > maxY - minY) {
      let lowest = 0;
      for (let i = 1; i < group.length; i++) if ((group[i].priority ?? 0) < (group[lowest].priority ?? 0)) lowest = i;
      dropped.push(group.splice(lowest, 1)[0]);
    }
    group.sort((a, b) => a.y - b.y);
    let bottom = minY;
    for (const label of group) { label.y = Math.max(label.y, bottom); bottom = label.y + label.h + gap; }
    let top = maxY;
    for (let i = group.length - 1; i >= 0; i--) { group[i].y = Math.min(group[i].y, top - group[i].h); top = group[i].y - gap; }
    placed.push(...group);
  }
  dropped.push(...labels.filter(label => !valid(label)));
  return { placed, dropped };
}
