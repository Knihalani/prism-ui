import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, defineRenderer, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import '../src/feedback';
import '../src/num';

afterEach(cleanup);
const source = '```ui:feedback-test\n{"id":"target"}\n```';
const View = () => <button>Actual input</button>;
function change(element: HTMLElement, value: string) { act(() => element.focus()); fireEvent.change(element, { target: { value } }); fireEvent.keyUp(element, { key: 'Unidentified' }); }

test('opening, editing, submitting and closing inline feedback preserve unrelated undo and redo', () => {
  const store = createStore();
  store.set('budget', 1); store.set('budget', 2); store.undo();
  const view = render(<Prism store={store} renderers={{ 'feedback-test': View }} feedback source={source} />);
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  expect(store.canUndo('target')).toBe(false);
  expect(store.canRedo()).toBe(true);
  change(view.getByRole('textbox', { name: 'Overall feedback' }), 'Keep this layout');
  fireEvent.click(view.getByRole('button', { name: 'Submit feedback' }));
  fireEvent.click(view.getByRole('button', { name: 'Close feedback' }));
  expect(store.canUndo('target')).toBe(false);
  expect(store.canRedo()).toBe(true);
  act(() => store.redo());
  expect(store.get('budget')).toBe(2);
});

test('feedback preserves valid phrasing content for inline built-ins, including the open editor', () => {
  const view = render(<Prism feedback source="Budget :num[3]{id=quantity} per seat." />);
  const paragraph = view.container.querySelector('p')!;
  expect(paragraph.querySelector('.prism-inline-feedback')?.tagName).toBe('SPAN');
  expect(paragraph.querySelector('[data-inline]')).not.toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  expect(paragraph.querySelector('div')).toBeNull();
  expect(paragraph.textContent).toContain('per seat.');
});

test('inline feedback reuses keyboard pin/comment UI and submits one targeted percent-space payload', () => {
  const actions: Action[] = [];
  const view = render(<Prism renderers={{ 'feedback-test': View }} feedback source={source} onAction={action => actions.push(action)} />);
  const input = view.getByText('Actual input');
  expect(view.queryByRole('application')).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  expect(view.getByRole('button', { name: 'Submit feedback' }).hasAttribute('disabled')).toBe(true);
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  change(view.getByPlaceholderText('Add a comment…'), 'Make this easier to see');
  fireEvent.click(view.getByRole('button', { name: 'Save' }));
  change(view.getByRole('textbox', { name: 'Overall feedback' }), 'A good first direction');
  fireEvent.click(view.getByRole('button', { name: 'Submit feedback' }));
  expect(actions).toHaveLength(1);
  expect(actions[0]).toMatchObject({ type: 'feedback', component: 'feedback-test', id: 'target', payload: { target: { name: 'feedback-test', id: 'target' }, coordinates: 'percent', overall: 'A good first direction', items: [{ n: 1, kind: 'pin', x: 50, y: 50, comment: 'Make this easier to see' }] } });
  expect(view.queryByRole('button', { name: 'Submit feedback' })).toBeNull();
  expect(view.getByText('Actual input')).toBe(input);
  fireEvent.keyDown(view.getByText('Edit feedback'), { key: 'Escape' });
  expect(view.queryByRole('textbox', { name: 'Overall feedback' })).toBeNull();
  expect(document.activeElement).toBe(view.getByRole('button', { name: 'Give feedback' }));
});

test('definitions can opt in or out; empty and canceled feedback sends nothing', () => {
  const enabled = defineRenderer('feedback-enabled-test', View, { feedback: true });
  const disabled = defineRenderer('feedback-disabled-test', View, { feedback: false });
  const actions: Action[] = [];
  const view = render(<Prism renderers={{ 'feedback-test': enabled }} source={source} onAction={a => actions.push(a)} />);
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  fireEvent.keyDown(view.getByPlaceholderText('Add a comment…'), { key: 'Escape' });
  expect(view.getByRole('button', { name: 'Submit feedback' }).hasAttribute('disabled')).toBe(true);
  expect(actions).toEqual([]);
  view.rerender(<Prism renderers={{ 'feedback-test': disabled }} feedback source={source} />);
  expect(view.queryByRole('button', { name: 'Give feedback' })).toBeNull();
});
