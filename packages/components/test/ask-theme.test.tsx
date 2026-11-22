import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { createElement, forwardRef } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, createRegistry, defineTheme, type Action, type Middleware } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { s } from '@prism-ui/schema';
import { askDefinition, type AskModel, type AskSlotProps } from '../src/ask';

afterEach(cleanup);
const registry = createRegistry([askDefinition]);
const fields = [
  { id: 'party', label: 'Party', type: 'number', value: 2, required: true, min: 1, unit: 'people', hint: 'Everyone included' },
  { id: 'date', label: 'Date', type: 'date', value: '2026-12-12' },
  { id: 'name', label: 'Name', type: 'text', value: 'Ada' },
  { id: 'notes', label: 'Notes', type: 'textarea' },
  { id: 'updates', label: 'Updates', type: 'toggle', value: false },
  { id: 'area', label: 'Area', type: 'select', options: ['Front', 'Back'] },
  { id: 'time', label: 'Time', type: 'select', options: ['One', 'Two', 'Three', 'Four', 'Five'] },
];
const source = (value: unknown) => '```ui:ask\n' + JSON.stringify(value) + '\n```\n';
function change(element: HTMLElement, value: string) { act(() => element.focus()); fireEvent.change(element, { target: { value } }); fireEvent.keyUp(element, { key: 'Unidentified' }); }

test('every declared Ask part is replaceable with model data in populated, empty, streaming, error, sentence and sent states', () => {
  const covered = new Set<string>();
  for (const fixture of ['ready', 'sentence', 'error', 'sent', 'empty', 'stream']) {
    function mount(slots = {}) {
      const content = fixture === 'stream' ? '```ui:ask\n{"id":"stream","fields":[{"id":"name","type":"text"' : source({ id: 'theme', fields: fixture === 'empty' ? [] : fields, sentence: fixture === 'sentence' ? 'Book for {party} on {date}. Thank you.' : undefined });
      const view = render(<Prism source={content} registry={registry} animate={false} done={fixture !== 'stream' && fixture !== 'empty'} slots={slots} onAction={() => {}} />);
      if (fixture === 'stream' || fixture === 'empty') { expect(view.getByRole('group').dataset.state).toBe(fixture === 'stream' ? 'streaming' : 'ready'); expect(view.container.querySelector('[data-prism-skeleton]')).not.toBeNull(); }
      if (fixture === 'error') { change(view.getByRole('spinbutton'), '0'); fireEvent.click(view.getByRole('button', { name: 'Send' })); }
      if (fixture === 'sent') fireEvent.click(view.getByRole('button', { name: 'Send' }));
      return view;
    }
    const base = mount(), parts = Array.from(base.container.querySelectorAll('[data-prism="ask"][data-part]')).map(node => ({ name: node.getAttribute('data-part')!, tag: node.tagName.toLowerCase() })); cleanup();
    for (const { name, tag } of parts) {
      expect(askDefinition.parts).toContain(name);
      const Marker = forwardRef<any, any>(function Marker({ as, ask, field, vm, index, ...props }, ref) { expect(ask?.fields).toBeDefined(); return createElement(as ?? tag, { ...props, ref, 'data-marker': name }); });
      const view = mount({ ask: { [name]: Marker } }); expect(view.container.querySelector(`[data-marker="${name}"]`)).not.toBeNull(); covered.add(name); cleanup();
    }
  }
  expect([...covered].sort()).toEqual([...askDefinition.parts!].sort());
});

