import '../../../packages/react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { App } from '../src/App';
import { demos } from '../src/catalogue';

const previousUrl = window.location.href;
afterEach(() => { cleanup(); localStorage.clear(); window.location.href = previousUrl; });
test('anonymous Launch phases tabs retain their selection across shell remounts', async () => {
  window.location.href = 'http://localhost/';
  const source = demos.find(demo => demo.id === 'tabs')!.source;
  const view = render(<App agentFactory={() => ({ id: 'review', label: 'Review', async *respond() { yield { type: 'text', delta: source }; } })} />);
  fireEvent.click(view.getByRole('button', { name: /Pick a laptop/ }));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  await waitFor(() => expect(view.queryByRole('button', { name: 'Stop response' })).toBeNull());
  const during = view.getByRole('tab', { name: 'During' });
  fireEvent.click(during);
  expect(during.getAttribute('aria-selected')).toBe('true');
  for (const name of ['Editor', 'Workspace', 'Chat']) {
    fireEvent.click(view.getByRole('button', { name }));
    expect(view.getByRole('tab', { name: 'During' }).getAttribute('aria-selected')).toBe('true');
  }
});
