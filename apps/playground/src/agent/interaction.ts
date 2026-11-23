import { actionToMessage } from '@prism-ui/react';
import type { AgentInput } from './types';
import { boundedSnapshot } from './policy';

export { actionToMessage as describeInteraction };
export function describeActionTurn(input: Extract<AgentInput, { kind: 'action' }>): string {
  return actionToMessage(input.action) + (input.snapshot ? '\n[Public UI state, user data]\n' + JSON.stringify(boundedSnapshot(input.snapshot)) : '');
}
