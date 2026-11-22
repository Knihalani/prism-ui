export type Value = string | number | boolean | null | Value[] | { [key: string]: Value };
export interface Node {
  type: string;
  key: string;
  children?: Node[];
  value?: string;
  name?: string;
  props?: Record<string, Value>;
  complete?: boolean;
  depth?: number;
  ordered?: boolean;
  start?: number;
  checked?: boolean;
  lang?: string;
  meta?: string;
  url?: string;
  title?: string;
  align?: ('left' | 'right' | 'center' | null)[];
}
export interface Root extends Node { type: 'root'; children: Node[] }
export interface Update { root: Root }
export function freeze(node: Node): Node {
  if (Object.isFrozen(node)) return node;
  if (node.children) { for (let i = 0; i < node.children.length; i++) freeze(node.children[i]); Object.freeze(node.children); }
  if (node.props) deepFreeze(node.props);
  return Object.freeze(node);
}
function deepFreeze(value: unknown): void {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    if (Array.isArray(value)) { for (let i = 0; i < value.length; i++) deepFreeze(value[i]); }
    else for (const key in value) if (Object.hasOwn(value, key)) deepFreeze((value as Record<string, unknown>)[key]);
    Object.freeze(value);
  }
}
