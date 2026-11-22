import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import type { ComponentProps } from 'react';
import { Prism, usePart, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { ComponentFrame, useFrame, type ComponentFrameProps } from '../src';

afterEach(cleanup);

function setup(options: Partial<ComponentFrameProps> = {}, prism: Partial<ComponentProps<typeof Prism>> = {}) {
  const store = prism.store ?? createStore();
  function Example() { return <ComponentFrame component="example" title="Decision" {...options}>Frame content</ComponentFrame>; }
  return { store, ...render(<Prism source={'::example{id=demo}\n'} components={{ example: Example }} store={store} {...prism} />) };
}

test('frame renders accessible parts, toolbar, footer and entry marker', () => {
  const view = setup({ label: 'Decision settings', state: 'ready', toolbar: <span>Draft</span>, actions: <button>Confirm</button>, as: 'article', className: 'custom', style: { maxWidth: 500 } });
  const frame = view.getByRole('group', { name: 'Decision settings' });
  expect(frame.tagName).toBe('ARTICLE'); expect(frame.tabIndex).toBe(-1); expect(frame.dataset.state).toBe('ready'); expect(frame.hasAttribute('data-prism-enter')).toBe(true);
  expect(frame.className).toBe('prism-frame__root prism-example__root custom'); expect(frame.style.maxWidth).toBe('500px');
  for (const part of ['root', 'header', 'title', 'toolbar', 'body', 'footer']) {
    const element = part === 'root' ? frame : frame.querySelector(`[data-part="${part}"]`)!;
    expect(element.classList.contains(`prism-frame__${part}`)).toBe(true); expect(element.classList.contains(`prism-example__${part}`)).toBe(true); expect(element.getAttribute('data-prism')).toBe('example');
  }
  expect(view.getByText('Draft')).toBeDefined(); expect(view.getByText('Frame content')).toBeDefined(); expect(view.getByRole('button', { name: 'Confirm' })).toBeDefined();
  expect(view.getByRole('button', { name: 'Ask about this' }).querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
});

test('ask emits the enclosing directive context and the default human message', () => {
  const actions: Action[] = [], store = createStore({ initial: { demo: { checked: true } } });
  const view = setup({}, { store, onAction: action => actions.push(action) });
  fireEvent.click(view.getByRole('button', { name: 'Ask about this' }));
  expect(actions).toEqual([{ type: 'ask', component: 'example', id: 'demo', payload: undefined, context: { component: 'example', props: { id: 'demo' }, state: { checked: true } }, message: 'Tell me more about this example…' }]);
  expect(view.getByRole('group').getAttribute('aria-label')).toBe('Decision');
});

test('undo is reactive, restores state, and becomes disabled when history empties', () => {
  const view = setup({ undo: true }), button = view.getByRole('button', { name: 'Undo' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  act(() => view.store.set('demo.count', 1)); expect(button.disabled).toBe(false);
  fireEvent.click(button); expect(view.store.get('demo.count')).toBeUndefined(); expect(button.disabled).toBe(true);
  act(() => view.store.redo()); expect(button.disabled).toBe(false); expect(view.store.get('demo.count')).toBe(1);
});

test('keyboard undo and redo support Control and Meta, with Escape blurring focus', () => {
  const view = setup({ undo: true }), group = view.getByRole('group');
  act(() => view.store.set('demo.value', 1));
  fireEvent.keyDown(group, { key: 'z', ctrlKey: true }); expect(view.store.get('demo.value')).toBeUndefined();
  fireEvent.keyDown(group, { key: 'Z', ctrlKey: true, shiftKey: true }); expect(view.store.get('demo.value')).toBe(1);
  fireEvent.keyDown(group, { key: 'z', metaKey: true }); expect(view.store.get('demo.value')).toBeUndefined();
  fireEvent.keyDown(group, { key: 'z', metaKey: true, shiftKey: true }); expect(view.store.get('demo.value')).toBe(1);
  const ask = view.getByRole('button', { name: 'Ask about this' }); act(() => ask.focus()); expect(document.activeElement).toBe(ask);
  fireEvent.keyDown(ask, { key: 'Escape' }); expect(document.activeElement).not.toBe(ask);
});

test('disabled undo leaves history alone and nested frames do not undo twice', () => {
  const view = setup({ ask: false }); act(() => view.store.set('demo.value', 1));
  fireEvent.keyDown(view.getByRole('group'), { key: 'z', ctrlKey: true }); expect(view.store.get('demo.value')).toBe(1);
  expect(view.queryByRole('button')).toBeNull();
  function Nested() { return <ComponentFrame component="outer" title="Outer" undo><ComponentFrame component="inner" title="Inner" undo /></ComponentFrame>; }
  view.rerender(<Prism source={'::example{id=demo}\n'} components={{ example: Nested }} store={view.store} />);
  act(() => view.store.set('demo.value', 2)); fireEvent.keyDown(view.getByRole('group', { name: 'Inner' }), { key: 'z', ctrlKey: true }); expect(view.store.get('demo.value')).toBe(1);
});

test('unstyled removes both class families but preserves data, custom classes and styles', () => {
  const view = setup({ state: 'done' }, { unstyled: true, animate: false, classNames: { example: { root: 'specific' }, frame: { root: 'generic' } }, styles: { example: { root: { color: 'red' } }, frame: { root: { padding: 10 } } } });
  const group = view.getByRole('group');
  expect(group.className).toBe('generic specific'); expect(group.dataset.prism).toBe('example'); expect(group.dataset.part).toBe('root'); expect(group.dataset.state).toBe('done');
  expect(group.style.color).toBe('red'); expect(group.style.padding).toBe('10px'); expect(group.hasAttribute('data-prism-enter')).toBe(false);
  group.querySelectorAll('[class]').forEach(element => expect(element.className).not.toContain('prism-'));
  expect(view.getByRole('button', { name: 'Ask about this' }).getAttribute('data-part')).toBe('ask');
});

test('component and generic frame slots override presentation', () => {
  function Body({ children, ...props }: { children?: React.ReactNode }) { return <main {...props}>{children}</main>; }
  function Title({ children }: { children?: React.ReactNode }) { return <h2>{children} slot</h2>; }
  const view = setup({}, { slots: { frame: { body: Body }, example: { title: Title } } });
  expect(view.container.querySelector('main')?.textContent).toBe('Frame content'); expect(view.getByRole('heading', { level: 2 }).textContent).toBe('Decision slot');
});

test('headless useFrame supports a minimal view and an untitled frame is labelled', () => {
  function Minimal() { const frame = useFrame({ component: 'minimal', undo: true }); const part = usePart('minimal', 'body'); return <div {...frame.rootProps}><button {...part} onClick={frame.onAsk}>Headless ask</button></div>; }
  const actions: Action[] = [];
  const view = render(<Prism source={'::minimal\n'} components={{ minimal: Minimal }} onAction={a => actions.push(a)} />);
  expect(view.getByRole('group').getAttribute('aria-label')).toBe('minimal'); fireEvent.click(view.getByRole('button')); expect(actions[0].type).toBe('ask');
});

test('CSS declares every ThemeTokens name using the createTheme kebab convention', () => {
  const source = readFileSync(new URL('../../react/src/theme.tsx', import.meta.url), 'utf8');
  const tokens = source.split('export interface ThemeTokens {')[1].split('}')[0].matchAll(/(\w+): string/g);
  const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
  for (const [, token] of tokens) expect(css).toContain('--prism-' + token.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + ':');
});
