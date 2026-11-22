export type Issue = { path: string; message: string };
export type Result<T> = { value: T; issues: Issue[]; partial: boolean };
export type Infer<S> = S extends Schema<infer T> ? T : never;
type Shape = Record<string, Schema<any>>;
type Values<S extends Shape> = { [K in keyof S]: Infer<S[K]> };
type Options = { min?: number; max?: number; step?: number };
const safe = (k: string) => !['__proto__', 'constructor', 'prototype'].includes(k);
function clean(v: any, seen = new Set<object>()): any {
  if (!v || typeof v !== 'object') return v;
  if (seen.has(v)) throw Error();
  seen.add(v); const out: any = Array.isArray(v) ? [] : {};
  for (const k of Object.keys(v)) if (safe(k)) out[k] = clean(v[k], seen);
  seen.delete(v); return out;
}
export class Schema<T> {
  readonly description: string = '';
  readonly examples: readonly T[] = [];
  readonly isOptional: boolean = false;
  readonly defaultValue: T | undefined = undefined;
  private readonly hasDefault: boolean = false;
  constructor(readonly type: string, private readonly kind: string, readonly shape?: Shape, private readonly config: any = undefined) {}
  private clone<U>(data: object): Schema<U> { return Object.assign(Object.create(Object.getPrototypeOf(this)), this, data); }
  optional(): Schema<T | undefined> { return this.clone({ isOptional: true }); }
  default(value: Exclude<T, undefined>): Schema<Exclude<T, undefined>> { return this.clone({ defaultValue: value, hasDefault: true }); }
  describe(description: string): Schema<T> { return this.clone({ description }); }
  example(value: T): Schema<T> { return this.clone({ examples: [...this.examples, value] }); }
  coerce(raw: unknown): Result<T> {
    try { return this.parse(clean(raw), ''); }
    catch { return { value: (this.hasDefault ? this.defaultValue : undefined) as T, issues: [{ path: '', message: 'invalid' }], partial: true }; }
  }
  private parse(raw: any, path: string): Result<T> {
    const result = (value: any, issues: Issue[] = [], partial = false): Result<T> => ({ value, issues, partial });
    const invalid = (message = 'invalid') => result(this.hasDefault ? clean(this.defaultValue) : undefined, [{ path, message }], !this.hasDefault);
    if (raw === undefined) return this.hasDefault ? result(clean(this.defaultValue)) : this.isOptional ? result(undefined) : invalid('missing');
    if ((this.kind === 'array' || this.kind === 'object') && typeof raw === 'string') {
      try { raw = JSON.parse(raw); raw = clean(raw); } catch { return invalid(); }
    }
    switch (this.kind) {
      case 'any': return result(raw);
      case 'string': return typeof raw === 'string' || typeof raw === 'number' ? result(String(raw)) : invalid();
      case 'boolean': return typeof raw === 'boolean' ? result(raw) : raw === 'true' || raw === '' ? result(true) : raw === 'false' ? result(false) : invalid();
      case 'number': {
        const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
        if (!Number.isFinite(n)) return invalid();
        const { min = -Infinity, max = Infinity, step } = this.config;
        const value = Math.max(min, Math.min(max, step && step > 0 ? Math.round(n / step) * step : n));
        return result(value, value !== n ? [{ path, message: 'clamped' }] : []);
      }
      case 'enum': return this.config.includes(raw) ? result(raw) : invalid();
      case 'union': {
        const results: Result<T>[] = this.config.map((schema: Schema<T>) => schema.parse(raw, path));
        const best = results.find(r => !r.issues.length) ?? results.sort((a, b) => a.issues.length - b.issues.length)[0];
        return best ? best.value === undefined && this.hasDefault ? { ...best, value: clean(this.defaultValue), partial: false } : best : invalid();
      }
      case 'array': case 'object': {
        const array = this.kind === 'array';
        if (array ? !Array.isArray(raw) : !raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid();
        const value: any = array ? [] : {}, issues: Issue[] = []; let partial = false;
        for (const k of Object.keys(array ? raw : this.shape!)) {
          if (!safe(k)) continue;
          const schema: Schema<any> = array ? this.config : this.shape![k];
          const r = schema.parse(Object.hasOwn(raw, k) ? raw[k] : undefined, path ? path + '.' + k : k);
          issues.push(...r.issues); partial ||= r.partial;
          if (r.value !== undefined) { if (array) value.push(r.value); else value[k] = r.value; }
        }
        return result(value, issues, partial);
      }
    }
    return invalid();
  }
}
export const s = {
  string: () => new Schema<string>('string', 'string'),
  number: (options: Options = {}) => new Schema<number>('number' + (Object.keys(options).length ? ' (' + [options.min !== undefined || options.max !== undefined ? `${options.min ?? '-∞'}–${options.max ?? '∞'}` : '', options.step !== undefined ? `step ${options.step}` : ''].filter(Boolean).join(', ') + ')' : ''), 'number', undefined, { ...options }),
  boolean: () => new Schema<boolean>('boolean', 'boolean'),
  any: () => new Schema<any>('any', 'any'),
  enum: <const T extends readonly string[]>(values: T) => new Schema<T[number]>(values.map(v => JSON.stringify(v)).join(' | '), 'enum', undefined, [...values]),
  array: <T>(item: Schema<T>) => new Schema<T[]>(item.type + '[]', 'array', undefined, item),
  object: <S extends Shape>(shape: S) => new Schema<Values<S>>('{ ' + Object.keys(shape).filter(safe).map(k => k + ': ' + shape[k].type).join(', ') + ' }', 'object', { ...shape }),
  union: <S extends readonly Schema<any>[]>(...schemas: S) => new Schema<Infer<S[number]>>(schemas.map(s => s.type).join(' | '), 'union', undefined, [...schemas]),
};

export type Definition = { name: string; schema: Schema<any>; docs?: string; examples?: string[]; inline?: boolean; syntax?: 'fence' | 'container' | 'leaf' | 'inline' };
function sample(schema: Schema<any>): any {
  if (schema.examples.length) return schema.examples[0];
  if (schema.defaultValue !== undefined) return schema.defaultValue;
  if (schema.shape) return Object.fromEntries(Object.entries(schema.shape).filter(([k]) => safe(k)).map(([k, v]) => [k, sample(v)]));
  const type = schema.type;
  if (type.endsWith('[]')) return [];
  if (type.startsWith('number')) return 0;
  if (type === 'boolean') return true;
  if (type.startsWith('"')) { try { return JSON.parse(type.split(' | ')[0]); } catch {} }
  return '';
}
export function toPromptDocs(defs: readonly Definition[]): string {
  return defs.map(def => {
    const syntax = def.syntax ?? (def.inline ? 'inline' : 'fence');
    const render = (json: string) => syntax === 'fence' ? '```ui:' + def.name + ' ' + json + '\n```' : syntax === 'container' ? ':::' + def.name + json + '\n…\n:::' : (syntax === 'leaf' ? '::' : ':') + def.name + (syntax === 'inline' ? '[label]' : '') + json;
    const props = Object.entries(def.schema.shape ?? {}).filter(([k]) => safe(k)).map(([k, v]) => '- `' + k + '` (' + [v.type, v.defaultValue !== undefined ? 'default `' + JSON.stringify(v.defaultValue) + '`' : '', v.isOptional ? 'optional' : ''].filter(Boolean).join(', ') + ')' + (v.description ? ' — ' + v.description : ''));
    const value = sample(def.schema);
    const example = syntax === 'fence' ? JSON.stringify(value) : '{' + Object.entries(value ?? {}).map(([k, v]) => k + '=' + JSON.stringify(v)).join(' ') + '}';
    return ['### ' + def.name, def.docs, render(syntax === 'fence' ? '{json}' : '{attrs}'), ...props, 'Example:\n' + (def.examples?.[0] ?? render(example))].filter(Boolean).join('\n');
  }).join('\n\n');
}
