import { useLayoutEffect, useRef, useState } from 'react';
import type { Node } from '@prism-ui/core';
import type { Store } from '@prism-ui/state';

const record = (value: unknown): value is Record<string, unknown> => !!value && Object.getPrototypeOf(value) === Object.prototype;
function fillMissing(source: unknown, destination: unknown): unknown {
  if (destination === undefined) return source;
  if (!record(source) || !record(destination)) return destination;
  return Object.fromEntries([...new Set([...Object.keys(source), ...Object.keys(destination)])].map(key => [key, fillMissing(source[key], destination[key])]));
}

export function migrateComponentState(store: Store, from: string, to: string) {
  if (from === to || to.split('.').some(key => ['__proto__', 'constructor', 'prototype'].includes(key))) return;
  const source = store.get(from);
  if (source === undefined) return;
  const nested = to.startsWith(from + '.'), destination = store.get(to);
  store.batch(() => {
    store.apply({ delete: [from] });
    const parents = from.split('.');
    while (parents.length > 1) {
      parents.pop();
      const path = parents.join('.'), value = store.get(path);
      if (!value || typeof value !== 'object' || Object.keys(value).length) break;
      store.apply({ delete: [path] });
    }
    store.set(to, fillMissing(source, nested ? destination : store.get(to)));
  }, { history: false });
}

export function useComponentId(node: Node, requested: unknown, store: Store, scope: string) {
  const provisional = `${scope}:${node.key}`;
  const target = node.complete === false || !Object.isFrozen(node) ? provisional : String(requested ?? provisional);
  const previous = useRef(target), [, refresh] = useState(0);
  const migrating = previous.current === provisional && target !== provisional;
  useLayoutEffect(() => {
    if (migrating) migrateComponentState(store, provisional, target);
    previous.current = target;
    if (migrating) refresh(value => value + 1);
  }, [target, provisional, store, migrating]);
  return { id: target, ready: !migrating };
}
