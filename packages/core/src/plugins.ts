import type { Node } from './ast';

export type PluginNode = Omit<Node, 'key'> & { key?: string };
export interface InlineExt {
  trigger: string;
  parse(src: string, pos: number): { node: PluginNode; end: number } | null;
}
export interface BlockState { lines: string[]; data: Record<string, unknown> }
export interface BlockExt {
  test(line: string): boolean;
  continue(line: string, state: BlockState): boolean;
  finish(lines: string[]): PluginNode;
}
export interface Plugin {
  name: string;
  inline?: InlineExt[];
  block?: BlockExt[];
  transform?(node: Node): Node;
}
export interface ParserOptions { plugins?: Plugin[] }
export interface InlineExtensions {
  triggers: Map<string, InlineExt[]>;
  codes: Set<number>;
}
export function pluginNode(node: PluginNode, key: string): Node {
  return { ...node, key, ...(node.children ? { children: node.children.map((child, i) => pluginNode(child, `${key}.${i}`)) } : {}) };
}
export class Plugins {
  readonly inline?: InlineExtensions;
  readonly blocks: BlockExt[];
  private readonly transforms: ((node: Node) => Node)[];
  constructor(plugins: Plugin[]) {
    const triggers = new Map<string, InlineExt[]>();
    for (const plugin of plugins) for (const ext of plugin.inline ?? []) {
      if (ext.trigger.length !== 1) throw new Error('Inline trigger must be one character');
      const list = triggers.get(ext.trigger) ?? []; list.push(ext); triggers.set(ext.trigger, list);
    }
    if (triggers.size) this.inline = { triggers, codes: new Set([...triggers.keys()].map(c => c.charCodeAt(0))) };
    this.blocks = plugins.flatMap(p => p.block ?? []);
    this.transforms = plugins.flatMap(p => p.transform ? [p.transform] : []);
  }
  transform(node: Node): Node {
    if (!this.transforms.length || Object.isFrozen(node)) return node;
    let next = { ...node };
    if (node.children) next.children = node.children.map(child => this.transform(child));
    for (const transform of this.transforms) next = transform(next);
    return next;
  }
}
