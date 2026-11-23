import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism } from '@prism-ui/react';
import { FeedbackEditorLoader, type FeedbackEditorProps } from '../src/feedback';
import { createLoader } from '../src/feedback-loader';

afterEach(cleanup);
const source = '```ui:lazy-target\n{}\n```';
const renderers = { 'lazy-target': () => <p>Target content</p> };
const Editor = ({ open, close }: FeedbackEditorProps) => <section role="dialog" hidden={!open}><button onClick={close}>Close editor</button></section>;

test('preloading deduplicates requests and retains the first activation while an editor is loading', async () => {
  let resolve!: (editor: typeof Editor) => void, calls = 0;
  const loader = createLoader(() => { calls++; return new Promise<typeof Editor>(done => { resolve = done; }); });
  const view = render(<FeedbackEditorLoader.Provider value={loader}><Prism source={source} renderers={renderers} feedback /></FeedbackEditorLoader.Provider>);
  await act(async () => {});
  expect(calls).toBe(1);
  const trigger = view.getByRole('button', { name: 'Give feedback' });
  fireEvent.pointerEnter(trigger.closest('.prism-inline-feedback')!);
  fireEvent.focus(trigger);
  fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(view.queryByRole('dialog')).toBeNull();
  await act(async () => { resolve(Editor); });
  expect(calls).toBe(1);
  expect(view.getByRole('dialog')).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'Close editor' }));
  expect(view.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

test('closing before loading finishes is not undone when the module arrives', async () => {
  let resolve!: (editor: typeof Editor) => void;
  const loader = createLoader(() => new Promise<typeof Editor>(done => { resolve = done; }));
  const view = render(<FeedbackEditorLoader.Provider value={loader}><Prism source={source} renderers={renderers} feedback /></FeedbackEditorLoader.Provider>);
  await act(async () => {});
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  fireEvent.keyDown(view.getByRole('button', { name: 'Close feedback' }), { key: 'Escape' });
  await act(async () => { resolve(Editor); });
  expect(view.queryByRole('dialog')).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  expect(view.getByRole('dialog')).toBeTruthy();
});

test('feedback disabled does not load an editor and leaves the target unchanged', async () => {
  let calls = 0;
  const loader = createLoader(async () => { calls++; return Editor; });
  const view = render(<FeedbackEditorLoader.Provider value={loader}><Prism source={source} renderers={renderers} feedback={false} /></FeedbackEditorLoader.Provider>);
  await act(async () => {});
  expect(calls).toBe(0);
  expect(view.getByText('Target content')).toBeTruthy();
  expect(view.queryByRole('button')).toBeNull();
});

test('failed preloads can retry on focus without an unhandled rejection or lost activation', async () => {
  let calls = 0;
  const loader = createLoader(async () => { if (++calls === 1) throw new Error('Unavailable'); return Editor; });
  const view = render(<FeedbackEditorLoader.Provider value={loader}><Prism source={source} renderers={renderers} feedback /></FeedbackEditorLoader.Provider>);
  await act(async () => {});
  expect(loader.value).toBeUndefined();
  const trigger = view.getByRole('button', { name: 'Give feedback' });
  await act(async () => { fireEvent.focus(trigger); fireEvent.click(trigger); });
  expect(calls).toBe(2);
  expect(view.getByRole('dialog')).toBeTruthy();
});
