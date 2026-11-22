export type Point = readonly [number, number | null] | { x: number; y: number | null };
export type MaybePoint = Point | null | undefined;
export interface PathOptions { curve?: 'linear' | 'monotone' | 'step'; precision?: number; defined?: (point: MaybePoint, index: number) => boolean }
export function pointX(point: Point): number { return 'x' in point ? point.x : point[0]; }
export function pointY(point: Point): number | null { return 'y' in point ? point.y : point[1]; }
export function defined(point: MaybePoint): point is Point { return point != null && Number.isFinite(pointX(point)) && pointY(point) != null && Number.isFinite(pointY(point)); }
export function formatCoord(value: number, precision = 2): string { return Number.isFinite(value) ? String(Number(value.toFixed(Math.max(0, Math.min(12, Math.floor(precision)))))) : '0'; }

class PathBuffer {
  data = new Uint8Array(4096);
  view = new DataView(this.data.buffer);
  words = new Uint32Array(10000);
  sizes = new Uint8Array(10000);
  pairs = new Uint16Array(100);
  length = 0;
  top = new Float64Array(0);
  bottom = new Float64Array(0);
  tangents = new Float64Array(0);
  precision = 2;
  factor = 100;
  decoder = new TextDecoder();
  constructor() {
    for (let i = 0; i < this.words.length; i++) {
      const text = String(i);
      this.sizes[i] = text.length;
      for (let j = 0; j < text.length; j++) this.words[i] |= text.charCodeAt(j) << (j * 8);
    }
    for (let i = 0; i < this.pairs.length; i++) this.pairs[i] = (48 + Math.floor(i / 10)) | ((48 + i % 10) << 8);
  }
  reset(precision = 2) {
    this.length = 0;
    this.precision = Math.max(0, Math.min(12, Math.floor(precision))) || 0;
    this.factor = 10 ** this.precision;
  }
  reserve(extra: number) {
    if (this.length + extra <= this.data.length) return;
    const grown = new Uint8Array(Math.max(this.data.length * 2, this.length + extra));
    grown.set(this.data.subarray(0, this.length)); this.data = grown; this.view = new DataView(grown.buffer);
  }
  number(value: number) {
    if (this.precision === 2) {
      const scaled = Math.abs(value) * 100, rounded = Math.round(scaled);
      if (rounded < 1e6 && Math.abs(Math.abs(scaled - rounded) - 0.5) > scaled * Number.EPSILON) {
        if (!rounded) { this.data[this.length++] = 48; return; }
        const data = this.data;
        let length = this.length;
        if (value < 0) data[length++] = 45;
        const whole = Math.floor(rounded / 100), fraction = rounded - whole * 100;
        this.view.setUint32(length, this.words[whole], true); length += this.sizes[whole];
        if (fraction) {
          data[length++] = 46;
          this.view.setUint16(length, this.pairs[fraction], true); length += fraction % 10 ? 2 : 1;
        }
        this.length = length;
        return;
      }
    }
    if (!Number.isFinite(value)) { this.data[this.length++] = 48; return; }
    const scaled = Math.abs(value) * this.factor;
    let integer = Math.round(scaled);
    if (scaled > 1e15 || integer && integer / this.factor < 1e-6 || Math.abs(scaled - Math.floor(scaled) - 0.5) <= scaled * Number.EPSILON) {
      const text = formatCoord(value, this.precision);
      for (let i = 0; i < text.length; i++) this.data[this.length++] = text.charCodeAt(i);
      return;
    }
    if (!integer) { this.data[this.length++] = 48; return; }
    if (value < 0) this.data[this.length++] = 45;
    let decimals = this.precision;
    while (decimals && integer % 10 === 0) { integer /= 10; decimals--; }
    const start = this.length;
    do {
      const quotient = Math.floor(integer / 10);
      this.data[this.length++] = 48 + integer - quotient * 10;
      integer = quotient;
      if (--decimals === 0) this.data[this.length++] = 46;
    } while (integer || decimals > 0);
    if (this.data[this.length - 1] === 46) this.data[this.length++] = 48;
    for (let lo = start, hi = this.length - 1; lo < hi; lo++, hi--) { const byte = this.data[lo]; this.data[lo] = this.data[hi]; this.data[hi] = byte; }
  }
  point(command: number, x: number, y: number) {
    this.reserve(64);
    this.data[this.length++] = command;
    this.number(x); this.data[this.length++] = 44; this.number(y);
  }
  cubic(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    this.reserve(192);
    this.data[this.length++] = 67;
    this.number(x1); this.data[this.length++] = 44; this.number(y1); this.data[this.length++] = 44;
    this.number(x2); this.data[this.length++] = 44; this.number(y2); this.data[this.length++] = 44;
    this.number(x); this.data[this.length++] = 44; this.number(y);
  }
  step(mid: number, x: number, y: number) {
    this.reserve(96);
    this.data[this.length++] = 72; this.number(mid);
    this.data[this.length++] = 86; this.number(y);
    this.data[this.length++] = 72; this.number(x);
  }
  finish() { return this.decoder.decode(this.data.subarray(0, this.length)); }
}
const buffers: PathBuffer[] = [];
function pack(points: readonly MaybePoint[], data: Float64Array): void {
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    let x: number, y: number | null;
    if (point == null) { data[i * 2] = NaN; continue; }
    if ('x' in point) { x = point.x; y = point.y; } else { x = point[0]; y = point[1]; }
    data[i * 2] = Number.isFinite(x) && y != null && Number.isFinite(y) ? x : NaN;
    data[i * 2 + 1] = y ?? NaN;
  }
}
function segment(buffer: PathBuffer, points: Float64Array, start: number, end: number, curve: PathOptions['curve'], reverse = false, command = 77, baseline?: number): void {
  const count = (end - start) / 2;
  const stride = reverse ? -2 : 2;
  const first = reverse ? end - 2 : start;
  const constant = baseline !== undefined;
  const tangents = buffer.tangents;
  if (curve === 'monotone' && count > 1 && !constant) {
    let position = first;
    let dx = points[position + stride] - points[position];
    let slope = dx ? (points[position + stride + 1] - points[position + 1]) / dx : 0;
    tangents[0] = slope;
    for (let i = 0; i < count - 1; i++, position += stride) {
      let next = slope;
      if (i < count - 2) { dx = points[position + stride * 2] - points[position + stride]; next = dx ? (points[position + stride * 2 + 1] - points[position + stride + 1]) / dx : 0; }
      let a = tangents[i], b = i === count - 2 ? slope : slope * next <= 0 ? 0 : (slope + next) / 2;
      if (!slope) a = b = 0;
      else {
        const alpha = a / slope, beta = b / slope, squared = alpha * alpha + beta * beta;
        if (squared > 9) { const factor = 3 / Math.hypot(alpha, beta); a = factor * alpha * slope; b = factor * beta * slope; }
      }
      tangents[i] = a; tangents[i + 1] = b; slope = next;
    }
  }
  let x0 = points[first], y0 = constant ? baseline : points[first + 1];
  buffer.point(command, x0, y0);
  for (let i = 1, position = first + stride; i < count; i++, position += stride) {
    const x = points[position], y = constant ? baseline : points[position + 1];
    if (curve === 'step') buffer.step((x0 + x) / 2, x, y);
    else if (curve === 'monotone') { const dx = (x - x0) / 3; buffer.cubic(x0 + dx, y0 + (constant ? 0 : tangents[i - 1]) * dx, x - dx, y - (constant ? 0 : tangents[i]) * dx, x, y); }
    else buffer.point(76, x, y);
    x0 = x; y0 = y;
  }
}
function buildPath(top: readonly MaybePoint[], bottom: number | readonly MaybePoint[] | undefined, options: PathOptions): string {
  if (!top.length || typeof bottom === 'number' && !Number.isFinite(bottom)) return '';
  const buffer = buffers.pop() ?? new PathBuffer();
  try {
    buffer.reset(options.precision);
    const length = top.length * 2;
    if (buffer.top.length < length) buffer.top = new Float64Array(length);
    if (options.curve === 'monotone' && buffer.tangents.length < top.length) buffer.tangents = new Float64Array(top.length);
    pack(top, buffer.top);
    const paired = bottom !== undefined && typeof bottom !== 'number';
    if (paired) { if (buffer.bottom.length < length) buffer.bottom = new Float64Array(length); pack(bottom, buffer.bottom); }
    let start = 0;
    for (let i = 0; i <= top.length; i++) {
      const valid = i < top.length && !Number.isNaN(buffer.top[i * 2]) && (!paired || i < bottom.length && !Number.isNaN(buffer.bottom[i * 2])) && (!options.defined || options.defined(top[i], i));
      if (valid) continue;
      if (i > start) {
        segment(buffer, buffer.top, start * 2, i * 2, options.curve);
        if (bottom !== undefined) {
          segment(buffer, paired ? buffer.bottom : buffer.top, start * 2, i * 2, options.curve, true, 76, typeof bottom === 'number' ? bottom : undefined);
          buffer.reserve(1); buffer.data[buffer.length++] = 90;
        }
      }
      start = i + 1;
    }
    return buffer.finish();
  } finally { buffers.push(buffer); }
}
export function linePath(points: readonly MaybePoint[], options: PathOptions = {}): string { return buildPath(points, undefined, options); }
export function areaPath(top: readonly MaybePoint[], baseline: number | readonly MaybePoint[] = 0, options: PathOptions = {}): string { return buildPath(top, baseline, options); }
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
