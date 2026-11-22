import type { Action } from '@prism-ui/react';

export function describeInteraction(action: Action) {
  return '[UI interaction]\nThe user interacted with a component:\n' + JSON.stringify(action);
}
