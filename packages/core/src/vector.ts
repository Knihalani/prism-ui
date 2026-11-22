import type { Node } from './ast';

type Branch = (Branch | Node)[];
type Tail = Node | (() => Node);

/** A 32-way persistent vector exposed through the standard array read interface. */
export class BlockVector {
  private static views = new WeakMap<Node[], { vector: BlockVector; tail?: Tail; length: number; materialized: boolean }>();
  static reuse(array: Node[], vector: BlockVector, tail?: Tail): boolean {
    const view = this.views.get(array);
    if (!view || view.materialized || view.length !== vector.length + (tail ? 1 : 0)) return false;
    view.vector = vector; view.tail = tail; return true;
  }
  constructor(readonly length = 0, private tree: Branch = [], private depth = 0) {}
  at(index: number): Node {
    let branch = this.tree;
    for (let level = this.depth; level > 0; level--) branch = branch[(index >>> (level * 5)) & 31] as Branch;
    return branch[index & 31] as Node;
  }
  take(length: number) { return new BlockVector(length, this.tree, this.depth); }
  set(index: number, value: Node): BlockVector {
    if (index < this.length && this.at(index) === value) return this;
    let tree = this.tree; let depth = this.depth;
    if (index >= 32 ** (depth + 1)) { tree = [tree]; depth++; }
    const update = (branch: Branch, level: number): Branch => {
      const copy = branch.slice(); const slot = (index >>> (level * 5)) & 31;
      copy[slot] = level ? update((branch[slot] as Branch | undefined) ?? [], level - 1) : value;
      return copy;
    };
    return new BlockVector(Math.max(this.length, index + 1), update(tree, depth), depth);
  }
  view(tail?: Tail): Node[] {
    const view = { vector: this as BlockVector, tail, length: this.length + (tail ? 1 : 0), materialized: false }; const target: Node[] = [];
    const at = (i: number) => i === view.vector.length && view.tail ? typeof view.tail === 'function' ? view.tail() : view.tail : view.vector.at(i);
    const index = (key: PropertyKey) => typeof key === 'string' && key !== '' && String(Number(key)) === key && Number.isInteger(Number(key)) && Number(key) >= 0 ? Number(key) : -1;
    const proxy = new Proxy(target, {
      get(array, key, receiver) {
        if (view.materialized) return Reflect.get(array, key, receiver);
        if (key === 'length') return view.length;
        const i = index(key); return i >= 0 ? i < view.length ? at(i) : undefined : Reflect.get(array, key, receiver);
      },
      has(array, key) { const i = index(key); return i >= 0 ? i < view.length : Reflect.has(array, key); },
      ownKeys(array) { if (view.materialized) return Reflect.ownKeys(array); const keys = Array.from({ length: view.length }, (_, i) => String(i)); keys.push('length'); return keys; },
      getOwnPropertyDescriptor(array, key) {
        if (view.materialized) return Reflect.getOwnPropertyDescriptor(array, key);
        if (key === 'length') return { configurable: false, enumerable: false, writable: true, value: view.length };
        const i = index(key); return i >= 0 && i < view.length ? { configurable: true, enumerable: true, writable: true, value: at(i) } : Reflect.getOwnPropertyDescriptor(array, key);
      },
      preventExtensions(array) {
        for (let i = 0; i < view.length; i++) array[i] = at(i);
        view.materialized = true; return Reflect.preventExtensions(array);
      },
      set() { throw new TypeError('Parser children are read-only'); },
    });
    BlockVector.views.set(proxy, view);
    return proxy;
  }
}