test('theme strings, typed slots and central icons preserve aria, validation, confirmation, actions and editable receipts', () => {
  let model: AskModel | undefined, fieldModel: AskSlotProps['control'] | undefined;
  const Root = forwardRef<any, any>(function Root({ as, ask, ...props }, ref) { model = ask; return <section {...props} ref={ref} />; });
  const Control = forwardRef<any, any>(function Control({ as, ask, field, vm, index, ...props }, ref) { fieldModel = { ask, field, vm, index }; return createElement(as, { ...props, ref }); });
  const actions: Action[] = [], store = createStore();
  const theme = defineTheme({ name: 'ask-translated', icons: { send: props => <svg {...props} data-custom-send="" /> }, components: { ask: { slots: { root: Root, control: Control }, strings: { title: 'Détails', send: 'Envoyer', edit: 'Modifier', sentLabel: 'Reçu', suggested: 'Proposé', empty: 'Absent', minimum: 'Au moins {min}', undoLabel: 'Annuler', askLabel: 'Question', askMessage: 'Une question', submitMessage: '{title} → {details}', detail: '{label} = {value}', detailSeparator: ' / ', numberUnit: '{value} {unit}' } } } });
  const view = render(<Prism source={source({ id: 'translated', fields: fields.slice(0, 1) })} registry={registry} theme={theme} store={store} animate={false} onAction={action => actions.push(action)} />);
  expect(model?.fields.length).toBe(1); expect(fieldModel?.field.id).toBe('party'); expect(view.getByRole('button', { name: 'Annuler' })).toBeDefined(); expect(view.container.querySelector('[data-custom-send]')).not.toBeNull();
  const control = view.getByRole('spinbutton'); expect(control.closest('[data-part="field"]')?.getAttribute('data-suggested')).toBe('true');
  fireEvent.blur(control); expect(control.closest('[data-part="field"]')?.hasAttribute('data-suggested')).toBe(false);
  change(control, '0'); fireEvent.click(view.getByRole('button', { name: 'Envoyer' })); expect(view.getByRole('alert').textContent).toBe('Au moins 1'); expect(control.getAttribute('aria-invalid')).toBe('true');
  change(control, '3'); fireEvent.keyDown(control, { key: 'Enter' }); expect(actions.at(-1)?.message).toBe('Détails → Party = 3 people'); expect(view.getByRole('group').dataset.state).toBe('sent'); expect(view.getByRole('button', { name: 'Reçu' })).toBeDefined(); expect(view.container.querySelector('[aria-live="polite"]')?.textContent).toContain('3 people');
  fireEvent.click(view.getByRole('button', { name: 'Modifier' })); expect((view.getByRole('spinbutton') as HTMLInputElement).value).toBe('3'); fireEvent.click(view.getByRole('button', { name: 'Envoyer' })); expect(actions.length).toBe(2);
  fireEvent.click(view.getByRole('button', { name: 'Question' })); expect(actions.at(-1)?.message).toBe('Une question');
  expect(view.getByRole('group').hasAttribute('data-prism-flash')).toBe(false);
  act(() => store.set('translated.values', { party: 4 })); expect(view.getByRole('group').hasAttribute('data-prism-flash')).toBe(true); expect(view.getByRole('group').dataset.state).toBe('ready'); expect((view.getByRole('spinbutton') as HTMLInputElement).value).toBe('4');
});

test('resolved fields bindings tolerate nulls, duplicates, missing and malformed arrays and remain reactive', () => {
  const store = createStore(), actions: Action[] = [], permissive = createRegistry([{ ...askDefinition, schema: s.any() }]);
  const view = render(<Prism source={source({ id: 'bound-fields', fields: { $ref: 'questions' } })} store={store} registry={permissive} onAction={action => actions.push(action)} />);
  expect(view.queryByRole('spinbutton')).toBeNull();
  act(() => store.set('questions', [null, fields[0], null, fields[0]])); expect(view.getAllByRole('spinbutton').length).toBe(1);
  fireEvent.click(view.getByRole('button', { name: 'Send' })); expect(actions.at(-1)?.payload).toEqual({ values: { party: 2 } });
  act(() => store.set('questions', [null, { ...fields[0], value: 5 }, { id: 'new', label: 'New', type: 'text' }])); expect(view.getByRole('textbox', { name: 'New' })).toBeDefined();
  act(() => store.set('questions', { unexpected: true })); expect(view.queryByRole('spinbutton')).toBeNull();
  cleanup();
  const normal = render(<Prism source={source({ fields: { $ref: 'questions' } })} store={createStore({ initial: { questions: [null, fields[0]] } })} registry={registry} />); expect(normal.getByRole('spinbutton')).toBeDefined();
});

