export type Path = string | readonly (string | number)[];
const cache = new Map<string, readonly string[]>();
function validate(parts: readonly string[]): void {
  if (parts.some(part => part === '__proto__' || part === 'constructor' || part === 'prototype')) throw new Error('Unsafe path');
}
export function parsePath(path: Path): readonly string[] {
  if (typeof path !== 'string') { const parts = path.map(String); validate(parts); return Object.freeze(parts); }
  const cached = cache.get(path);
  if (cached) return cached;
  const parts: string[] = [];
  let i = 0;
  while (i < path.length) {
    if (path[i] === '.') throw new Error('Invalid path');
    if (path[i] === '[') {
      i++;
      while (/\s/.test(path[i] ?? '') && i < path.length) i++;
      const quote = path[i];
      let part = '';
      if (quote === "'" || quote === '"') {
        i++;
        while (i < path.length && path[i] !== quote) {
          if (path[i] === '\\') { i++; if (i >= path.length) throw new Error('Invalid path'); }
          part += path[i++];
        }
        if (path[i++] !== quote) throw new Error('Invalid path');
      } else {
        while (i < path.length && path[i] !== ']') part += path[i++];
        part = part.trim();
        if (!/^\d+$/.test(part)) throw new Error('Invalid path');
      }
      while (/\s/.test(path[i] ?? '') && i < path.length) i++;
      if (path[i++] !== ']') throw new Error('Invalid path');
      parts.push(part);
    } else {
      let part = '';
      while (i < path.length && path[i] !== '.' && path[i] !== '[') part += path[i++];
      if (!part || part.includes(']')) throw new Error('Invalid path');
      parts.push(part);
    }
    if (path[i] === '.') { i++; if (i === path.length || path[i] === '[') throw new Error('Invalid path'); }
    else if (i < path.length && path[i] !== '[') throw new Error('Invalid path');
  }
  validate(parts);
  const result = Object.freeze(parts);
  cache.set(path, result);
  return result;
}
function own(obj: unknown, key: string): boolean { return obj !== null && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key); }
export function get(obj: unknown, path: Path): unknown {
  let value = obj;
  for (const part of parsePath(path)) { if (!own(value, part)) return undefined; value = (value as Record<string, unknown>)[part]; }
  return value;
}
export function has(obj: unknown, path: Path): boolean {
  let value = obj;
  for (const part of parsePath(path)) { if (!own(value, part)) return false; value = (value as Record<string, unknown>)[part]; }
  return true;
}
function change(obj: unknown, parts: readonly string[], value: unknown, remove: boolean): unknown {
  if (!parts.length) return remove ? undefined : value;
  const [part, ...rest] = parts;
  if (remove && !own(obj, part)) return obj;
  const previous = own(obj, part) ? (obj as Record<string, unknown>)[part] : undefined;
  const next = rest.length ? change(previous, rest, value, remove) : value;
  if (rest.length && next === previous && remove) return obj;
  const copy = Array.isArray(obj) ? [...obj] : obj !== null && typeof obj === 'object' ? { ...obj } : /^\d+$/.test(part) ? [] : {};
  if (remove && !rest.length) {
    if (Array.isArray(copy) && /^\d+$/.test(part)) copy.splice(Number(part), 1);
    else delete (copy as Record<string, unknown>)[part];
  } else Object.defineProperty(copy, part, { value: next, enumerable: true, writable: true, configurable: true });
  return copy;
}
export function set<T = unknown>(obj: T, path: Path, value: unknown): T { return change(obj, parsePath(path), value, false) as T; }
export function del<T = unknown>(obj: T, path: Path): T { return change(obj, parsePath(path), undefined, true) as T; }
