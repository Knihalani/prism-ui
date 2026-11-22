import { useEffect, useRef, useState } from 'react';
import type { Node } from '@prism-ui/core';
import type { Store } from '@prism-ui/state';

const owners = new WeakMap<Store, Map<string, { final: boolean; id: string | undefined; generation: number }>>();

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
  const key = `${encodeURIComponent(scope).replaceAll('.', '%2E')}:${encodeURIComponent(node.name ?? node.type).replaceAll('.', '%2E')}:${encodeURIComponent(node.key).replaceAll('.', ':')}`;
  const final = node.complete !== false && Object.isFrozen(node);
  const explicit = requested == null ? undefined : String(requested);
  let identities = owners.get(store);
  if (!identities) owners.set(store, identities = new Map());
  const previous = identities.get(key);
  const generation = (previous?.generation ?? 0) + Number(!!previous?.final && (!final || previous.id !== explicit));
  identities.set(key, { final, id: explicit, generation });
  const provisional = generation ? `${key}#${generation}` : key;
  const requestedId = explicit ?? provisional;
  const valid = requestedId.split('.').every(key => !['__proto__', 'constructor', 'prototype'].includes(key));
  const target = !final || !valid ? provisional : requestedId;
  const [prepared, setPrepared] = useState<{ store: Store; from: string; to: string }>();
  const awaiting = useRef<Store | undefined>(undefined);
  if (!store.hydrated) awaiting.current = store;
  const current = useRef({ store, from: provisional, to: target });
  current.current = { store, from: provisional, to: target };
  const needsPreparation = awaiting.current === store || target !== provisional && store.get(provisional) !== undefined;
  const preparedForTarget = prepared?.store === store && prepared.from === provisional && prepared.to === target;
  const preparing = needsPreparation && !preparedForTarget;
  useEffect(() => {
    if (!preparing) return;
    let active = true;
    const finish = () => {
      if (!active || current.current.store !== store || current.current.from !== provisional || current.current.to !== target) return;
      migrateComponentState(store, provisional, target);
      awaiting.current = undefined;
      setPrepared({ store, from: provisional, to: target });
    };
    if (store.hydrated) finish();
    else void store.ready.then(finish);
    return () => { active = false; };
  }, [target, provisional, store, preparing]);
  return { id: preparing ? provisional : target, ready: store.hydrated && awaiting.current !== store };
}
