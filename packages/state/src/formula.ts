export type Scope = Record<string, unknown> | ((path: string) => unknown);
export type Formula = ((scope: Scope) => number) & { deps: string[] };
export class FormulaError extends Error {}
type Node = (scope: Scope) => any;
const cache = new Map<string, Formula>();
const number = (v: any): number => typeof v === 'number' ? v : typeof v === 'string' && v.trim() && !Number.isNaN(+v) ? +v : 0;
const functions: Record<string, (...args: any[]) => number> = {
  min: (...a) => Math.min(...a.flat(Infinity).map(number)), max: (...a) => Math.max(...a.flat(Infinity).map(number)),
  sum: (...a) => a.flat(Infinity).reduce((s, v) => s + number(v), 0),
  avg: (...a) => { const v = a.flat(Infinity); return v.reduce((s, n) => s + number(n), 0) / v.length; },
  round: (x, d = 0) => Math.round(number(x) * 10 ** number(d)) / 10 ** number(d),
  floor: x => Math.floor(number(x)), ceil: x => Math.ceil(number(x)), abs: x => Math.abs(number(x)),
  if: (c, a, b) => number(c) ? number(a) : number(b), pct: (x, p) => number(x) * number(p) / 100,
};
const precedence: Record<string, number> = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '^': 8 };
function binary(op: string, a: number, b: number): number {
  switch (op) {
    case '+': return a + b; case '-': return a - b; case '*': return a * b;
    case '/': return a / b; case '%': return a % b; case '^': return a ** b;
    case '<': return +(a < b); case '>': return +(a > b); case '<=': return +(a <= b); case '>=': return +(a >= b);
    case '==': return +(a === b); case '!=': return +(a !== b);
    case '&&': return +(!!a && !!b); default: return +(!!a || !!b);
  }
}
export function compile(expr: string): Formula {
  const hit = cache.get(expr); if (hit) return hit;
  const fail = (): never => { throw new FormulaError('Invalid formula'); };
  if (expr.length > 4096) fail();
  const tokens: string[] = []; let pos = 0;
  while (pos < expr.length) {
    if (/\s/.test(expr[pos])) { pos++; continue; }
    const token = /^(?:\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?|[a-zA-Z_$][\w$]*(?:\.(?:[\w$]+))*|&&|\|\||<=|>=|==|!=|[+\-*/%^!<>()?:,])/.exec(expr.slice(pos));
    if (!token) fail(); tokens.push(token![0]); pos += token![0].length;
  }
  let i = 0; const deps = new Set<string>();
  const take = (s: string) => tokens[i] === s ? (++i, true) : false;
  const expect = (s: string) => { if (!take(s)) fail(); };
  function parse(min = 0, depth = 0): Node {
    if (depth > 64) fail();
    const t = tokens[i++]; let left: Node;
    if (t === '-' || t === '!') { const n = parse(7, depth + 1); left = s => t === '-' ? -number(n(s)) : +!number(n(s)); }
    else if (t === '(') { left = parse(0, depth + 1); expect(')'); }
    else if (t && /^(?:\d|\.)/.test(t)) left = () => +t;
    else if (t && /^[a-zA-Z_$]/.test(t)) {
      if (take('(')) {
        if (!Object.hasOwn(functions, t)) fail();
        const args: Node[] = [];
        if (!take(')')) { do { args.push(parse(0, depth + 1)); } while (take(',')); expect(')'); }
        left = s => functions[t](...args.map(a => a(s)));
      } else {
        if (t === 'this') fail(); deps.add(t);
        const keys = t.split('.');
        left = s => keys.some(k => ['__proto__', 'constructor', 'prototype'].includes(k)) ? 0 : typeof s === 'function' ? s(t) : keys.reduce<any>((v, k) => v != null && Object.hasOwn(v, k) ? v[k] : undefined, s);
      }
    } else return fail();
    while (precedence[tokens[i]] >= min) {
      const op = tokens[i++], p = precedence[op], a = left, b = parse(p + (op === '^' ? 0 : 1), depth + 1);
      left = s => binary(op, number(a(s)), number(b(s)));
    }
    if (min === 0 && take('?')) { const a = left, yes = parse(0, depth + 1); expect(':'); const no = parse(0, depth + 1); left = s => number(a(s)) ? yes(s) : no(s); }
    return left;
  }
  const node = parse(); if (i !== tokens.length) fail();
  const fn = Object.assign((scope: Scope) => number(node(scope)), { deps: [...deps] });
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  cache.set(expr, fn); return fn;
}
export function evaluate(expr: string, scope: Scope): number { try { return compile(expr)(scope); } catch { return NaN; } }
