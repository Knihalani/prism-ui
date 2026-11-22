import '../../../packages/react/test/setup';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { App } from '../src/App';
import { fast } from '../src/agent/pace';
import { createScriptedAgent } from '../src/agent/scripted';
import { agentSource, scopedAgentSource } from '../src/adaptive-source';
import { shells } from '../src/url-state';
import type { AgentEvent } from '../src/agent/types';

let previousUrl: string;
beforeEach(() => { previousUrl = window.location.href; window.location.href = 'http://localhost/'; });
afterEach(() => { cleanup(); localStorage.clear(); window.location.href = previousUrl; });

test.each(shells)('%s opens the adaptive artifact scenario from the palette', async shell => {
  history.replaceState(null, '', '?shell=' + shell);
  const view = render(<App pace={fast} />);
  fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
  fireEvent.click(view.getByRole('option', { name: 'Build an adaptive team dashboard' }));
  await waitFor(() => expect(view.container.querySelectorAll('.prism-artifact__shell')).toHaveLength(2));
  await waitFor(() => expect(view.queryByRole('button', { name: 'Stop response' })).toBeNull());
  expect(view.getAllByRole('button', { name: 'Give feedback' })).toHaveLength(2);
  expect(view.container.querySelector('.prism-artifact__shell')?.getAttribute('data-variant')).toBe('inline');
  const scroll = view.container.querySelector<HTMLElement>('.thread-scroll')!;
  Object.defineProperties(scroll, { scrollHeight: { configurable: true, value: 1200 }, clientHeight: { configurable: true, value: 400 } });
  scroll.scrollTop = 0;
  fireEvent.scroll(scroll);
  expect(view.getByRole('button', { name: 'Jump to latest' })).toBeDefined();
  scroll.scrollTop = 760;
  fireEvent.scroll(scroll);
  expect(view.queryByRole('button', { name: 'Jump to latest' })).toBeNull();
  scroll.scrollTop = 800;
  fireEvent.scroll(scroll);
  expect(view.queryByRole('button', { name: 'Jump to latest' })).toBeNull();
  if (shell === 'workspace') {
    const feedback = view.getAllByRole('button', { name: 'Give feedback' })[0];
    fireEvent.click(feedback);
    fireEvent.keyDown(feedback, { key: 'Escape' });
    expect(view.getByRole('button', { name: /Assistant/ }).getAttribute('aria-expanded')).toBe('true');
  }
});

test('the shared preview source retains its IDs while each conversation scopes its artifacts', () => {
  expect(agentSource).toContain('{id=adaptive-dashboard');
  expect(agentSource).toContain('{id=adaptive-input');
  expect(scopedAgentSource('chat')).toContain('{id=chat-adaptive-input');
  expect(scopedAgentSource('chat')).not.toContain('{id=adaptive-input');
});

test('scripted artifact selection and feedback route back to the owning scenario', async () => {
  const agent = createScriptedAgent({ pace: fast }), signal = new AbortController().signal;
  const textOf = async (events: AsyncIterable<AgentEvent>) => { let text = ''; for await (const event of events) if (event.type === 'text') text += event.delta; return text; };
  const opening = await textOf(agent.respond({ kind: 'message', text: 'Build an adaptive team dashboard', history: [] }, signal));
  const id = opening.match(/id=([^\s}]+)-adaptive-input/)![1] + '-adaptive-input';
  const respond = (type: string, payload: unknown) => textOf(agent.respond({ kind: 'action', action: { id, component: 'artifact', type, payload, message: 'User interaction', context: { component: 'artifact', props: {}, state: {} } }, history: [{ role: 'assistant', text: opening }] }, signal));
  expect(await respond('select', { label: 'Quick win' })).toContain('“Quick win” is our next priority');
  expect(await respond('feedback', { overall: 'More breathing room' })).toContain('More breathing room');
  expect(await respond('feedback', {})).toContain('review the marked areas');
  expect(await respond('fix', { error: 'Rendering failed' })).toContain('rendering problem');
  expect(await respond('copy', {})).toBe('');
});
