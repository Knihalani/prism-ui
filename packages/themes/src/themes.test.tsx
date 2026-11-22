import '../../react/test/setup';
import { expect, test } from 'bun:test';
import { act, fireEvent, render, within } from '@testing-library/react';
import { Prism, ThemeScope, host } from '@prism-ui/react';
import '@prism-ui/components/estimate';
import '@prism-ui/components/pick';
import '@prism-ui/components/mockup';
import { instrument, objects, print, refraction } from './index';
import { print as printSubpath } from '@prism-ui/themes/print';
import { objects as objectsSubpath } from '@prism-ui/themes/objects';

test('Print and Objects expose named themes and dark tokens', () => {
  expect(printSubpath).toBe(print);
  expect(objectsSubpath).toBe(objects);
  for (const theme of [print, objects]) {
    expect(theme.name).toBeTruthy();
    expect(theme.dark?.bg).toBeTruthy();
    expect(theme.dark?.text).toBeTruthy();
  }
  expect('components' in objects).toBe(false);
});

test('Print feedback field preserves its label, edits and submit action', () => {
  const actions: { type: string }[] = [];
  const source = '```ui:mockup\n' + JSON.stringify({ id: 'figure', kind: 'svg', source: '<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>' }) + '\n```';
  const view = render(<Prism source={source} theme={print} animate={false} onAction={action => actions.push(action)} />);
  const field = within(view.container).getByRole('textbox', { name: 'Overall feedback' }) as HTMLTextAreaElement;
  const submit = within(view.container).getByRole('button', { name: 'Submit feedback' });
  expect(field.getAttribute('rows')).toBe('1');
  expect(field.hasAttribute('model')).toBe(false);
  expect(submit.hasAttribute('disabled')).toBe(true);
  act(() => field.focus());
  fireEvent.change(field, { target: { value: 'Keep the invitation short.\nUse more space around the title.' } });
  fireEvent.keyUp(field, { key: 'Unidentified' });
  expect(field.value).toContain('Use more space');
  expect(submit.hasAttribute('disabled')).toBe(false);
  fireEvent.click(submit);
  expect(actions).toHaveLength(1);
  expect(within(view.container).getByRole('button', { name: 'Edit feedback' })).toBeTruthy();
});

test('Print restructures Estimate without losing quantity, switch, Undo or submit behavior', () => {
  const actions: { type: string; payload: unknown }[] = [];
  const view = render(<Prism source={source} theme={print} animate={false} onAction={action => actions.push(action)} />);
  expect(view.container.querySelector('[data-print-total]')).not.toBeNull();
  expect(view.container.querySelector('.print-account [data-part="submit"]')).not.toBeNull();
  expect(within(view.container).getByRole('spinbutton', { name: 'Seats' }).getAttribute('aria-valuenow')).toBe('6');
  fireEvent.click(view.container.querySelector('[data-part="increase"]')!);
  expect(view.container.querySelector('[data-part="live"]')?.textContent).toBe('$288.00');
  fireEvent.click(within(view.container).getByRole('button', { name: 'Undo' }));
  expect(view.container.querySelector('[data-part="live"]')?.textContent).toBe('$252.00');
  const toggle = within(view.container).getByRole('switch', { name: 'Notes' }) as HTMLInputElement;
  fireEvent.click(toggle);
  expect(toggle.checked).toBe(false);
  expect(view.container.querySelector('[data-part="live"]')?.getAttribute('aria-live')).toBe('polite');
  expect(within(view.container).getByRole('button', { name: 'Ask' }).getAttribute('title')).toBe('Ask');
  fireEvent.click(within(view.container).getByRole('button', { name: 'Send estimate ↗' }));
  expect(actions.at(-1)?.type).toBe('use');
  expect(within(view.container).getByRole('button', { name: 'Estimate sent ✓' }).hasAttribute('disabled')).toBe(true);
});

test('Print criteria sliders change the winner and choose emits the selected option and weights', () => {
  const actions: { type: string; payload: any }[] = [];
  const pick = '```ui:pick\n' + JSON.stringify({ id: 'approach', criteria: [{ id: 'learning', label: 'Learning' }, { id: 'cost', label: 'Cost' }], options: [{ id: 'concierge', title: 'Concierge', scores: { learning: .9, cost: .5 } }, { id: 'self', title: 'Self-serve', scores: { learning: .6, cost: .9 } }] }) + '\n```';
  const view = render(<Prism source={pick} theme={print} animate={false} onAction={action => actions.push(action)} />);
  expect(view.container.querySelector('[data-print-winner]')?.textContent).toContain('Self-serve');
  fireEvent.input(within(view.container).getByRole('slider', { name: 'Learning weight' }), { target: { value: '3' } });
  fireEvent.input(within(view.container).getByRole('slider', { name: 'Cost weight' }), { target: { value: '0' } });
  expect(view.container.querySelector('[data-print-winner]')?.textContent).toContain('Concierge');
  fireEvent.click(within(view.container).getByRole('button', { name: 'Choose Concierge ↗' }));
  expect(actions.at(-1)).toMatchObject({ type: 'choose', payload: { option: 'concierge', weights: { learning: 3, cost: 0 } } });
  expect(view.container.querySelector('[data-print-winner] [role="status"]')?.textContent).toBe('Chosen');
});

