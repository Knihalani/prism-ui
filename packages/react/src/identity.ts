import { useEffect, useRef, useState } from 'react';
import type { Node } from '@prism-ui/core';
import type { Store } from '@prism-ui/state';

const owners = new WeakMap<Store, Map<string, { final: boolean; id: string | undefined; generation: number }>>();
const storeKeys = new WeakMap<Store, number>();
let nextStoreKey = 0;

export function migrateComponentState(store: Store, from: string, to: string) {
  if (!store.hydrated) { void store.ready.then(() => migrateComponentState(store, from, to)); return; }
  store.batch(() => {
    store.move(from, to);
    store.move(`__prism.feedback.${from}`, `__prism.feedback.${to}`, { record: true });
  }, { history: false });
}

export function useComponentId(node: Node, requested: unknown, store: Store, scope: string, requiresFinalId = false) {
  let storeKey = storeKeys.get(store);
  if (storeKey === undefined) storeKeys.set(store, storeKey = ++nextStoreKey);
  const key = `${encodeURIComponent(scope).replaceAll('.', '%2E')}:${encodeURIComponent(node.name ?? node.type).replaceAll('.', '%2E')}:${encodeURIComponent(node.key).replaceAll('.', ':')}`;
  const final = node.complete !== false && Object.isFrozen(node) || requiresFinalId && node.idComplete === true;
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
  const needsPreparation = awaiting.current === store || target !== provisional && (store.get(provisional) !== undefined || store.get(`__prism.feedback.${provisional}`) !== undefined);
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
  const id = preparing ? provisional : target;
  return { id, key: `${storeKey}:${id}`, owner: `${storeKey}:${provisional}`, ready: store.hydrated && awaiting.current !== store && (!requiresFinalId || final && !preparing) };
}
