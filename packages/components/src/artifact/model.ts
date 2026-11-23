import type { Plugin, Value } from '@prism-ui/core';
import { s, type Infer } from '@prism-ui/schema';
import type { Store } from '@prism-ui/state';

const kinds = ['html', 'react', 'svg', 'js', 'markdown'] as const;
export const artifactSchema = s.object({
  id: s.string().optional().describe('Reuse this identifier in a later reply to publish a new version.'),
  title: s.string().optional().describe('Short title for the preview.'),
  height: s.union(s.enum(['auto']), s.number({ min: 80, max: 4096 })).default('auto').describe('Auto-size to content, or reserve a fixed height in pixels.'),
  variant: s.enum(['inline', 'panel', 'minimal']).default('inline'),
  size: s.enum(['sm', 'md', 'lg']).default('md').describe('Initial preview size when height is auto.'),
  kind: s.enum(kinds).describe('Selected by the fence language, not JSON metadata.'),
  source: s.string().describe('Source goes inside the fence, not in the metadata.'),
});
export type ArtifactProps = Infer<typeof artifactSchema>;

export const artifactPlugin: Plugin = {
  name: 'artifact-fences',
  transform(node) {
    if (node.type !== 'code' || !node.lang?.startsWith('artifact:')) return node;
    const kind = kinds.find(kind => node.lang === `artifact:${kind}`);
    if (!kind) return node;
    const props: Record<string, Value> = { kind, source: node.value ?? '' };
    const meta = node.meta?.trim() ?? '';
    const attrs = /([\w-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s{}]+))/g;
    for (const [, key, double, single, bare] of meta.matchAll(attrs)) {
      if (!['id', 'title', 'height', 'variant', 'size'].includes(key)) continue;
      props[key] = (double ?? single ?? bare).replace(/\\(["'\\])/g, '$1');
    }
    if (typeof props.height === 'string') props.height = props.height.replace(/px$/, '');
    return { ...node, type: 'component', name: 'artifact', props };
  },
};

export type Version = ArtifactProps & { number: number };
type History = { versions: readonly Version[]; listen: Set<() => void> };
const histories = new WeakMap<Store, Map<string, History>>();
const empty: readonly Version[] = [];
const MAX_VERSIONS = 12, MAX_ARTIFACTS = 100;

export function historyFor(store: Store, id: string | undefined) {
  let history: History | undefined;
  if (id !== undefined) {
    let map = histories.get(store);
    if (!map) histories.set(store, map = new Map());
    history = map.get(id);
    if (!history) {
      if (map.size >= MAX_ARTIFACTS) {
        const idle = [...map].find(([, value]) => !value.listen.size);
        if (idle) map.delete(idle[0]);
      }
      map.set(id, history = { versions: empty, listen: new Set() });
    }
  }
  return {
    subscribe(fn: () => void) { history?.listen.add(fn); return () => history?.listen.delete(fn); },
    snapshot: () => history?.versions ?? empty,
    publish(props: ArtifactProps) {
      if (!history || props.source.length > 1_000_000 || history.versions.some(version =>
        version.kind === props.kind && version.source === props.source && version.title === props.title &&
        version.height === props.height && version.variant === props.variant && version.size === props.size)) return;
      const number = (history.versions.at(-1)?.number ?? 0) + 1;
      history.versions = [...history.versions.slice(1 - MAX_VERSIONS), { ...props, number }];
      for (const notify of history.listen) notify();
    },
  };
}

export function sourceDiff(oldSource: string, source: string) {
  const old = oldSource.split('\n'), next = source.split('\n');
  const lines: { type: 'same' | 'insert' | 'delete'; text: string }[] = [];
  let start = 0, a = old.length, b = next.length;
  while (start < a && start < b && old[start] === next[start]) lines.push({ type: 'same', text: old[start++] });
  while (a > start && b > start && old[a - 1] === next[b - 1]) { a--; b--; }
  const width = b - start + 1, depth = a - start + 1;
  if (width * depth > 150_000) {
    for (let i = start; i < a; i++) lines.push({ type: 'delete', text: old[i] });
    for (let i = start; i < b; i++) lines.push({ type: 'insert', text: next[i] });
  } else {
    const counts = new Uint32Array(width * depth);
    for (let i = a - 1; i >= start; i--) for (let j = b - 1; j >= start; j--) {
      const offset = (i - start) * width + j - start;
      counts[offset] = old[i] === next[j] ? 1 + counts[offset + width + 1] : Math.max(counts[offset + 1], counts[offset + width]);
    }
    for (let i = start, j = start; i < a || j < b;) {
      const offset = (i - start) * width + j - start;
      if (i < a && j < b && old[i] === next[j]) { lines.push({ type: 'same', text: old[i++] }); j++; }
      else if (i < a && (j === b || counts[offset + width] >= counts[offset + 1])) lines.push({ type: 'delete', text: old[i++] });
      else lines.push({ type: 'insert', text: next[j++] });
    }
  }
  for (; a < old.length; a++) lines.push({ type: 'same', text: old[a] });
  return lines;
}
