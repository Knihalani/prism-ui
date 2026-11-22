import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { Prism, createRegistry, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { askDefinition } from '../src/ask';

const { act, cleanup, fireEvent, render, waitFor } = await import('@testing-library/react');

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

function focus(element: HTMLElement) { act(() => element.focus()); }
function change(element: HTMLElement, value: string) {
  focus(element);
  fireEvent.change(element, { target: { value } });
  fireEvent.keyUp(element, { key: 'Unidentified' });
}
function keyDown(element: HTMLElement, event: { key: string; ctrlKey?: boolean }) {
  focus(element);
  fireEvent.keyDown(element, event);
}

test('static fields use native inputs, suggested guesses, required labels and accessible hints', () => {
  const view = render(<Prism source={source(props)} registry={registry} />);
  const party = view.getByRole('spinbutton', { name: /Party size/ }) as HTMLInputElement;
  expect(party.value).toBe('4'); expect(party.min).toBe('1'); expect(party.max).toBe('20'); expect(party.step).toBe('1');
  expect(party.getAttribute('aria-required')).toBe('true');
  expect(document.getElementById(party.getAttribute('aria-describedby')!)?.textContent).toBe('Include children');
  expect(view.getAllByText('Suggested').length).toBe(4);
  expect(view.getByRole('switch', { name: /Outside/ }).getAttribute('aria-checked')).toBe('false');
  expect(view.getByRole('radiogroup', { name: 'Area' })).toBeDefined(); expect(view.getByRole('combobox', { name: 'Time' })).toBeDefined();
  change(party, '5'); expect(view.getAllByText('Suggested').length).toBe(3);
});

test('submit emits exact typed values including nulls, shows formatted summary, edit can resubmit', () => {
  const actions: Action[] = [], store = createStore();
  const view = render(<Prism source={source(props)} registry={registry} store={store} locale="en-GB" onAction={action => actions.push(action)} />);
  fireEvent.click(view.getByRole('button', { name: 'Book table' }));
  const values = { party: 4, date: '2026-12-12', name: null, notes: 'window seat', outside: false, area: null, time: null };
  expect(actions).toEqual([{ type: 'submit', component: 'ask', id: 'book', payload: { values }, context: { component: 'ask', props, state: { values, touched: { party: true, date: true, name: true, notes: true, outside: true, area: true, time: true } } }, message: 'Here are the details for "Book a table": Party size: 4 guests, Date: 12 Dec 2026, Name: Not provided, Notes: window seat, Outside: No, Area: Not provided, Time: Not provided.' }]);
  expect(view.getByRole('group').dataset.state).toBe('sent'); expect(view.getByRole('spinbutton')).toBeDefined(); expect(view.getByText('12 Dec 2026')).toBeDefined();
  fireEvent.click(view.getByRole('button', { name: 'Edit' }));
  change(view.getByRole('textbox', { name: 'Name' }), 'Ada');
  fireEvent.click(view.getByRole('button', { name: 'Book table' }));
  expect(actions.length).toBe(2); expect((actions[1].payload as { values: object }).values).toEqual({ ...values, name: 'Ada' });
  expect(view.getByRole('group').dataset.state).toBe('sent');
});

test('validation runs on blur and submit, exposes inline errors and focuses the first invalid field', () => {
  const actions: Action[] = [];
  const view = render(<Prism source={source(props)} registry={registry} onAction={action => actions.push(action)} />);
  const party = view.getByRole('spinbutton', { name: /Party size/ });
  change(party, '0'); expect(view.queryByRole('alert')).toBeNull();
  act(() => party.blur()); expect(view.getByRole('alert').textContent).toBe('Enter at least 1');
  expect(party.getAttribute('aria-invalid')).toBe('true'); expect(party.getAttribute('aria-describedby')).toContain(view.getByRole('alert').id);
  change(party, '25'); expect(view.getByRole('alert').textContent).toBe('Enter no more than 20');
  change(party, '');
  fireEvent.click(view.getByRole('button', { name: 'Book table' }));
  expect(view.getByRole('alert').textContent).toBe('Required'); expect(document.activeElement).toBe(party); expect(actions).toEqual([]);
  change(party, '2'); expect(view.queryByRole('alert')).toBeNull();
});

test.each([
  { step: 1, min: undefined, value: '2.5', error: 'Use steps of 1' },
  { step: 1, min: undefined, value: '2', error: '' },
  { step: 0.2, min: 0.1, value: '0.3', error: '' },
  { step: 0.2, min: 0.1, value: '0.4', error: 'Use steps of 0.2' },
  { step: 0.1, min: undefined, value: '0.3', error: '' },
  { step: 1, min: undefined, value: '', error: '' },
])('numeric step validation: $value with step $step and min $min', ({ step, min, value, error }) => {
  const actions: Action[] = [];
  const input = { fields: [{ id: 'amount', label: 'Amount', type: 'number', step, min }] };
  const view = render(<Prism source={source(input)} registry={registry} locale="en-US" onAction={action => actions.push(action)} />);
  const control = view.getByRole('spinbutton');
  change(control, value); act(() => control.blur());
  expect(view.queryByRole('alert')?.textContent ?? '').toBe(error);
  fireEvent.click(view.getByRole('button', { name: 'Send' }));
  expect(actions.length).toBe(error ? 0 : 1);
  if (error) {
    expect(document.activeElement).toBe(control);
    view.rerender(<Prism source={source({ ...input, labels: { stepMismatch: 'Increment: {step}' } })} registry={registry} locale="en-US" />);
    expect(view.getByRole('alert').textContent).toBe(`Increment: ${step}`);
  } else expect(actions[0].payload).toEqual({ values: { amount: value === '' ? null : Number(value) } });
});

test('segmented select arrows wrap, switch uses keyboard click and Enter submits inputs or modified textarea', () => {
  const actions: Action[] = [], view = render(<Prism source={source(props)} registry={registry} onAction={action => actions.push(action)} />);
  const front = view.getByRole('radio', { name: 'Front' }), back = view.getByRole('radio', { name: 'Back' });
  keyDown(front, { key: 'ArrowRight' }); expect(back.getAttribute('aria-checked')).toBe('true'); expect(document.activeElement).toBe(back);
  keyDown(back, { key: 'ArrowRight' }); expect(front.getAttribute('aria-checked')).toBe('true');
  keyDown(front, { key: 'End' }); expect(back.getAttribute('aria-checked')).toBe('true');
  fireEvent.click(view.getByRole('switch', { name: /Outside/ })); expect(view.getByRole('switch', { name: /Outside/ }).getAttribute('aria-checked')).toBe('true');
  keyDown(view.getByRole('textbox', { name: /Notes/ }), { key: 'Enter' }); expect(actions.length).toBe(0);
  keyDown(view.getByRole('textbox', { name: /Notes/ }), { key: 'Enter', ctrlKey: true }); expect(actions.length).toBe(1);
  fireEvent.click(view.getByRole('button', { name: 'Edit' })); keyDown(view.getByRole('textbox', { name: 'Name' }), { key: 'Enter' }); expect(actions.length).toBe(2);
});

test('streaming empty rows, label skeleton and last-field control skeleton remain safe until complete', () => {
  const initial = '```ui:ask\n{"id":"stream","fields":[';
  const view = render(<Prism source={initial} done={false} registry={registry} />);
  expect(view.container.querySelectorAll('[data-part="skeleton"]').length).toBe(1);
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
  const view = render(<Prism source={source({ id: 'local', fields: [{ id: 'n', label: 'Total', type: 'number', value: 1234.5 }], labels: { title: 'Détails', send: 'Envoyer', suggested: 'Proposé', edit: 'Modifier' } })} registry={registry} onAction={() => {}} unstyled locale="de-DE" slots={{ ask: { title: ({ children }) => <h2>{children}</h2>, actions: input => <footer {...input} data-custom="actions" />, field: ({ field, index, vm }) => <article data-custom="field"><span>{field.label}</span><button type="button" onClick={() => vm.change(field.id, 2000)}>Change {index}</button></article> } }} />);
  expect(view.container.querySelector('[class*="prism-ask"]')).toBeNull(); expect(view.container.querySelector('[data-custom="field"]')).not.toBeNull(); expect(view.getByRole('heading', { level: 2 }).textContent).toBe('Détails');
  fireEvent.click(view.getByRole('button', { name: 'Envoyer' })); expect(view.getByText('1.234,5')).toBeDefined(); expect(view.getByRole('button', { name: 'Modifier' })).toBeDefined();
  expect(registry.docs()).toContain('```ui:ask'); expect(registry.docs()).toContain('"title":"Book a table"'); expect(registry.docs()).toContain('Only the missing details');
});

test('bound prefill updates until edited, undo restores edits, and false is a valid required answer', async () => {
  const store = createStore({ initial: { guests: 4 } }), input = { id: 'bound', fields: [{ id: 'n', label: 'Guests', type: 'number', value: { $ref: 'guests' } }, { id: 'consent', label: 'Updates', type: 'toggle', required: true, value: false }] };
  const view = render(<Prism source={source(input)} registry={registry} store={store} onAction={() => {}} />);
  expect((view.getByRole('spinbutton', { name: /Guests/ }) as HTMLInputElement).value).toBe('4');
  act(() => store.set('guests', 6)); await waitFor(() => expect((view.getByRole('spinbutton', { name: /Guests/ }) as HTMLInputElement).value).toBe('6'));
  change(view.getByRole('spinbutton', { name: /Guests/ }), '8');
  fireEvent.keyDown(view.getByRole('group'), { key: 'z', ctrlKey: true }); await waitFor(() => expect((view.getByRole('spinbutton', { name: /Guests/ }) as HTMLInputElement).value).toBe('6'));
  fireEvent.click(view.getByRole('button', { name: 'Send' })); expect(view.getByRole('group').dataset.state).toBe('sent');
});

test('sentence blanks are real labelled inputs, stay mounted after send, and can resend', () => {
  const actions: Action[] = [];
  const input = { sentence: 'Plan a kickoff for {team} with {people} people.', fields: [{ id: 'team', label: 'Team', type: 'text', value: 'Fieldnotes', required: true }, { id: 'people', label: 'People', type: 'number', value: 5 }] };
  const view = render(<Prism registry={registry} source={source(input)} onAction={action => actions.push(action)} />);
  const team = view.getByRole('textbox', { name: /Team/ });
  expect(view.container.querySelector('form')?.dataset.layout).toBe('sentence');
  expect(team.getAttribute('aria-description')).toBe('Suggested');
  expect(view.container.textContent).toContain('Plan a kickoff for');
  expect(view.getByRole('button', { name: 'Send' }).classList.contains('prism-pill')).toBe(true);
  expect(view.getByRole('button', { name: 'Undo' }).classList.contains('prism-icon-btn')).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Send' }));
  expect(view.getByRole('textbox', { name: 'Team' })).toBe(team);
  expect(view.getByText('Sent · Fieldnotes, 5')).toBeDefined();
  expect(view.container.querySelector('.prism-check')).toBeTruthy();
  change(team, 'Prism');
  expect(view.getByRole('group').dataset.state).toBe('ready');
  fireEvent.click(view.getByRole('button', { name: 'Send' }));
  expect(actions.length).toBe(2);
  expect(actions[1].payload).toEqual({ values: { team: 'Prism', people: 5 } });
});

test('short fields always compose inline, long fields render below, and invalid templates keep every field', () => {
  const fields = [{ id: 'name', label: 'Name', type: 'text' }, { id: 'zone', label: 'Zone', type: 'select', options: ['East', 'West'] }];
  const view = render(<Prism registry={registry} source={source({ fields })} />);
  expect(view.container.querySelector('form')?.dataset.layout).toBe('sentence');
  expect(view.getByRole('combobox', { name: 'Zone' })).toBeDefined();
  view.rerender(<Prism registry={registry} source={source({ sentence: '{missing}', fields })} />);
  expect(view.getByRole('textbox', { name: 'Name' })).toBeDefined();
  expect(view.getByRole('combobox', { name: 'Zone' })).toBeDefined();
  view.rerender(<Prism registry={registry} source={source({ sentence: '{name}', fields: [...fields, { id: 'notes', label: 'Notes', type: 'textarea' }] })} />);
  expect(view.container.querySelector('form')?.dataset.layout).toBe('sentence');
  expect(view.getByRole('textbox', { name: 'Name' }).closest('[data-part="sentence"]')).toBeTruthy();
  expect(view.getByRole('textbox', { name: 'Notes' }).closest('[data-part="longFields"]')).toBeTruthy();
  expect(registry.docs()).toContain('{fieldId}');
});

test('date and more than four short fields stay inline beside a separately labelled textarea', () => {
  const fields = ['Team', 'People', 'Date', 'Place', 'Timezone'].map((label, index) => ({ id: label, label, type: index === 1 ? 'number' : index === 2 ? 'date' : 'text', required: true }));
  const view = render(<Prism registry={registry} source={source({ fields: [...fields, { id: 'notes', label: 'Notes', type: 'textarea' }] })} />);
  const flow = view.container.querySelector('[data-part="sentence"]')!;
  expect(flow.querySelectorAll('[data-part="field"]')).toHaveLength(5);
  expect(flow.querySelector('input[type="date"]')).toBeTruthy();
  expect(flow.textContent).not.toContain('*');
  expect(flow.textContent).not.toContain(':');
  expect(view.getByRole('textbox', { name: 'Team' }).getAttribute('aria-required')).toBe('true');
  expect(flow.querySelectorAll('[data-part="separator"]')).toHaveLength(4);
  expect(flow.querySelector('[data-part="separator"]')?.textContent).toBe('');
  expect(view.getByRole('textbox', { name: 'Notes' }).closest('[data-part="longFields"]')).toBeTruthy();
});

test('mixed fields keep the same sentence and long-field containers through streaming completion', () => {
  const text = source({ fields: [{ id: 'team', label: 'Team name', type: 'text', placeholder: 'Fieldnotes' }, { id: 'people', label: 'People attending', type: 'number', value: 5 }, { id: 'notes', label: 'Notes', type: 'textarea' }] });
  const view = render(<Prism registry={registry} source="" done={false} />);
  for (let length = 1; length < text.length; length++) view.rerender(<Prism registry={registry} source={text.slice(0, length)} done={false} />);
  view.rerender(<Prism registry={registry} source={text.slice(0, text.lastIndexOf('\n```'))} done={false} />);
  const flow = view.container.querySelector('[data-part="sentence"]'), long = view.container.querySelector('[data-part="longFields"]');
  const team = view.getByRole('textbox', { name: 'Team name' }), notes = long!.querySelector('textarea')!;
  expect(long?.querySelector('[data-part="skeleton"]')).toBeTruthy();
  view.rerender(<Prism registry={registry} source={text} done />);
  expect(view.container.querySelector('[data-part="sentence"]')).toBe(flow);
  expect(view.container.querySelector('[data-part="longFields"]')).toBe(long);
  expect(view.getByRole('textbox', { name: 'Team name' })).toBe(team);
  expect(view.getByRole('textbox', { name: 'Notes' })).toBe(notes);
});

test('sentence streaming renders every prefix safely and keeps control nodes at completion', () => {
  const text = source({ sentence: 'For {name}, with {count} people.', fields: [{ id: 'name', label: 'Name', type: 'text' }, { id: 'count', label: 'Count', type: 'number', value: 5 }] });
  const view = render(<Prism registry={registry} source="" done={false} />);
  for (let length = 1; length < text.length; length++) view.rerender(<Prism registry={registry} source={text.slice(0, length)} done={false} />);
  view.rerender(<Prism registry={registry} source={text} done={false} />);
  const name = view.getByRole('textbox', { name: 'Name' });
  view.rerender(<Prism registry={registry} source={text} />);
  expect(view.getByRole('textbox', { name: 'Name' })).toBe(name);
});

test('agent patches use presentation highlights while local edits do not initiate one', () => {
  const store = createStore({ initial: { count: 4 } });
  const text = source({ id: 'patch', fields: [{ id: 'count', label: 'Count', type: 'number', value: { $ref: 'count' } }] });
  const view = render(<Prism registry={registry} store={store} source={text} animate={false} />);
  expect(view.container.querySelector('[data-prism-flash]')).toBeNull();
  act(() => store.set('count', 6));
  expect(view.getByRole('spinbutton').hasAttribute('data-prism-flash')).toBe(true);
  expect((view.getByRole('spinbutton') as HTMLInputElement).value).toBe('6');
  view.unmount();
  const local = render(<Prism registry={registry} store={createStore()} source={source({ fields: [{ id: 'count', label: 'Count', type: 'number', value: 4 }] })} />);
  change(local.getByRole('spinbutton'), '8');
  expect(local.container.querySelector('[data-prism-flash]')).toBeNull();
});
