import '../../../packages/react/test/setup';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { App } from '../src/App';

const previousUrl = window.location.href, previousMedia = window.matchMedia;
beforeEach(() => {
  window.matchMedia = query => ({ media: query, matches: query === '(max-width: 820px)', onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
});
afterEach(() => { cleanup(); localStorage.clear(); window.matchMedia = previousMedia; window.location.href = previousUrl; });

test.each(['chat', 'editor', 'workspace'])('%s mobile navigation traps focus, isolates background and restores its trigger on Escape', shell => {
  window.location.href = 'http://localhost/?shell=' + shell;
  const view = render(<App />);
  const trigger = view.getByRole('button', { name: shell === 'chat' ? 'Open sidebar' : 'Open navigation' });
  act(() => trigger.focus());
  fireEvent.click(trigger);
  const dialog = view.getByRole('dialog', { name: shell === 'chat' ? 'Conversations' : shell === 'editor' ? 'Editor navigation' : 'Workspace navigation' });
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(dialog.getAttribute('aria-modal')).toBe('true');
  const switcher = view.container.querySelector('.shell-switcher')!;
  expect(switcher.hasAttribute('inert')).toBe(true);
  expect(switcher.hasAttribute('hidden')).toBe(true);
  for (const background of Array.from(view.container.querySelectorAll(shell === 'chat' ? '.chat-main' : shell === 'editor' ? '.ide-titlebar, .code-pane, .ide-assistant, .ide-status, .panel-resizer' : '.workspace-content'))) expect(background.hasAttribute('inert')).toBe(true);
  const buttons = within(dialog).getAllByRole('button'), first = buttons[0], last = buttons.at(-1)!;
  expect(document.activeElement).toBe(first);
  act(() => last.focus()); fireEvent.keyDown(last, { key: 'Tab' });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, { key: 'Escape' });
  expect(view.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(switcher.hasAttribute('inert')).toBe(false);
  expect(view.container.querySelector('#shell-navigation')!.hasAttribute('inert')).toBe(true);
});

test.each(['chat', 'editor', 'workspace'])('%s navigation closes from its backdrop without losing focus', shell => {
  window.location.href = 'http://localhost/?shell=' + shell;
  const view = render(<App />), trigger = view.getByRole('button', { name: shell === 'chat' ? 'Open sidebar' : 'Open navigation' });
  fireEvent.click(trigger);
  fireEvent.click(view.container.querySelector('.sidebar-backdrop')!);
  expect(view.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

test('selected mobile editor panes strengthen accent contrast against the filled background', async () => {
  const css = await Bun.file(new URL('../src/shells.css', import.meta.url)).text();
  expect(css).toMatch(/\.mobile-pane-switch button\[aria-pressed="true"\] \{[^}]*color: color-mix\(in srgb, var\(--app-accent\) 97%, var\(--app-text\)\)/);
});

test('Editor offers a mobile code preview without inventing file actions', () => {
  window.location.href = 'http://localhost/?shell=editor';
  const view = render(<App />), code = view.getByRole('button', { name: 'Code' }), assistant = view.getByRole('button', { name: 'Assistant' });
  expect(view.container.querySelector('#editor-code')!.hasAttribute('hidden')).toBe(true);
  fireEvent.click(code);
  expect(code.getAttribute('aria-pressed')).toBe('true');
  expect(view.container.querySelector('#editor-code')!.hasAttribute('hidden')).toBe(false);
  expect(view.container.querySelector('#editor-assistant')!.hasAttribute('hidden')).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Open navigation' }));
  expect(view.getByText('composer.tsx').closest('button, a, [role="button"]')).toBeNull();
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  fireEvent.click(assistant);
  expect(view.container.querySelector('#editor-code')!.hasAttribute('hidden')).toBe(true);
  expect(view.container.querySelector('#editor-assistant')!.hasAttribute('hidden')).toBe(false);
});

test('Workspace navigation and the Assistant never open together', () => {
  window.location.href = 'http://localhost/?shell=workspace';
  const view = render(<App />), assistant = view.getByRole('button', { name: /Assistant/ }), trigger = view.getByRole('button', { name: 'Open navigation' });
  expect(assistant.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(trigger);
  expect(assistant.getAttribute('aria-expanded')).toBe('false');
  expect(view.container.querySelector('.workspace-drawer-clip')!.hasAttribute('inert')).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Close navigation' }));
  fireEvent.click(assistant);
  expect(assistant.getAttribute('aria-expanded')).toBe('true');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(trigger);
  expect(assistant.getAttribute('aria-expanded')).toBe('false');
});

test('Chat closes the theme editor sheet before navigation becomes modal', () => {
  window.location.href = 'http://localhost/?shell=chat';
  const view = render(<App />);
  fireEvent.click(view.getByRole('button', { name: 'Customise theme' }));
  fireEvent.click(view.getByRole('button', { name: 'Open sidebar' }));
  expect(view.container.querySelector('#theme-editor')).toBeNull();
  expect(view.container.querySelector('.shell')!.classList.contains('theme-editor-open')).toBe(false);
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(view.container.querySelector('#theme-editor')).toBeNull();
  expect(document.activeElement).toBe(view.getByRole('button', { name: 'Open sidebar' }));
});

for (const shell of ['chat', 'editor', 'workspace']) for (const text of [':root { --primary: #123456; }', ':root { --primary:', '']) test(`${shell} navigation preserves the unapplied CSS import ${JSON.stringify(text)}`, () => {
  window.location.href = 'http://localhost/?shell=' + shell;
  const view = render(<App />);
  fireEvent.click(view.getByRole('button', { name: 'Customise theme' }));
  const label = 'Paste shadcn / Tailwind CSS variables', input = view.getByLabelText(label) as HTMLTextAreaElement;
  act(() => input.focus()); fireEvent.change(input, { target: { value: text } }); fireEvent.keyUp(input, { key: 'Unidentified' });
  expect((view.getByRole('button', { name: 'Apply', hidden: true }) as HTMLButtonElement).disabled).toBe(!text.trim());
  fireEvent.click(view.getByRole('button', { name: shell === 'chat' ? 'Open sidebar' : 'Open navigation' }));
  expect(view.container.querySelector('#theme-editor')).toBeNull();
  expect(view.container.querySelector('.shell-switcher')!.hasAttribute('inert')).toBe(true);
  const dialog = view.getByRole('dialog'); expect(dialog.contains(document.activeElement)).toBe(true);
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  fireEvent.click(view.getByRole('button', { name: 'Customise theme' }));
  expect((view.getByLabelText(label) as HTMLTextAreaElement).value).toBe(text);
  expect((view.getByRole('button', { name: 'Apply', hidden: true }) as HTMLButtonElement).disabled).toBe(!text.trim());
});
