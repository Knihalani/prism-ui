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
  if (node.children) { node.children.forEach(freeze); Object.freeze(node.children); }
  if (node.props) deepFreeze(node.props);
  return Object.freeze(node);
}
function deepFreeze(value: unknown): void {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
}
