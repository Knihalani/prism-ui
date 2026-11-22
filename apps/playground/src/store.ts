import { createStore, localStorageAdapter } from '@prism-ui/state';

const adapter = localStorageAdapter('prism-ui');
const namespace = 'playground';

export function makeStore(reset = false) {
  if (reset) adapter.save(namespace, {});
  return createStore({ initial: { rent: 1200 }, persist: adapter, namespace });
}
