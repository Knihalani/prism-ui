import type { Anchor, Box, HitTarget } from './protocol';

export type FeedbackKind = 'pin' | 'region' | 'drawing';
export type FeedbackTarget = Pick<HitTarget, 'selector'> & Partial<Pick<HitTarget, 'text' | 'html'>>;
export interface FeedbackAnchor {
  key: string;
  selector: string;
  fx: number;
  fy: number;
  fw?: number;
  fh?: number;
}
export interface FeedbackItem {
  id: string;
  n: number;
  kind: FeedbackKind;
  x: number;
  y: number;
  w?: number;
  h?: number;
  path?: string;
  color?: string;
  comment: string;
  target?: FeedbackTarget;
  anchor?: FeedbackAnchor;
  resolved?: boolean;
  createdAt: number;
}
export interface FeedbackContext { mockup?: string; variant?: string; device?: string }
export interface FeedbackState extends FeedbackContext { items: FeedbackItem[]; overall: string }
export interface FeedbackInit extends FeedbackContext {
  items?: FeedbackItem[];
  overall?: string;
  now?: () => number;
  id?: () => string;
}
export interface FeedbackPayload extends FeedbackContext {
  overall: string;
  items: (Pick<FeedbackItem, 'n' | 'kind' | 'x' | 'y' | 'comment'> &
    Partial<Pick<FeedbackItem, 'w' | 'h' | 'path' | 'target'>>)[];
}
export interface PinInput { x: number; y: number; comment?: string; target?: FeedbackTarget; targetBox?: Box }
export interface RegionInput extends PinInput { w: number; h: number }
export type FeedbackPoint = [number, number];
export interface DrawingInput {
  points?: FeedbackPoint[];
  strokes?: FeedbackPoint[][];
  path?: string;
  color?: string;
  comment?: string;
}
export type FeedbackPatch = Partial<Omit<FeedbackItem, 'id' | 'n' | 'kind' | 'createdAt'>> & { targetBox?: Box };
type Immutable<T> = T extends object ? { readonly [K in keyof T]: Immutable<T[K]> } : T;

function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && same(left[key], right[key]));
}
function freeze<T>(value: T): Immutable<T> {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value as Immutable<T>;
}
function finite(value: number): number { return Number.isFinite(value) ? value : 0; }
function clamp(value: number): number { return Math.max(0, Math.min(100, finite(value))); }
function round(value: number, digits = 1): number { return Number(finite(value).toFixed(digits)); }
function box(input: Box): Box {
  const x = finite(input.x), y = finite(input.y);
  const ex = clamp(x + finite(input.w)), ey = clamp(y + finite(input.h));
  const sx = clamp(x), sy = clamp(y);
  return { x: Math.min(sx, ex), y: Math.min(sy, ey), w: Math.abs(ex - sx), h: Math.abs(ey - sy) };
}
function simplify(points: FeedbackPoint[], tolerance = .12): FeedbackPoint[] {
  if (points.length < 3) return points;
  const keep = new Set([0, points.length - 1]);
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    const a = points[start], b = points[end];
    const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
    let max = tolerance * tolerance, index = -1;
    for (let i = start + 1; i < end; i++) {
      const p = points[i];
      const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
      const distance = (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
      if (distance > max) { max = distance; index = i; }
    }
    if (index >= 0) { keep.add(index); stack.push([start, index], [index, end]); }
  }
  return [...keep].sort((a, b) => a - b).map(index => points[index]);
}

function drawing(input: DrawingInput): Box & { path: string } {
  let strokes = input.strokes ?? (input.points ? [input.points] : []);
  if (input.path !== undefined) strokes = pathStrokes(input.path);
  const normalized = strokes.filter(stroke => stroke.length).map(stroke => stroke.map(([x, y]): FeedbackPoint => [round(clamp(x), 2), round(clamp(y), 2)]));
  const clean = normalized.map(stroke => simplify(stroke));
  if (!clean.length) throw new Error('A drawing requires at least one point');
  const points = normalized.flat();
  let x = 100, y = 100, ex = 0, ey = 0;
  for (const p of points) { x = Math.min(x, p[0]); y = Math.min(y, p[1]); ex = Math.max(ex, p[0]); ey = Math.max(ey, p[1]); }
  return { x, y, w: ex - x, h: ey - y, path: clean.map(stroke => stroke.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join('')).join('') };
}

