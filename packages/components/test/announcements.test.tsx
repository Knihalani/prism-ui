import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { Prism, createRegistry, defaultRegistry } from '@prism-ui/react';
import { createFormat } from '../../react/src/format';
import { blockAnnouncement } from '../../react/src/announcements';
import { parse } from '@prism-ui/core';
import { createStore } from '@prism-ui/state';
import '../src';
import { Odometer } from '../src/shared';
import { SentContent } from '../src/shared/controls';
import { MockupFooter } from '../src/mockup/chrome';
import { mockupLabels } from '../src/mockup/use-mockup';

afterEach(cleanup);
const pause = (ms = 750) => act(() => new Promise<void>(resolve => setTimeout(resolve, ms)));
const fence = (name: string, props: object) => '```ui:' + name + '\n' + JSON.stringify(props) + '\n```';

test('Odometer exposes the final label once; animated reels never mutate live text', async () => {
  const view = render(<div aria-live="polite"><Odometer value={1} /></div>);
  const label = view.container.querySelector('.prism-odometer__label')!, messages: string[] = [];
  const observer = new MutationObserver(() => messages.push(label.textContent!));
  observer.observe(label, { childList: true, subtree: true, characterData: true });
  expect(label.nextElementSibling?.getAttribute('aria-hidden')).toBe('true');
  await act(() => view.rerender(<div aria-live="polite"><Odometer value={234} /></div>));
  expect(label.textContent).toBe('234'); expect(messages).toEqual(['234']);
  await pause(100); expect(messages).toEqual(['234']);
  expect(view.container.querySelector('[aria-live]')!.textContent).toContain('234');
  view.rerender(<div aria-live="polite"><Odometer value={234} animate={false} /></div>);
  expect(view.container.querySelector('.prism-odometer')!.textContent).toBe('234');
  observer.disconnect();
});

test('Num and View stats expose final values without live tween regions', () => {
  const view = render(<Prism source={':num[42]{id=count}\n\n' + fence('view', { title: 'Progress', children: [{ type: 'stat', label: 'Completed', value: 42 }] })} />);
  expect(view.getByRole('slider').getAttribute('aria-valuenow')).toBe('42');
  expect(view.getByRole('slider').getAttribute('aria-valuetext')).toContain('42');
  expect(view.container.querySelector('.prism-view__statValue')!.hasAttribute('aria-live')).toBe(false);
  expect(view.container.querySelector('.prism-view__statValue [aria-hidden="true"]')).not.toBeNull();
});

test('chart live values are final data, stable during domain animation and off during streaming', async () => {
  const props = { title: 'Revenue', x: 'month', series: [{ key: 'sales', label: 'Sales' }], data: [{ month: 'Jan', sales: 100 }] };
  const view = render(<Prism source={fence('chart', props)} />), svg = view.getByRole('img');
  fireEvent.keyDown(svg, { key: 'Home' });
  const status = view.container.querySelector('.prism-chart__status')!;
  expect(status.textContent).toBe('Jan. Sales: 100'); expect(status.getAttribute('aria-live')).toBe('polite');
  const values: string[] = [], observer = new MutationObserver(() => values.push(status.textContent!));
  observer.observe(status, { childList: true, subtree: true, characterData: true });
  await pause(100); expect(values).toEqual([]);
  view.rerender(<Prism source={fence('chart', props).slice(0, -4)} done={false} />);
  expect(view.container.querySelector('.prism-chart__status')!.getAttribute('aria-live')).toBe('off');
  observer.disconnect();
});

test('built-in summaries provide title/value, computed View stats, chart insight and formatted numbers', () => {
  const store = createStore(), context = { store, format: createFormat('en-US', 'USD') };
  store.set('metrics.count', 42);
  const sources = [
    [':num[42]{label="Completed"}', 'Completed: 42'],
    [fence('chart', { title: 'Revenue', insight: 'Sales increased', data: [{ x: 'Jan', y: 10 }] }), 'Revenue. Sales increased. 1 data points'],
    [fence('view', { id: 'metrics', title: 'Progress', state: { count: 42 }, children: [{ type: 'stat', label: 'Completed', value: { $bind: 'count' } }] }), 'Progress. Completed 42'],
  ];
  for (const [source, expected] of sources) expect(blockAnnouncement(parse(source).children[0], defaultRegistry, context)).toBe(expected);
});

function SharedReceipt() {
  const [sent, setSent] = useState(false);
  return <button onClick={() => setSent(true)}><SentContent sent={sent} receipt={<strong>Submitted</strong>}>Submit</SentContent></button>;
}
function FeedbackReceipt() {
  const [submitted, setSubmitted] = useState(false);
  return <MockupFooter labels={mockupLabels} count={1} submitted={submitted} edit={() => setSubmitted(false)} canUndo={false} canRedo={false} undo={() => {}} redo={() => {}} canSubmit submit={() => setSubmitted(true)} />;
}
test.each([
  ['shared', SharedReceipt, 'Submit', 'Submitted'],
  ['feedback', FeedbackReceipt, 'Submit feedback', 'Feedback sent · 1 comment'],
] as const)('%s receipt routes its exact past-tense label to the single root announcer', async (name, component, button, expected) => {
  const registry = createRegistry([{ name, component }]), view = render(<Prism registry={registry} source={'::' + name} />);
  const output = view.container.querySelector('[data-prism-announcer]')!;
  expect(output.textContent).toBe('');
  fireEvent.click(view.getByRole('button', { name: button }));
  await pause(); expect(output.textContent).toBe(expected);
  expect(view.container.querySelectorAll('[aria-live="polite"]').length).toBe(1);
});

test.each([
  ['card', { title: 'Report', action: 'Use report' }, 'Use report', 'Sent'],
  ['dataTable', { columns: [{ key: 'name', label: 'Name' }], rows: [{ name: 'Ada' }], select: 'multiple' }, 'Use 1 selected', 'Sent · 1'],
] as const)('%s component-specific receipt announces once', async (name, props, button, expected) => {
  const view = render(<Prism source={fence(name, props)} onAction={() => {}} />), output = view.container.querySelector('[data-prism-announcer]')!;
  const values: string[] = [], observer = new MutationObserver(() => values.push(output.textContent!));
  observer.observe(output, { childList: true, subtree: true, characterData: true });
  if (name === 'dataTable') fireEvent.click(view.getByRole('checkbox', { name: 'Select row 1' }));
  fireEvent.click(view.getByRole('button', { name: button }));
  await pause(); expect(values).toEqual([expected]);
  await pause(50); expect(values).toEqual([expected]); observer.disconnect();
});
