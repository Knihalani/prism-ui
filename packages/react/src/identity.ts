import { useLayoutEffect, useState } from 'react';
import type { Node } from '@prism-ui/core';
import type { Store } from '@prism-ui/state';

const record = (value: unknown): value is Record<string, unknown> => !!value && Object.getPrototypeOf(value) === Object.prototype;
function fillMissing(source: unknown, destination: unknown): unknown {
  if (destination === undefined) return source;
  if (!record(source) || !record(destination)) return destination;
  return Object.fromEntries([...new Set([...Object.keys(source), ...Object.keys(destination)])].map(key => [key, fillMissing(source[key], destination[key])]));
}

export function migrateComponentState(store: Store, from: string, to: string) {
  if (!store.hydrated) { void store.ready.then(() => migrateComponentState(store, from, to)); return; }
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
  const provisional = `${encodeURIComponent(scope).replaceAll('.', '%2E')}:${encodeURIComponent(node.name ?? node.type).replaceAll('.', '%2E')}:${encodeURIComponent(node.key).replaceAll('.', ':')}`;
  const requestedId = String(requested ?? provisional);
  const valid = requestedId.split('.').every(key => !['__proto__', 'constructor', 'prototype'].includes(key));
  const target = node.complete === false || !Object.isFrozen(node) || !valid ? provisional : requestedId;
  const [prepared, setPrepared] = useState<{ store: Store; from: string; to: string }>();
  const needsPreparation = !store.hydrated || target !== provisional && store.get(provisional) !== undefined;
  const ready = !needsPreparation || prepared?.store === store && prepared.from === provisional && prepared.to === target;
  useLayoutEffect(() => {
    if (ready) return;
    let active = true;
    const finish = () => {
      if (!active) return;
      migrateComponentState(store, provisional, target);
      setPrepared({ store, from: provisional, to: target });
    };
    if (store.hydrated) finish();
    else void store.ready.then(finish);
    return () => { active = false; };
  }, [target, provisional, store, ready]);
  return { id: target, ready };
}
