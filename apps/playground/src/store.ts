import { createStore, localStorageAdapter } from '@prism-ui/state';

const adapter = localStorageAdapter('prism-ui');
export function makeStore(reset = false, namespace = 'playground') {
  if (reset) adapter.save(namespace, {});
  return createStore({ initial: { rent: 1200 }, persist: adapter, namespace });
}
