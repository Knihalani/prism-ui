type RecordStore = { get(path: string): unknown; set(path: string, value: unknown): void };

export function setRecordPath(store: RecordStore, root: string, path: string, value: unknown) {
  const keys = path.split('.');
  if (keys.some(key => ['__proto__', 'prototype', 'constructor'].includes(key)) || Object.is(store.get(`${root}.${path}`), value)) return;
  const write = (current: unknown, index: number): Record<string, unknown> => {
    const record: Record<string, unknown> = current && typeof current === 'object' ? { ...current } : {};
    const key = keys[index];
    record[key] = index === keys.length - 1 ? value : write(record[key], index + 1);
    return record;
  };
  store.set(root, write(store.get(root), 0));
}
