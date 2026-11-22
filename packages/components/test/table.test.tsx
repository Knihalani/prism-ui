import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, createRegistry } from '@prism-ui/react';
import { tableDef } from '../src/table';

const registry = createRegistry([tableDef]);
const source = (props: object) => '```ui:table\n' + JSON.stringify(props) + '\n```';
afterEach(cleanup);

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