// Flatten SVG paths into percent-space strokes before simplifying.
function pathStrokes(path: string): FeedbackPoint[][] {
  const tokens = path.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  if (path.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[MmLlHhVvCcSsQqTtAaZz]|[\s,]/g, '')) throw new Error('Invalid drawing path');
  const strokes: FeedbackPoint[][] = [];
  let i = 0, command = '', x = 0, y = 0, sx = 0, sy = 0, control: FeedbackPoint = [0, 0], previous = '';
  const append = (px: number, py: number) => { strokes[strokes.length - 1].push([px, py]); };
  while (i < tokens.length) {
    if (/^[a-z]$/i.test(tokens[i])) command = tokens[i++];
    const kind = command.toUpperCase(), relative = command !== kind;
    if (kind === 'Z') { if (!strokes.length) throw new Error('Invalid drawing path'); append(sx, sy); x = sx; y = sy; command = ''; previous = kind; continue; }
    const count = ({ M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 } as Record<string, number>)[kind];
    if (!count || i + count > tokens.length || tokens.slice(i, i + count).some(t => /^[a-z]$/i.test(t))) throw new Error('Invalid drawing path');
    const a = tokens.slice(i, i += count).map(Number);
    if (a.some(n => !Number.isFinite(n))) throw new Error('Invalid drawing path');
    const px = (n: number) => n + (relative ? x : 0), py = (n: number) => n + (relative ? y : 0);
    let nx = kind === 'H' ? px(a[0]) : kind === 'V' ? x : px(a[count - 2]);
    let ny = kind === 'V' ? py(a[0]) : kind === 'H' ? y : py(a[count - 1]);
    if (kind === 'M') { strokes.push([[nx, ny]]); sx = nx; sy = ny; command = relative ? 'l' : 'L'; }
    else {
      if (!strokes.length) throw new Error('Drawing path must start with M');
      if (kind === 'C' || kind === 'S' || kind === 'Q' || kind === 'T') {
        const cubic = kind === 'C' || kind === 'S';
        const reflected: FeedbackPoint = (cubic ? ['C', 'S'] : ['Q', 'T']).includes(previous) ? [2 * x - control[0], 2 * y - control[1]] : [x, y];
        const c1: FeedbackPoint = kind === 'S' || kind === 'T' ? reflected : [px(a[0]), py(a[1])];
        const c2: FeedbackPoint = kind === 'C' ? [px(a[2]), py(a[3])] : kind === 'S' ? [px(a[0]), py(a[1])] : c1;
        for (let step = 1; step <= 32; step++) {
          const t = step / 32, u = 1 - t;
          append(cubic ? u ** 3 * x + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * nx : u * u * x + 2 * u * t * c1[0] + t * t * nx,
            cubic ? u ** 3 * y + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * ny : u * u * y + 2 * u * t * c1[1] + t * t * ny);
        }
        control = cubic ? c2 : c1;
      } else if (kind === 'A') {
        let rx = Math.abs(a[0]), ry = Math.abs(a[1]);
        if (!rx || !ry || (nx === x && ny === y)) append(nx, ny);
        else {
          const angle = a[2] * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
          const dx = (x - nx) / 2, dy = (y - ny) / 2, xx = cos * dx + sin * dy, yy = -sin * dx + cos * dy;
          const scale = Math.sqrt(Math.max(1, xx * xx / (rx * rx) + yy * yy / (ry * ry))); rx *= scale; ry *= scale;
          const factor = (a[3] === a[4] ? -1 : 1) * Math.sqrt(Math.max(0, (rx * rx * ry * ry - rx * rx * yy * yy - ry * ry * xx * xx) / (rx * rx * yy * yy + ry * ry * xx * xx)));
          const cx1 = factor * rx * yy / ry, cy1 = -factor * ry * xx / rx;
          const cx = cos * cx1 - sin * cy1 + (x + nx) / 2, cy = sin * cx1 + cos * cy1 + (y + ny) / 2;
          const start = Math.atan2((yy - cy1) / ry, (xx - cx1) / rx);
          let delta = Math.atan2((-yy - cy1) / ry, (-xx - cx1) / rx) - start;
          if (a[4] && delta < 0) delta += Math.PI * 2;
          if (!a[4] && delta > 0) delta -= Math.PI * 2;
          for (let step = 1; step <= 64; step++) { const t = start + delta * step / 64; append(cx + cos * rx * Math.cos(t) - sin * ry * Math.sin(t), cy + sin * rx * Math.cos(t) + cos * ry * Math.sin(t)); }
        }
      } else append(nx, ny);
    }
    x = nx; y = ny; previous = kind;
  }
  return strokes;
}

