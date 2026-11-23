import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, createRegistry } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { tableDef } from '../src/table';
import { calc } from '../src/num';

const registry = createRegistry([tableDef]);
const source = (props: object) => '```ui:table\n' + JSON.stringify(props) + '\n```';
afterEach(cleanup);

test.each(['date', 'datetime'])('fallback sorts mixed-format %s values chronologically with stable ties', type => {
  const props = { columns: [{ key: 'label', label: 'Label' }, { key: 'when', label: 'When', type }], rows: [
    { label: 'Latest', when: '2025-01-01T12:00:00Z' },
    { label: 'Earliest', when: Date.parse('2024-01-01T12:00:00Z') },
    { label: 'Middle', when: '2024-07-01T12:00:00Z' },
    { label: 'Same time', when: Date.parse('2024-07-01T12:00:00Z') },
  ] };
  const view = render(<Prism registry={registry} source={source(props)} locale="de-DE"/>);
  const labels = () => Array.from(view.container.querySelectorAll('tbody tr')).map(row => row.firstElementChild?.textContent);
  fireEvent.click(view.getByRole('button', { name: 'When' }));
  expect(labels()).toEqual(['Earliest', 'Middle', 'Same time', 'Latest']);
  fireEvent.click(view.getByRole('button', { name: 'When' }));
  expect(labels()).toEqual(['Latest', 'Middle', 'Same time', 'Earliest']);
  fireEvent.click(view.getByRole('button', { name: 'When' }));
  expect(labels()).toEqual(['Latest', 'Earliest', 'Middle', 'Same time']);
});

test('fallback formats typed columns and paginates after sorting raw values', () => {
  const props = { id: 'data', columns: [{ key: 'amount', label: 'Amount', type: 'currency' }, { key: 'ratio', label: 'Ratio', type: 'percent' }], rows: [{ amount: 10, ratio: .5 }, { amount: 2, ratio: .25 }, { amount: 1000, ratio: .75 }], pageSize: 1 };
  const view = render(<Prism registry={registry} source={source(props)} locale="de-DE" currency="EUR"/>);
  expect(view.container.querySelector('tbody')?.textContent).toBe('10,00 €50 %');
  expect(view.getByRole('button', { name: 'Previous page' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Next page' }));
  expect(view.container.querySelector('tbody')?.textContent).toBe('2,00 €25 %');
  fireEvent.click(view.getByRole('button', { name: 'Amount' }));
  expect(view.getByText('Page 1 of 3')).toBeDefined();
  expect(view.container.querySelector('tbody')?.textContent).toBe('2,00 €25 %');
  fireEvent.click(view.getByRole('button', { name: 'Next page' }));
  fireEvent.click(view.getByRole('button', { name: 'Next page' }));
  expect(view.container.querySelector('tbody')?.textContent).toBe('1.000,00 €75 %');
  expect(view.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true);
});

test('fallback handles empty rows, invalid formatting data and invalid page sizes', () => {
  const props = { columns: [{ key: 'value', type: 'date' }], rows: [], pageSize: 2 };
  const view = render(<Prism registry={registry} source={source(props)}/>);
  expect(view.container.querySelectorAll('tbody tr')).toHaveLength(0);
  expect(view.getByText('Page 1 of 1')).toBeDefined();
  for (const pageSize of [0, -2, 'bad', null]) {
    view.rerender(<Prism registry={registry} source={source({ ...props, rows: [{ value: 'not-a-date' }, { value: null }], pageSize })}/>);
    expect(view.queryByRole('navigation', { name: 'Table pagination' })).toBeNull();
    expect(view.container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(view.container.querySelector('tbody td')?.textContent).toBe('not-a-date');
  }
});

test('GFM tables retain their full row set and sorting', () => {
  const view = render(<Prism registry={registry} source={'| N |\n| --- |\n| 2 |\n| 1 |\n'}/>);
  expect(view.queryByRole('navigation')).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'N' }));
  expect(Array.from(view.container.querySelectorAll('tbody td')).map(cell => cell.textContent)).toEqual(['1', '2']);
});

test('Markdown sorting compares resolved formulas with literal amounts and follows store edits', () => {
  const store = createStore({ initial: { seats: 12 } });
  const view = render(<Prism registry={createRegistry([tableDef, calc])} store={store} animate={false} source={'| Included | Amount |\n| --- | ---: |\n| Seats | :calc[seats] |\n| Per seat | $18 |\n| Monthly | :calc[seats * 18]{format=currency decimals=0} |'}/>);
  const labels = () => Array.from(view.container.querySelectorAll('tbody tr')).map(row => row.firstElementChild?.textContent);
  fireEvent.click(view.getByRole('button', { name: 'Amount' }));
  expect(labels()).toEqual(['Seats', 'Per seat', 'Monthly']);
  act(() => { store.set('seats', 20); });
  expect(labels()).toEqual(['Per seat', 'Seats', 'Monthly']);
  expect(view.container.querySelector('tbody')?.textContent).toContain('$360');
  fireEvent.click(view.getByRole('button', { name: 'Amount' }));
  expect(labels()).toEqual(['Monthly', 'Seats', 'Per seat']);
  fireEvent.click(view.getByRole('button', { name: 'Amount' }));
  expect(labels()).toEqual(['Seats', 'Per seat', 'Monthly']);
});

test('formula sorting handles explicit expressions, multiplication, stable ties, empty and invalid cells', () => {
  const store = createStore({ initial: { seats: 18 } });
  const view = render(<Prism registry={createRegistry([tableDef, calc])} store={store} animate={false} source={'| Item | Amount |\n| --- | --- |\n| Literal | $18 |\n| Explicit | :calc[ignored]{expr=seats} |\n| Product | **:calc[2*3*4]** |\n| Invalid | :calc[1/0] |\n| Empty | |'}/>);
  fireEvent.click(view.getByRole('button', { name: 'Amount' }));
  const labels = () => Array.from(view.container.querySelectorAll('tbody tr')).map(row => row.firstElementChild?.textContent);
  expect(labels().filter(label => !['Empty', 'Invalid'].includes(label!))).toEqual(['Literal', 'Explicit', 'Product']);
  expect(view.container.querySelectorAll('tbody tr')).toHaveLength(5);
  expect(view.getByRole('math', { name: '—' })).toBeDefined();
  expect(view.getByRole('math', { name: '24' })).toBeDefined();
  act(() => { store.set('seats', 5); });
  expect(labels().filter(label => !['Empty', 'Invalid'].includes(label!))).toEqual(['Explicit', 'Literal', 'Product']);
});
