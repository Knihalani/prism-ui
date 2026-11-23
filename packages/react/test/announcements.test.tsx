import './setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { createStore } from '@prism-ui/state';
import { s } from '@prism-ui/schema';
import { Prism, createRegistry, defineComponent, useSentAnnouncement, type PrismComponentProps } from '../src';
import { createFormat } from '../src/format';
import { blockAnnouncement, createAnnouncementQueue } from '../src/announcements';

afterEach(cleanup);
const pause = (ms = 750) => act(() => new Promise<void>(resolve => setTimeout(resolve, ms)));
const live = (view: ReturnType<typeof render>) => view.container.querySelector('[data-prism-announcer]')!;
function samples(element: Element) {
  const values: string[] = [];
  const observer = new MutationObserver(() => { if (element.textContent) values.push(element.textContent); });
  observer.observe(element, { childList: true, subtree: true, characterData: true });
  return { values, observer };
}

test.each([false, true])('token updates stay silent until settled, once per block (unstyled=%s)', async unstyled => {
  const view = render(<Prism source="" done={false} unstyled={unstyled} />), output = live(view), log = samples(output);
  expect(view.container.querySelectorAll('[data-prism-announcer]').length).toBe(1);
  expect(output.getAttribute('role')).toBe('status');
  expect(output.getAttribute('aria-live')).toBe('polite');
  expect(output.getAttribute('aria-atomic')).toBe('true');
  for (const source of ['A', 'A qui', 'A quiet', 'A quiet answer.']) {
    view.rerender(<Prism source={source} done={false} unstyled={unstyled} />);
    expect(output.textContent).toBe('');
  }
  await pause(); expect(log.values).toEqual([]);
  view.rerender(<Prism source={'A quiet answer.\n\nLast wor'} done={false} unstyled={unstyled} />);
  await pause(); expect(log.values).toEqual(['A quiet answer.']);
  view.rerender(<Prism source={'A quiet answer.\n\nLast words.'} done={false} unstyled={unstyled} />);
  expect(log.values).toEqual(['A quiet answer.']);
  await act(() => view.rerender(<Prism source={'A quiet answer.\n\nLast words.'} done unstyled={unstyled} />));
  expect(log.values).toEqual(['A quiet answer.', 'Last words.']);
  view.rerender(<Prism source={'A quiet answer.\n\nLast words.'} done unstyled={unstyled} />);
  await pause(10); expect(log.values).toEqual(['A quiet answer.', 'Last words.']);
  log.observer.disconnect();
});

test('settled blocks coalesce at 700ms and final done flushes pending blocks immediately', async () => {
  const view = render(<StrictMode><Prism source="" done={false} /></StrictMode>), log = samples(live(view));
  const source = 'First block.\n\nSecond block.\n\nA last block';
  view.rerender(<StrictMode><Prism source={source} done={false} /></StrictMode>);
  expect(live(view).textContent).toBe('');
  await pause(); expect(log.values).toEqual(['First block.\nSecond block.']);
  view.rerender(<StrictMode><Prism source={source + '.\n\nFinal block.'} done={false} /></StrictMode>);
  await act(() => view.rerender(<StrictMode><Prism source={source + '.\n\nFinal block.'} done /></StrictMode>));
  expect(log.values).toEqual(['First block.\nSecond block.', 'A last block.\nFinal block.']);
  await pause(); expect(log.values.length).toBe(2);
  log.observer.disconnect();
});

test('history, initially complete streams and opt-out are silent', async () => {
  const view = render(<Prism source="History reply." />);
  expect(live(view).textContent).toBe('');
  view.rerender(<Prism source="Another complete reply." />);
  expect(live(view).textContent).toBe('');
  view.rerender(<Prism source="" done={false} announce={false} />);
  view.rerender(<Prism source={'Settled but silent.\n\nPending words.'} done={false} announce={false} />);
  expect(live(view)).toBeNull();
  view.rerender(<Prism source={'Settled but silent.\n\nPending words.'} announce={false} />);
  expect(live(view)).toBeNull();
  view.rerender(<Prism source={'Settled but silent.\n\nPending words.'} announce />);
  await pause(); expect(live(view).textContent).toBe('');
});