export function createFeedback(init: FeedbackInit = {}) {
  const now = init.now ?? Date.now;
  let serial = 0;
  const makeId = init.id ?? (() => `feedback-${now().toString(36)}-${++serial}`);
  let state = freeze<FeedbackState>(copy({ ...context(init), overall: init.overall ?? '', items: (init.items ?? []).map((item, index) => ({ ...item, n: index + 1 })) }));
  const listeners = new Set<() => void>();
  const past: FeedbackState[] = [], future: FeedbackState[] = [];
  const boxes: Record<string, Box | null> = Object.create(null);
  let lastOperation = '', lastTime = -Infinity;
  const renumber = (draft: FeedbackState) => { draft.items.forEach((item, index) => { item.n = index + 1; }); };
  const publish = (draft: FeedbackState) => {
    renumber(draft);
    if (same(state, draft)) return false;
    state = freeze(draft);
    for (const listener of [...listeners]) listener();
    return true;
  };
  const applyBoxes = (draft: FeedbackState) => {
    for (const item of draft.items) {
      const a = item.anchor, b = a && boxes[a.key];
      if (!a || !b || b.w <= 0 || b.h <= 0) continue;
      const moved = box({ x: b.x + a.fx * b.w, y: b.y + a.fy * b.h, w: (a.fw ?? 0) * b.w, h: (a.fh ?? 0) * b.h });
      if (item.kind === 'drawing' && item.path) {
        const strokes = pathStrokes(item.path).map(stroke => stroke.map(([x, y]): FeedbackPoint => [moved.x + (x - item.x) * (item.w ? moved.w / item.w : 1), moved.y + (y - item.y) * (item.h ? moved.h / item.h : 1)]));
        Object.assign(item, drawing({ strokes }));
      } else {
        item.x = moved.x; item.y = moved.y;
        if (item.kind === 'region') { item.w = moved.w; item.h = moved.h; }
      }
    }
    return draft;
  };
  const operation = (change: (draft: FeedbackState) => void, name = '') => {
    const draft: FeedbackState = copy(state) as FeedbackState;
    change(draft); renumber(draft);
    if (same(state, draft)) return;
    const time = now();
    if (!(name === 'overall' && lastOperation === name && time >= lastTime && time - lastTime <= 750)) past.push(copy(state) as FeedbackState);
    future.length = 0; lastOperation = name; lastTime = time;
    publish(draft);
  };
  const anchor = (item: FeedbackItem, b?: Box) => {
    if (!item.target || !b || b.w <= 0 || b.h <= 0) return;
    item.anchor = { key: item.id, selector: item.target.selector, fx: (item.x - b.x) / b.w, fy: (item.y - b.y) / b.h,
      ...(item.kind !== 'pin' ? { fw: (item.w ?? 0) / b.w, fh: (item.h ?? 0) / b.h } : {}) };
    boxes[item.id] = copy(b);
  };
  const add = (kind: FeedbackKind, data: Omit<FeedbackItem, 'id' | 'n' | 'kind' | 'createdAt'>, targetBox?: Box) => {
    let id = makeId();
    while (!init.id && state.items.some(item => item.id === id)) id = makeId();
    if (state.items.some(item => item.id === id)) throw new Error('Feedback ids must be unique');
    const item: FeedbackItem = { ...copy(data), id, n: state.items.length + 1, kind, createdAt: now() };
    anchor(item, targetBox);
    operation(draft => { draft.items.push(item); });
    return state.items.find(item => item.id === id)!;
  };
  return {
    getState: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    checkpoint() {
      const draft = copy(state) as FeedbackState, history = copy(past), redo = copy(future), operationName = lastOperation, operationTime = lastTime;
      let restored = false;
      return () => {
        if (restored) return;
        restored = true;
        past.splice(0, past.length, ...history); future.splice(0, future.length, ...redo);
        lastOperation = operationName; lastTime = operationTime;
        publish(applyBoxes(draft));
      };
    },
    addPin(input: PinInput) { return add('pin', { x: clamp(input.x), y: clamp(input.y), comment: input.comment ?? '', ...(input.target ? { target: input.target } : {}) }, input.targetBox); },
    addRegion(input: RegionInput) { return add('region', { ...box(input), comment: input.comment ?? '', ...(input.target ? { target: input.target } : {}) }, input.targetBox); },
    addDrawing(input: DrawingInput) { return add('drawing', { ...drawing(input), comment: input.comment ?? '', ...(input.color === undefined ? {} : { color: input.color }) }); },
    edit(id: string, patch: FeedbackPatch) {
      operation(draft => {
        const item = draft.items.find(item => item.id === id);
        if (!item) return;
        const { targetBox, ...fields } = patch;
        const original = copy(item);
        for (const [key, value] of Object.entries(fields)) {
          const record = item as unknown as Record<string, unknown>;
          if (value === undefined && (['x', 'y', 'comment'].includes(key) || (key === 'path' && item.kind === 'drawing'))) continue;
          if (value === undefined) delete record[key]; else record[key] = copy(value);
        }
        if (item.kind === 'drawing' && patch.path !== undefined) Object.assign(item, drawing({ path: patch.path }));
        else if (item.kind === 'drawing' && original.path && ['x', 'y', 'w', 'h'].some(key => key in patch)) {
          const strokes = pathStrokes(original.path).map(stroke => stroke.map(([x, y]): FeedbackPoint => [item.x + (x - original.x) * (original.w ? (item.w ?? original.w) / original.w : 1), item.y + (y - original.y) * (original.h ? (item.h ?? original.h) / original.h : 1)]));
          Object.assign(item, drawing({ strokes }));
        } else if (item.kind === 'region') Object.assign(item, box({ x: item.x, y: item.y, w: item.w ?? 0, h: item.h ?? 0 }));
        else { item.x = clamp(item.x); item.y = clamp(item.y); }
        if ('target' in patch && !targetBox && (original.target?.selector !== item.target?.selector || original.target?.text !== item.target?.text)) delete item.anchor;
        if (targetBox) anchor(item, targetBox);
        else if (item.anchor && ['x', 'y', 'w', 'h'].some(key => key in patch)) anchor(item, boxes[item.anchor.key] ?? undefined);
      });
    },
    remove(id: string) { operation(draft => { draft.items = draft.items.filter(item => item.id !== id); }); },
    setOverall(text: string) { operation(draft => { draft.overall = text; }, 'overall'); },
    setContext(value: FeedbackContext) { operation(draft => { for (const key of ['mockup', 'variant', 'device'] as const) if (key in value) { if (value[key] === undefined) delete draft[key]; else draft[key] = value[key]; } }); },
    clear() { operation(draft => { draft.items = []; draft.overall = ''; }); },
    undo() {
      if (!past.length) return;
      future.push(copy(state) as FeedbackState); lastOperation = '';
      publish(applyBoxes(past.pop()!));
    },
    redo() {
      if (!future.length) return;
      past.push(copy(state) as FeedbackState); lastOperation = '';
      publish(applyBoxes(future.pop()!));
    },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    reanchor(value: Record<string, Box | null>) {
      for (const [key, b] of Object.entries(value)) if (b && b.w > 0 && b.h > 0) boxes[key] = copy(b);
      publish(applyBoxes(copy(state) as FeedbackState));
    },
    anchorRequests(): Anchor[] { return state.items.filter(item => item.anchor).map(item => ({ key: item.anchor!.key, selector: item.anchor!.selector, ...(item.target?.text ? { text: item.target.text } : {}) })); },
    markResolved(ids: readonly string[] | 'all') { operation(draft => { for (const item of draft.items) if (ids === 'all' || ids.includes(item.id)) item.resolved = true; }); },
    get canSubmit() { return !!state.overall.trim() || state.items.some(item => item.kind === 'drawing' || !!item.comment.trim()); },
    toPayload(): FeedbackPayload {
      return { ...context(state), overall: state.overall, items: state.items.filter(item => item.kind === 'drawing' || item.comment.trim()).map(item => ({
        n: item.n, kind: item.kind, x: round(item.x), y: round(item.y),
        ...(item.w === undefined ? {} : { w: round(item.w) }), ...(item.h === undefined ? {} : { h: round(item.h) }),
        ...(item.path === undefined ? {} : { path: item.path }), comment: item.comment,
        ...(item.target ? { target: { selector: item.target.selector, ...(item.target.text === undefined ? {} : { text: item.target.text }), ...(item.target.html === undefined ? {} : { html: item.target.html.replace(/\s+/g, ' ').trim().slice(0, 300) }) } } : {})
      })) };
    },
    toJSON(): FeedbackState { return copy(state) as FeedbackState; }
  };
}

