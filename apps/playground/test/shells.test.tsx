import '../../../packages/react/test/setup';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { host } from '@prism-ui/react';
import { SegmentedTotal } from '@prism-ui/themes';
import { App } from '../src/App';
import { fast } from '../src/agent/pace';
import { parseLocation, serialiseLocation, shells } from '../src/url-state';
import { enumerateThemes, availableThemes } from '../src/themes';

let previousUrl: string;
beforeEach(() => { previousUrl = window.location.href; window.location.href = 'http://localhost/'; });
afterEach(() => { cleanup(); localStorage.clear(); window.location.href = previousUrl; });
test('URL state handles empty, invalid and escaped input without inventing a mode preference', () => {
  expect(parseLocation('')).toEqual({ shell: 'chat', theme: 'host', mode: undefined });
  expect(parseLocation('?shell=bogus&theme=missing&mode=blue')).toEqual({ shell: 'chat', theme: 'host', mode: undefined });
  expect(parseLocation('?shell=editor&theme=objects&mode=dark', ['host', 'objects'])).toEqual({ shell: 'editor', theme: 'objects', mode: 'dark' });
  const state = { shell: 'workspace', theme: 'print & objects', mode: 'light' } as const;
  const encoded = serialiseLocation(state, '?extra=kept#not-a-fragment');
  expect(parseLocation(encoded, ['host', state.theme])).toEqual(state);
  expect(new URLSearchParams(encoded).get('extra')).toBe('kept#not-a-fragment');
  expect(serialiseLocation({ shell: 'chat', theme: 'host' }, '?mode=dark')).not.toContain('mode=');
});
test('theme enumeration puts host first and discovers future theme objects, not component exports', () => {
  const objects = { name: 'objects', tokens: {} }, print = { name: 'print' };
  expect(enumerateThemes({ component: () => null, nope: null, text: 'abc', objects, print, host, duplicate: objects, number: 3 })).toEqual([host, objects, print]);
  expect(availableThemes[0]).toBe(host);
  expect(availableThemes.map(theme => theme.name)).toContain('refraction');
  expect(availableThemes.map(theme => theme.name)).toContain('instrument');
  expect(availableThemes.map(theme => theme.name)).toEqual(expect.arrayContaining(['host', 'refraction', 'instrument', 'print', 'objects']));
  expect(availableThemes).toHaveLength(5);
  expect(availableThemes).not.toContain(SegmentedTotal);
});
test.each(['print', 'objects'])('%s styles the reply, not the host chrome, and round-trips through a shell change', async name => {
  const state = { shell: 'editor', theme: name, mode: 'dark' } as const;
  const names = availableThemes.map(theme => theme.name);
  expect(parseLocation(serialiseLocation(state), names)).toEqual(state);
  history.replaceState(null, '', '?' + serialiseLocation(state));
  const view = render(<App pace={fast} />);
  const select = view.getByRole('combobox', { name: 'Design theme' }) as HTMLSelectElement;
  expect(Array.from(select.options).map(option => option.value)).toEqual(names);
  expect(select.value).toBe(name);
  expect(view.container.querySelector('.shell')?.getAttribute('data-theme')).toBe(name);
  expect(view.container.querySelector('.shell')?.hasAttribute('data-prism-theme-name')).toBe(false);
  fireEvent.click(view.getByRole('button', { name: 'Workspace' }));
  expect(parseLocation(location.search, names)).toEqual({ ...state, shell: 'workspace' });
  fireEvent.change(view.getByRole('combobox', { name: 'Choose conversation or scenario' }), { target: { value: 'scenario:deploy' } });
  await waitFor(() => expect(view.container.querySelector('.reply-content > .prism-root')?.getAttribute('data-prism-theme-name')).toBe(name));
  await waitFor(() => expect(view.container.querySelector(name === 'print' ? '[data-print-header]' : '[data-objects-header]')).not.toBeNull());
});
test.each(shells)('%s renders and interacts with the same scenario reply', async shell => {
  history.replaceState(null, '', '?shell=' + shell + '&theme=host&mode=dark');
  const view = render(<App pace={fast} />);
  expect(view.container.querySelector('[data-shell]')?.getAttribute('data-shell')).toBe(shell);
  expect(view.container.querySelector('.shell')?.getAttribute('data-theme')).toBe('host');
  if (shell === 'chat') fireEvent.click(view.getByRole('button', { name: 'Recover the deploy' }));
  else fireEvent.change(view.getByRole('combobox', { name: 'Choose conversation or scenario' }), { target: { value: 'scenario:deploy' } });
  await waitFor(() => expect(view.container.querySelector('[data-prism="troubleshoot"]')).not.toBeNull());
  await waitFor(() => expect(view.queryByRole('button', { name: 'Stop response' })).toBeNull());
  fireEvent.click(view.getByRole('button', { name: 'Yes' }));
  await waitFor(() => expect(view.getByText('Did the release migration finish successfully?')).toBeDefined());
  if (shell === 'editor') {
    const separator = view.getByRole('separator', { name: 'Assistant panel width' });
    fireEvent.keyDown(separator, { key: 'Home' });
    expect(separator.getAttribute('aria-valuenow')).toBe('320');
  }
  if (shell === 'workspace') {
    const toggle = view.getByRole('button', { name: /Assistant/ });
    fireEvent.click(toggle); expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle); expect(toggle.getAttribute('aria-expanded')).toBe('true');
  }
  fireEvent.click(view.getByRole('button', { name: 'Editor' }));
  expect(view.container.querySelectorAll('[data-message="user"]')).toHaveLength(1);
  expect(view.getByText('Did the release migration finish successfully?')).toBeDefined();
  expect(new URLSearchParams(location.search).get('shell')).toBe('editor');
});
test('mode falls back to saved preference; changing theme and mode updates the URL without navigation', async () => {
  localStorage.setItem('prism-theme', 'dark');
  history.replaceState(null, '', '?keep=yes');
  const view = render(<App pace={fast} />);
  expect(view.container.querySelector('[data-prism-theme]')?.getAttribute('data-prism-theme')).toBe('dark');
  fireEvent.change(view.getByRole('combobox', { name: 'Design theme' }), { target: { value: 'refraction' } });
  fireEvent.click(view.getByRole('button', { name: 'Switch to light mode' }));
  expect(location.search).toContain('theme=refraction'); expect(location.search).toContain('mode=light'); expect(location.search).toContain('keep=yes');
  history.replaceState(null, '', '?shell=workspace&theme=instrument&mode=dark');
  act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  expect(view.container.querySelector('[data-shell]')?.getAttribute('data-shell')).toBe('workspace');
  expect(view.container.querySelector('.shell')?.getAttribute('data-theme')).toBe('instrument');
});
test('invalid URL and storage values fall back to chat, host and the system color preference', () => {
  const original = window.matchMedia;
  window.matchMedia = query => ({ media: query, matches: query.includes('prefers-color-scheme'), onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  try {
    localStorage.setItem('prism-theme', 'invalid');
    history.replaceState(null, '', '?shell=invalid&theme=invalid&mode=invalid');
    const view = render(<App pace={fast} />);
    expect(view.container.querySelector('[data-shell]')?.getAttribute('data-shell')).toBe('chat');
    expect(view.container.querySelector('.shell')?.getAttribute('data-theme')).toBe('host');
    expect(view.container.querySelector('[data-prism-theme]')?.getAttribute('data-prism-theme')).toBe('dark');
  } finally { window.matchMedia = original; }
});
test('the presentation switcher stays mounted and restores focus after the palette closes', () => {
  const view = render(<App pace={fast} />);
  const editor = view.getByRole('button', { name: 'Editor' });
  act(() => editor.focus());
  fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
  expect(view.getByRole('combobox', { name: 'Search scenarios and components' })).toBeDefined();
  fireEvent.keyDown(view.getByRole('combobox', { name: 'Search scenarios and components' }), { key: 'Escape' });
  expect(document.activeElement).toBe(editor);
});