test('disabling or unmounting cancels queued speech', async () => {
  const messages: string[] = [], queue = createAnnouncementQueue(text => messages.push(text));
  queue.push(''); queue.push(' \n '); queue.flush(); expect(messages).toEqual([]);
  queue.push('Not delivered.'); queue.clear(); await pause(); expect(messages).toEqual([]);
  queue.push(' Final   words. '); queue.flush(); queue.flush(); expect(messages).toEqual(['Final words.']);
  const view = render(<Prism source="" done={false} />);
  view.rerender(<Prism source={'Canceled.\n\nStill streaming.'} done={false} />);
  view.rerender(<Prism source={'Canceled.\n\nStill streaming.'} done={false} announce={false} />);
  view.rerender(<Prism source={'Canceled.\n\nStill streaming.'} done={false} />);
  await pause(); expect(live(view).textContent).toBe('');
  view.unmount();
});

test('component summaries use coerced bound data, not rendered DOM, with safe fallback on errors', () => {
  const store = createStore(); store.set('amount', 42);
  const def = defineComponent({ name: 'metric', schema: s.object({ title: s.string(), value: s.number() }), component: () => <button>Never read this DOM</button>, announcement: props => `${props.title}: ${props.value}` });
  const registry = createRegistry([def]), context = { store, format: createFormat('en-GB') };
  const node = { type: 'component', name: 'metric', key: 'metric', props: { title: 'Completed', value: { $ref: 'amount' } } };
  expect(blockAnnouncement(node, registry, context)).toBe('Completed: 42');
  registry.register({ ...def, announcement() { throw Error('bad summary'); } });
  expect(blockAnnouncement(node, registry, context)).toBe('Completed. 42');
  expect(blockAnnouncement({ type: 'component', name: 'state', key: 'state' }, registry, context)).toBe('');
  expect(blockAnnouncement({ type: 'paragraph', key: 'empty', children: [] }, registry, context)).toBe('');
  expect(blockAnnouncement({ type: 'component', name: 'unknown', key: 'unknown', props: { title: 'Untyped', items: [1, 2] } }, registry, context)).toBe('Untyped. 2 items');
});

function Receipt({ props }: PrismComponentProps) {
  const [sent, setSent] = useState(props.sent === true);
  const announcement = useSentAnnouncement(sent, 'Submitted');
  return <>{announcement}<button onClick={() => setSent(true)}>Submit</button><button onClick={() => setSent(false)}>Reset</button></>;
}
const receipts = createRegistry([{ name: 'receipt', component: Receipt }]);
test.each([false, true])('receipts announce transitions once, not initial sent (%s)', async initiallySent => {
  const view = render(<Prism registry={receipts} source={'```ui:receipt\n' + JSON.stringify({ sent: initiallySent }) + '\n```'} />), log = samples(live(view));
  await pause(); expect(log.values).toEqual([]);
  if (initiallySent) { fireEvent.click(view.getByText('Submit')); await pause(); expect(log.values).toEqual([]); fireEvent.click(view.getByText('Reset')); }
  fireEvent.click(view.getByText('Submit')); await pause(); expect(log.values).toEqual(['Submitted']);
  fireEvent.click(view.getByText('Submit')); await pause(); expect(log.values).toEqual(['Submitted']);
  fireEvent.click(view.getByText('Reset')); fireEvent.click(view.getByText('Submit')); await pause(); expect(log.values).toEqual(['Submitted', 'Submitted']);
  log.observer.disconnect();
});

test('announce=false also disables receipt announcements', async () => {
  const view = render(<Prism registry={receipts} source="::receipt" announce={false} />);
  fireEvent.click(view.getByText('Submit')); await pause();
  expect(view.queryByRole('status')).toBeNull();
});
