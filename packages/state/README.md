# @prism-ui/state

`createStore()` provides dotted-path reads/writes, subscriptions, batching, persistence,
and snapshot-based undo/redo.

`undo(scope?)`, `redo(scope?)`, `canUndo(scope?)`, and `canRedo(scope?)` accept
an optional dotted namespace. The capability checks are methods. Scoped travel
reverts only paths equal to or below that namespace, leaving unrelated edits
and history intact. A mixed-scope batch can be undone separately for each scope.
Without a scope, travel restores whole snapshots as before.

With persistence, `store.hydrated` reports whether the initial load has finished.
Await `store.ready` before namespace migrations that must preserve saved fields;
it resolves after successful or failed asynchronous loads.

```ts
import { createStore } from '@prism-ui/state';

const store = createStore({ initial: { qty: 2, total: 20 } });
store.set('qty', 3);
store.set('total', 30, { history: false });
store.undo(); // { qty: 2, total: 20 }
store.redo(); // { qty: 3, total: 30 }
```

`set(path, value, options?)`, `update(path, updater, options?)`,
`apply(patch, options?)`, and `batch(callback, options?)` accept
`{ history: false }`. These writes still notify subscribers and persist normally,
but neither add an undo entry nor clear redo.

A batch with any changed history-enabled write creates one undo entry for the
whole batch, including its no-history writes. An all-no-history batch creates
none. Passing `{ history: false }` to a batch suppresses history for all nested
writes and batches, even when an inner write requests history. Empty, unchanged,
or rejected writes never create entries.

History stores complete state snapshots: no-history values are **not** excluded
from snapshots or permanently preserved across undo. Undo restores the full
snapshot before the user change; redo captures and restores the full state after
any derived reconciliation. Subscribers to derived paths are notified on history
travel as well. Reconciliation callbacks should use no-history writes so that
running after undo/redo does not discard redo. Initialization with no-history
writes does not itself make the store undoable.
