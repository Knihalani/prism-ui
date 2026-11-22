import '../../../packages/react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { App } from '../src/App';

const previousUrl = window.location.href;
afterEach(() => { cleanup(); localStorage.clear(); window.location.href = previousUrl; });
test('system mode stays absent from the URL across shell changes and reloads', () => {
  window.location.href = 'http://localhost/';
  localStorage.setItem('prism-theme', 'system');
  const view = render(<App />);
  expect(new URLSearchParams(location.search).has('mode')).toBe(false);
  fireEvent.click(view.getByRole('button', { name: 'Editor' }));
  expect(new URLSearchParams(location.search).has('mode')).toBe(false);
  view.unmount();
  const reloaded = render(<App />);
  fireEvent.click(reloaded.getByRole('button', { name: 'Chat' }));
  expect(reloaded.getByRole('button', { name: 'Theme: system' })).toBeDefined();
  fireEvent.click(reloaded.getByRole('button', { name: 'Theme: system' }));
  expect(new URLSearchParams(location.search).get('mode')).toBe('light');
  fireEvent.click(reloaded.getByRole('button', { name: 'Theme: light' }));
  expect(new URLSearchParams(location.search).get('mode')).toBe('dark');
  fireEvent.click(reloaded.getByRole('button', { name: 'Theme: dark' }));
  expect(new URLSearchParams(location.search).has('mode')).toBe(false);
});
