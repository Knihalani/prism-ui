import type { Plugin, Value } from '@prism-ui/core';

export function parseMockupMeta(meta = ''): Record<string, Value> {
  const attrs: Record<string, Value> = {};
  const text = meta.trim().replace(/^\{/, '').replace(/\}$/, '');
  const pattern = /([\w-]+)(?:\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s}]+)))?/g;
  for (const match of text.matchAll(pattern)) {
    const key = match[1];
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    const value = match[2] ?? match[3] ?? match[4];
    attrs[key] = value === undefined ? true : value.replace(/\\([\\"'])/g, '$1');
  }
  return attrs;
}
export const mockupPlugin: Plugin = {
  name: 'mockup',
  transform(node) {
    if (node.type !== 'code' || !/^mockup:(html|svg|wire|image)$/.test(node.lang ?? '')) return node;
    return { type: 'component', key: node.key, name: 'mockup', props: { ...parseMockupMeta(node.meta), kind: node.lang!.slice(7), source: node.value ?? '' }, children: [], complete: node.complete };
  },
};
