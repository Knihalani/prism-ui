import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { Prism, createRegistry, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { askDefinition } from '../src/ask';

const { act, cleanup, fireEvent, render } = await import('@testing-library/react');

afterEach(cleanup);
const registry = createRegistry([askDefinition]);
const props = { id: 'book', title: 'Book a table', submit: 'Book table', fields: [
  { id: 'party', label: 'Party size', type: 'number', value: 4, required: true, min: 1, max: 20, step: 1, unit: 'guests', hint: 'Include children' },
  { id: 'date', label: 'Date', type: 'date', value: '2026-12-12' },
  { id: 'name', label: 'Name', type: 'text', placeholder: 'Your name' },
  { id: 'notes', label: 'Notes', type: 'textarea', value: 'window seat' },
  { id: 'outside', label: 'Outside', type: 'toggle', value: false },
  { id: 'area', label: 'Area', type: 'select', options: [{ value: 'front', label: 'Front' }, { value: 'back', label: 'Back' }] },
  { id: 'time', label: 'Time', type: 'select', options: ['17:00', '18:00', '19:00', '20:00', '21:00'] },
] };
const source = (value: unknown) => '```ui:ask\n' + JSON.stringify(value) + '\n```\n';

test('static fields use native inputs, suggested guesses, required labels and accessible hints', () => {
  const view = render(<Prism source={source(props)} registry={registry} />);
  const party = view.getByRole('spinbutton', { name: /Party size/ }) as HTMLInputElement;
  expect(party.value).toBe('4'); expect(party.min).toBe('1'); expect(party.max).toBe('20'); expect(party.step).toBe('1');
  expect(party.getAttribute('aria-required')).toBe('true');
  expect(document.getElementById(party.getAttribute('aria-describedby')!)?.textContent).toBe('Include children');
  expect(view.getAllByText('Suggested').length).toBe(4);
  expect(view.getByRole('switch', { name: /Outside/ }).getAttribute('aria-checked')).toBe('false');
  expect(view.getByRole('radiogroup', { name: 'Area' })).toBeDefined(); expect(view.getByRole('combobox', { name: 'Time' })).toBeDefined();
  fireEvent.change(party, { target: { value: '5' } }); expect(view.getAllByText('Suggested').length).toBe(3);
});

test('submit emits exact typed values including nulls, shows formatted summary, edit can resubmit', () => {
  const actions: Action[] = [], store = createStore();
  const view = render(<Prism source={source(props)} registry={registry} store={store} locale="en-GB" onAction={action => actions.push(action)} />);
  fireEvent.click(view.getByRole('button', { name: 'Book table' }));
  const values = { party: 4, date: '2026-12-12', name: null, notes: 'window seat', outside: false, area: null, time: null };
  expect(actions).toEqual([{ type: 'submit', component: 'ask', id: 'book', payload: { values }, context: { component: 'ask', props, state: { values, touched: { party: true, date: true, name: true, notes: true, outside: true, area: true, time: true }, submitted: true } }, message: 'Here are the details for "Book a table": Party size: 4 guests, Date: 12 Dec 2026, Name: Not provided, Notes: window seat, Outside: No, Area: Not provided, Time: Not provided.' }]);
  expect(view.getByRole('group').dataset.state).toBe('submitted'); expect(view.queryByRole('spinbutton')).toBeNull(); expect(view.getByText('12 Dec 2026')).toBeDefined();
  fireEvent.click(view.getByRole('button', { name: 'Edit' }));
  fireEvent.change(view.getByRole('textbox', { name: 'Name' }), { target: { value: 'Ada' } });
  fireEvent.click(view.getByRole('button', { name: 'Book table' }));
  expect(actions.length).toBe(2); expect((actions[1].payload as { values: object }).values).toEqual({ ...values, name: 'Ada' });
  expect(store.get('book.submitted')).toBe(true);
});

test('validation runs on blur and submit, exposes inline errors and focuses the first invalid field', () => {
  const actions: Action[] = [];
  const view = render(<Prism source={source(props)} registry={registry} onAction={action => actions.push(action)} />);
  const party = view.getByRole('spinbutton', { name: /Party size/ });
  fireEvent.change(party, { target: { value: '0' } }); expect(view.queryByRole('alert')).toBeNull();
  fireEvent.blur(party); expect(view.getByRole('alert').textContent).toBe('Enter at least 1');
  expect(party.getAttribute('aria-invalid')).toBe('true'); expect(party.getAttribute('aria-describedby')).toContain(view.getByRole('alert').id);
  fireEvent.change(party, { target: { value: '25' } }); expect(view.getByRole('alert').textContent).toBe('Enter no more than 20');
  fireEvent.change(party, { target: { value: '' } });
  fireEvent.click(view.getByRole('button', { name: 'Book table' }));
  expect(view.getByRole('alert').textContent).toBe('Required'); expect(document.activeElement).toBe(party); expect(actions).toEqual([]);
  fireEvent.change(party, { target: { value: '2' } }); expect(view.queryByRole('alert')).toBeNull();
});

test('segmented select arrows wrap, switch uses keyboard click and Enter submits inputs or modified textarea', () => {
  const actions: Action[] = [], view = render(<Prism source={source(props)} registry={registry} onAction={action => actions.push(action)} />);
  const front = view.getByRole('radio', { name: 'Front' }), back = view.getByRole('radio', { name: 'Back' });
  fireEvent.keyDown(front, { key: 'ArrowRight' }); expect(back.getAttribute('aria-checked')).toBe('true'); expect(document.activeElement).toBe(back);
  fireEvent.keyDown(back, { key: 'ArrowRight' }); expect(front.getAttribute('aria-checked')).toBe('true');
  fireEvent.keyDown(front, { key: 'End' }); expect(back.getAttribute('aria-checked')).toBe('true');
  fireEvent.click(view.getByRole('switch', { name: /Outside/ })); expect(view.getByRole('switch', { name: /Outside/ }).getAttribute('aria-checked')).toBe('true');
  fireEvent.keyDown(view.getByRole('textbox', { name: /Notes/ }), { key: 'Enter' }); expect(actions.length).toBe(0);
  fireEvent.keyDown(view.getByRole('textbox', { name: /Notes/ }), { key: 'Enter', ctrlKey: true }); expect(actions.length).toBe(1);
  fireEvent.click(view.getByRole('button', { name: 'Edit' })); fireEvent.keyDown(view.getByRole('textbox', { name: 'Name' }), { key: 'Enter' }); expect(actions.length).toBe(2);
});

test('streaming empty rows, label skeleton and last-field control skeleton remain safe until complete', () => {
  const initial = '```ui:ask\n{"id":"stream","fields":[';
  const view = render(<Prism source={initial} done={false} registry={registry} />);
  expect(view.container.querySelectorAll('[data-part="skeleton"]').length).toBe(2);
  expect((view.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
  const partial = initial + '{"id":"name","type":"text"';
  view.rerender(<Prism source={partial} done={false} registry={registry} />);
  expect(view.container.querySelector('[data-part="label"]')?.getAttribute('data-state')).toBe('loading');
  expect(view.container.querySelector('[data-part="skeleton"]')).not.toBeNull();
  view.rerender(<Prism source={partial + ',"label":"Name"},{"id":"age","label":"Age","type":"number"'} done={false} registry={registry} />);
  expect(view.getByRole('textbox', { name: 'Name' })).toBeDefined(); expect(view.queryByRole('spinbutton')).toBeNull();
  view.rerender(<Prism source={partial + ',"label":"Name"},{"id":"age","label":"Age","type":"number"}]}\n```\n'} registry={registry} />);
  expect(view.getByRole('spinbutton', { name: 'Age' })).toBeDefined(); expect((view.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(false);
});

test('unstyled mode, slots, labels, localized summaries and prompt docs', () => {
  const view = render(<Prism source={source({ id: 'local', fields: [{ id: 'n', label: 'Total', type: 'number', value: 1234.5 }], labels: { title: 'Détails', send: 'Envoyer', suggested: 'Proposé', edit: 'Modifier' } })} registry={registry} unstyled locale="de-DE" slots={{ ask: { title: ({ children }) => <h2>{children}</h2>, actions: input => <footer {...input} data-custom="actions" />, field: ({ field, index, vm }) => <article data-custom="field"><span>{field.label}</span><button type="button" onClick={() => vm.change(field.id, 2000)}>Change {index}</button></article> } }} />);
  expect(view.container.querySelector('[class*="prism-ask"]')).toBeNull(); expect(view.container.querySelector('[data-custom="field"]')).not.toBeNull(); expect(view.getByRole('heading', { level: 2 }).textContent).toBe('Détails');
  fireEvent.click(view.getByRole('button', { name: 'Envoyer' })); expect(view.getByText('1.234,5')).toBeDefined(); expect(view.getByRole('button', { name: 'Modifier' })).toBeDefined();
  expect(registry.docs()).toContain('```ui:ask'); expect(registry.docs()).toContain('"title":"Book a table"'); expect(registry.docs()).toContain('Only the missing details');
});

test('bound prefill updates until edited, undo restores edits, and false is a valid required answer', () => {
  const store = createStore({ initial: { guests: 4 } }), input = { id: 'bound', fields: [{ id: 'n', label: 'Guests', type: 'number', value: { $ref: 'guests' } }, { id: 'consent', label: 'Updates', type: 'toggle', required: true, value: false }] };
  const view = render(<Prism source={source(input)} registry={registry} store={store} />);
  expect((view.getByRole('spinbutton', { name: /Guests/ }) as HTMLInputElement).value).toBe('4');
  act(() => store.set('guests', 6)); expect((view.getByRole('spinbutton', { name: /Guests/ }) as HTMLInputElement).value).toBe('6');
  fireEvent.change(view.getByRole('spinbutton', { name: /Guests/ }), { target: { value: '8' } });
  fireEvent.keyDown(view.getByRole('group'), { key: 'z', ctrlKey: true }); expect((view.getByRole('spinbutton', { name: /Guests/ }) as HTMLInputElement).value).toBe('6');
  fireEvent.click(view.getByRole('button', { name: 'Send' })); expect(view.getByRole('group').dataset.state).toBe('submitted');
});