test('Print keeps empty Estimate and Pick states accessible without inventing actions', () => {
  const view = render(<Prism source={'```ui:estimate\n{"id":"empty","items":[]}\n```\n\n```ui:pick\n{"id":"none","criteria":[],"options":[]}\n```'} theme={print} animate={false} onAction={() => {}} />);
  expect(within(view.container).getByText('Items will appear here')).toBeTruthy();
  expect(within(view.container).getByText('Options will appear here')).toBeTruthy();
  expect(within(view.container).getByRole('button', { name: 'Send estimate ↗' }).hasAttribute('disabled')).toBe(true);
  expect(view.container.querySelector('[data-print-winner]')).toBeNull();
});

test('Print retains loading/error guards and uses the estimate currency and actual footnotes', () => {
  const pending = '```ui:estimate\n{"id":"pending","currency":"EUR","items":[{"id":"one","label":"Travel","description":"Train tickets"}]}\n```\n\n```ui:pick\n{"id":"pending-pick","criteria":[{"id":"cost","label":"Cost"}],"options":[{"id":"unscored","title":"Awaiting scores"}]}\n```';
  const view = render(<Prism source={pending} theme={print} animate={false} onAction={() => {}} />);
  expect(view.container.querySelector('[data-print-total] [data-part="total-label"]')?.textContent).toBe('Total / EUR');
  expect(view.container.querySelector('.print-footnote')?.textContent).toBe('¹ Train tickets · EUR');
  expect(within(view.container).getByRole('button', { name: 'Send estimate ↗' }).hasAttribute('disabled')).toBe(true);
  expect(within(view.container).getByRole('button', { name: 'Choose Awaiting scores ↗' }).hasAttribute('disabled')).toBe(true);
  expect(view.container.querySelector('[data-print-option]')?.getAttribute('aria-busy')).toBe('true');
  expect(view.container.querySelector('[data-print-winner]')).toBeNull();
});

const source = '```ui:estimate\n' + JSON.stringify({ id: 'quote', items: [{ id: 'seats', label: 'Seats', price: 36, qty: 6 }, { id: 'notes', label: 'Notes', price: 36, optional: true }] }) + '\n```';
test('the same Estimate uses independent themes and real structural slots', () => {
  const view = render(<><Prism source={source} theme={host} animate={false} /><Prism source={source} theme={refraction} animate={false} /><Prism source={source} theme={instrument} animate={false} onAction={() => {}} /></>);
  const roots = view.container.querySelectorAll('.prism-root');
  expect(roots.length).toBe(3); expect(roots[0].querySelector('[data-segmented]')).toBeNull(); expect(roots[1].querySelector('[data-segmented]')).toBeNull();
  expect(roots[2].querySelector('[data-segmented]')).not.toBeNull(); expect(roots[2].querySelectorAll('.instrument-screw').length).toBe(4);
  expect(roots[2].querySelectorAll('[role="spinbutton"]').length).toBe(1); expect(roots[2].querySelector('[role="switch"]')).not.toBeNull();
  fireEvent.click(roots[2].querySelector('[data-part="increase"]')!);
  expect(roots[2].querySelector('[data-part="live"]')?.textContent).toBe('$288.00');
  expect(roots[0].querySelector('[data-part="live"]')?.textContent).toBe('$252.00');
  fireEvent.click(roots[2].querySelector('[data-part="submit"]')!);
  expect(roots[2].querySelector('[data-part="submit"]')?.textContent).toBe('Sent');
});

test('an outer Instrument scope does not replace parts in a nested host Prism', () => {
  const view = render(<ThemeScope theme={instrument}><Prism source={source} animate={false} /><ThemeScope theme={host}><Prism source={source} animate={false} /></ThemeScope></ThemeScope>);
  expect(view.container.querySelectorAll('[data-segmented]').length).toBe(1);
  expect(view.container.querySelectorAll('.prism-root')[1].getAttribute('data-prism-theme-name')).toBe('host');
});