test.each(['replace', 'mutate'])('receipt and edits reflect cleared, filled and additional answers with %s middleware', mode => {
  const actions: Action[] = [];
  const middleware: Middleware[] = [(action, next) => {
    if (action.type !== 'submit') { next(action); return; }
    const values = { party: null, name: 'Middleware', notes: 'Filled after submit', extra: false };
    if (mode === 'replace') next({ ...action, payload: { values } });
    else { const target = (action.payload as { values: Record<string, unknown> }).values; for (const key of Object.keys(target)) delete target[key]; Object.assign(target, values); next(action); }
  }];
  const view = render(<Prism source={source({ id: 'receipt', fields })} registry={registry} middleware={middleware} onAction={action => actions.push(action)} />);
  fireEvent.click(view.getByRole('button', { name: 'Send' }));
  const rows = Array.from(view.container.querySelectorAll('[data-part="summaryRow"]')).map(row => row.textContent);
  expect(rows).toContain('PartyNot provided'); expect(rows).toContain('NameMiddleware'); expect(rows).toContain('NotesFilled after submit'); expect(rows).toContain('extraNo'); expect(rows.some(row => row === 'Date12 Dec 2026')).toBe(false);
  expect((actions[0].payload as any).values.party).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Edit' })); expect((view.getByRole('spinbutton') as HTMLInputElement).value).toBe(''); expect((view.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('Middleware');
});

test('theme strings win over props and labels in empty-state aria and empty receipt/option text', () => {
  const theme = defineTheme({ name: 'ask-empty-translated', components: { ask: { strings: { title: 'Thème', loading: 'Patientez', select: 'Choisir', empty: 'Aucun', send: 'Valider' } } } });
  const view = render(<Prism source={source({ fields: [] })} registry={registry} done={false} theme={theme} />);
  expect(view.getByRole('status', { name: 'Patientez' })).toBeDefined();
  view.rerender(<Prism source={source({ title: 'Prop', labels: { title: 'Label' }, fields: [{ id: 'choice', label: 'Choix', type: 'select', options: ['A', 'B', 'C', 'D', 'E'] }] })} registry={registry} theme={theme} onAction={() => {}} />);
  expect(view.getByRole('group', { name: 'Thème' })).toBeDefined(); expect(view.getByRole('option', { name: 'Choisir' })).toBeDefined();
  fireEvent.click(view.getByRole('button', { name: 'Valider' })); expect(view.getByText('Aucun')).toBeDefined();
});

test('swallowed and delayed middleware never display an attempted payload as a sent receipt', () => {
  let deliver: (() => void) | undefined;
  const middleware: Middleware[] = [(action, next) => { deliver = () => next({ ...action, payload: { values: { name: null } } }); }];
  const view = render(<Prism source={source({ fields: [{ id: 'name', label: 'Name', type: 'text', value: 'Guess' }] })} registry={registry} middleware={middleware} onAction={() => {}} />);
  fireEvent.click(view.getByRole('button', { name: 'Send' })); expect(view.queryByText('Sent')).toBeNull(); expect(view.getByRole('textbox')).toBeDefined();
  act(() => deliver?.()); expect(view.getByText('Not provided')).toBeDefined(); expect(view.queryByText('Guess')).toBeNull();
});

test('sentence blanks wrap as semantic chunks, preserve native ISO dates and leave long fields below; invalid templates fall back', () => {
  const view = render(<Prism source={source({ sentence: 'Book for {party} on {date}.', fields })} registry={registry} />);
  expect(view.container.querySelectorAll('[data-part="sentence-chunk"]').length).toBe(2); const date = view.getByLabelText(/Date/) as HTMLInputElement; expect(date.type).toBe('date'); expect(date.value).toBe('2026-12-12'); expect(view.getByRole('textbox', { name: 'Notes' }).closest('[data-part="sentence"]')).toBeNull();
  for (const sentence of ['Missing {unknown}.', 'Repeat {party} and {party}.', 'Long {notes}.', 'No blanks']) { view.rerender(<Prism source={source({ sentence, fields })} registry={registry} />); expect(view.container.querySelector('[data-part="sentence"]')).toBeNull(); expect(view.getByRole('spinbutton')).toBeDefined(); }
  expect(registry.docs()).toContain('sentence'); expect(registry.docs()).toContain('{fieldId}');
});