export type FeedbackModel = ReturnType<typeof createFeedback>;

function context(input: FeedbackContext): FeedbackContext {
  return { ...(input.mockup === undefined ? {} : { mockup: input.mockup }), ...(input.variant === undefined ? {} : { variant: input.variant }), ...(input.device === undefined ? {} : { device: input.device }) };
}

export function previousAsResolved(payload: FeedbackPayload): FeedbackItem[] {
  return payload.items.map(item => ({ ...copy(item), id: `previous-${item.n}`, createdAt: 0, resolved: true }));
}

export function toMessage(payload: FeedbackPayload, opts: { maxItems?: number } = {}): string {
  const short = (text: string, max = 180) => text.replace(/\s+/g, ' ').trim().slice(0, max);
  const details = [payload.variant ? `variant ${short(payload.variant, 60)}` : '', payload.device ? short(payload.device, 60) : ''].filter(Boolean);
  const lines = [`Feedback on mockup${payload.mockup ? ` "${short(payload.mockup, 80)}"` : ''}${details.length ? ` (${details.join(', ')})` : ''}:`];
  if (payload.overall.trim()) lines.push(`Overall: ${short(payload.overall, 500)}`);
  const limit = Math.max(0, Math.floor(opts.maxItems ?? payload.items.length));
  for (const item of payload.items.slice(0, limit)) {
    const x = round(item.x), y = round(item.y), ex = round(item.x + (item.w ?? 0)), ey = round(item.y + (item.h ?? 0));
    const area = `${x}–${ex}% x, ${y}–${ey}% y`;
    const location = `${y < 33 ? 'top' : y > 66 ? 'bottom' : ''}${x < 33 ? '-left' : x > 66 ? '-right' : ''}`.replace(/^-/, '') || 'centre';
    const target = item.target ? item.target.text ? ` on "${short(item.target.text, 80)}" (${short(item.target.selector, 100)})` : ` on ${short(item.target.selector, 100)}` : ` (${location})`;
    const geometry = item.kind === 'pin' ? `Pin at ${x}%,${y}%` : item.kind === 'region' ? `Region ${area}` : `Drawing (area ${area})`;
    lines.push(`${item.n}. ${geometry}${target}${item.comment.trim() ? `: ${short(item.comment)}` : ''}`);
  }
  if (payload.items.length > limit) lines.push(`… ${payload.items.length - limit} more item(s)`);
  return lines.join('\n');
}
