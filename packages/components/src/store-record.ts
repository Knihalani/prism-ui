import type { WriteOptions } from '@prism-ui/state';

type RecordStore = { get(path: string): unknown; set(path: string, value: unknown, options?: WriteOptions): void; batch(fn: () => void, options?: WriteOptions): void };

export function setRecordPath(store: RecordStore, root: string, path: string, value: unknown, options?: WriteOptions) {
  const keys = path.split('.');
  if (keys.some(key => ['__proto__', 'prototype', 'constructor'].includes(key)) || Object.is(store.get(`${root}.${path}`), value)) return;
  const parents = (current: unknown, index: number): Record<string, unknown> => {
    let record: Record<string, unknown> = current && typeof current === 'object' ? Array.isArray(current) ? { ...current } : current as Record<string, unknown> : {};
    if (index < keys.length - 1) {
      const key = keys[index], child = parents(record[key], index + 1);
      if (child !== record[key]) record = { ...record, [key]: child };
    }
    return record;
  };
  store.batch(() => {
    store.set(root, parents(store.get(root), 0), { history: false });
    store.set(`${root}.${path}`, value, options);
  });
}
