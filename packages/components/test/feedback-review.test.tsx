import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { createFeedback } from '../src/mockup/engine';
import '../src/feedback';

afterEach(cleanup);
const source = '```ui:feedback-review\n{"id":"target"}\n```';
const View = () => <button>Target</button>;
function change(element: HTMLElement, value: string) { act(() => element.focus()); fireEvent.focus(element); fireEvent.change(element, { target: { value } }); fireEvent.keyUp(element, { key: 'Unidentified' }); }
function setup(saved = createFeedback({ overall: 'Saved' }).toJSON()) {
  const store = createStore({ initial: { target: { feedback: saved } } }), actions: Action[] = [];
  store.set('target.feedback.overall', 'Newer saved');
  const view = render(<Prism store={store} renderers={{ 'feedback-review': View }} feedback source={source} onAction={a => actions.push(a)} />);
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  return { view, store, actions };
}

test('native text undo wins over feedback history for focused fields and dirty drafts', () => {
  const { view, store } = setup(), overall = view.getByRole('textbox', { name: 'Overall feedback' });
  for (const modifier of ['ctrlKey', 'metaKey']) {
    expect(fireEvent.keyDown(overall, { key: 'z', [modifier]: true })).toBe(true);
    change(overall, 'Unsaved text');
    expect(fireEvent.keyDown(overall, { key: 'z', [modifier]: true })).toBe(true);
    expect(fireEvent.keyDown(view.getByRole('application'), { key: 'z', [modifier]: true })).toBe(true);
    expect(store.get('target.feedback.overall')).toBe('Newer saved');
  }
  change(overall, 'Newer saved');
  expect(fireEvent.keyDown(view.getByRole('application'), { key: 'z', ctrlKey: true })).toBe(false);
  expect(store.get('target.feedback.overall')).toBe('Saved');
});
