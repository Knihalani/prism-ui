import type { Action } from '@prism-ui/react';
import type { Patch } from '@prism-ui/state';

export type Turn = { role: 'user' | 'assistant'; text: string };
export type AgentInput = { kind: 'message'; text: string; history: Turn[] } | { kind: 'action'; action: Action; history: Turn[]; snapshot?: Record<string, unknown> };
export type AgentEvent = { type: 'thinking' } | { type: 'text'; delta: string } | { type: 'patch'; patch: Patch } | { type: 'title'; title: string };
export interface Agent { id: string; label: string; respond(input: AgentInput, signal: AbortSignal): AsyncIterable<AgentEvent> }
export type Reply = { text: string; patch?: Patch };
