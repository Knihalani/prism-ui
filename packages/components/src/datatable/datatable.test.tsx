import './setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { Prism, createRegistry, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { DataTable, dataTableDefinition, type DataTableProps } from './index';
import { tableDef, TableDispatcher } from '../table';

afterEach(cleanup);
const registry = createRegistry([tableDef, dataTableDefinition]);
const source = (props: DataTableProps) => '```ui:table\n' + JSON.stringify(props) + '\n```';
const rows = [{ name: 'Zoe', amount: 20 }, { name: 'Ada', amount: 3 }, { name: 'Ben', amount: 12 }];
const columns = [{ key: 'name', label: 'Name' }, { key: 'amount', label: 'Amount', type: 'number' as const }];
const bodyRows = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>('tr[data-index]'));
const order = (container: HTMLElement) => bodyRows(container).map(row => row.getAttribute('data-index'));

test('ui table renders schema-defined and inferred columns, with prompt docs', () => {
  const view = render(<Prism registry={registry} source={source({ columns, rows, caption: 'People' })} />);
  expect(view.getByRole('table').getAttribute('aria-label')).toBe('People');
  expect(view.getByRole('columnheader', { name: /Amount/ })).toBeTruthy();
  expect(bodyRows(view.container).length).toBe(3);
  view.rerender(<Prism registry={registry} source={source({ rows })} />);
  expect(view.getByRole('button', { name: 'Sort by name' })).toBeTruthy();
  expect(view.container.querySelector('td[data-align="right"]')?.textContent).toBe('20');
  expect(registry.docs()).toContain('zero-based');
  expect(registry.docs()).toContain('```ui:table');
});

test('main dispatcher owns table and preserves markdown while ui:table delegates to DataTable', () => {
  expect(dataTableDefinition.name).toBe('dataTable');
  expect(registry.get('table')?.component).toBe(TableDispatcher);
  expect(registry.get('dataTable')?.component).toBe(DataTable);
  const view = render(<Prism registry={registry} locale="en-US" source={'| Name | Total | Date | Count |\n| --- | ---: | --- | --- |\n| **Zoe** | $20.00 | 2025-02-01 | 12 |\n| [Ada](https://example.com) | $3.00 | 2024-01-01 | 2 |'} />);
  expect(view.container.querySelector('strong')?.textContent).toBe('Zoe');
  expect(view.getByRole('link', { name: 'Ada' }).getAttribute('href')).toBe('https://example.com');
  expect(view.getByText('$20.00')).toBeTruthy();
  expect(view.container.querySelector('[data-prism="table"]')).toBeTruthy();
  expect(view.container.querySelector('[data-prism="datatable"]')).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Total' }));
  expect(view.container.querySelector('tbody tr td')?.textContent).toBe('Ada');
  view.rerender(<Prism registry={registry} source={source({ columns, rows, pageSize: 2 })} />);
  expect(view.container.querySelector('[data-prism="datatable"]')).toBeTruthy();
  expect(view.container.querySelector('[data-prism="table"]')).toBeNull();
  expect(bodyRows(view.container).length).toBe(2);
  expect(view.getByText('1–2 of 3')).toBeTruthy();
});

test('streaming known columns immediately render stable headers and skeletons, then append rows unsorted', () => {
  let text = '```ui:table\n{"columns":[{"key":"name","label":"Name"}],"rows":[';
  const view = render(<Prism registry={registry} source={text} done={false} />);
  const header = view.getByRole('columnheader', { name: /Name/ });
  expect(view.container.querySelectorAll('[data-part="skeleton"]').length).toBe(3);
  expect(view.container.querySelectorAll('[data-prism-skeleton-line]').length).toBe(3);
  expect((view.getByRole('button', { name: 'Sort by Name' }) as HTMLButtonElement).disabled).toBe(true);
  expect((view.getByRole('searchbox') as HTMLInputElement).disabled).toBe(true);
  text += '{"name":"Zoe"}';
  view.rerender(<Prism registry={registry} source={text} done={false} />);
  expect(bodyRows(view.container).length).toBe(1);
  expect(view.getByRole('columnheader', { name: /Name/ })).toBe(header);
  text += ',{"name":"Ada"}';
  view.rerender(<Prism registry={registry} source={text} done={false} />);
  expect(order(view.container)).toEqual(['0', '1']);
  expect(view.container.querySelectorAll('[data-part="skeleton"]').length).toBe(1);
  text += ']}\n```';
  view.rerender(<Prism registry={registry} source={text} />);
  expect((view.getByRole('button', { name: 'Sort by Name' }) as HTMLButtonElement).disabled).toBe(false);
  expect(view.container.querySelector('[data-prism="datatable"][data-part="root"]')?.getAttribute('data-state')).toBe('ready');
});

test('sort cycles asc desc none, fuzzy filter resets pagination and clear recovers empty state', () => {
  const view = render(<Prism registry={registry} source={source({ columns, rows, pageSize: 2 })} />);
  const amount = view.getByRole('button', { name: 'Sort by Amount' });
  fireEvent.click(amount); expect(order(view.container)).toEqual(['1', '2']);
  expect(amount.closest('th')?.getAttribute('aria-sort')).toBe('ascending');
  fireEvent.click(amount); expect(order(view.container)).toEqual(['0', '2']);
  expect(amount.closest('th')?.getAttribute('aria-sort')).toBe('descending');
  fireEvent.click(amount); expect(order(view.container)).toEqual(['0', '1']);
  expect(amount.closest('th')?.getAttribute('aria-sort')).toBe('none');
  expect(view.getByText('1–2 of 3')).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'Next page' }));
  expect(view.getByText('3–3 of 3')).toBeTruthy(); expect(order(view.container)).toEqual(['2']);
  fireEvent.input(view.getByRole('searchbox'), { target: { value: 'ad' } });
  expect(order(view.container)).toEqual(['1']); expect(view.getByText('1–1 of 1')).toBeTruthy();
  expect(view.getAllByRole('status').find(node => !node.hasAttribute('data-prism-announcer'))!.textContent).toContain('1 rows matching ad');
  fireEvent.input(view.getByRole('searchbox'), { target: { value: 'unmatched' } });
  expect(view.getByText('No rows match “unmatched”')).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'Clear filter' }));
  expect(order(view.container)).toEqual(['0', '1']);
});

test('selection persists across pages and submits exact original rows and indices in input order', () => {
  const actions: Action[] = [];
  const view = render(<Prism scope="test" registry={registry} source={source({ columns, rows, pageSize: 2, selectable: true })} onAction={action => actions.push(action)} />);
  fireEvent.click(view.getByRole('button', { name: 'Sort by Amount' }));
  fireEvent.click(view.getByRole('checkbox', { name: 'Select all rows on page' }));
  fireEvent.click(view.getByRole('button', { name: 'Next page' }));
  fireEvent.click(view.getByRole('checkbox', { name: 'Select row 1' }));
  fireEvent.click(view.getByRole('button', { name: 'Use 3 selected' }));
  expect(actions.length).toBe(1);
  expect({ type: actions[0].type, component: actions[0].component, id: actions[0].id, payload: actions[0].payload }).toEqual({
    type: 'select', component: 'table', id: 'test:table:0', payload: { rows, indices: [0, 1, 2] },
  });
  const root = view.container.querySelector('[data-prism="datatable"][data-part="root"]');
  expect(root?.getAttribute('data-state')).toBe('sent');
  expect(view.getByRole('button', { name: 'Sent · 3' })).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'Previous page' }));
  fireEvent.click(view.getByRole('checkbox', { name: 'Select all rows on page' }));
  expect(view.getByRole('button', { name: 'Use 1 selected' })).toBeTruthy();
  expect(root?.getAttribute('data-state')).toBe('ready');
});

test('an externally patched table cell shows a static flash when animation is disabled', () => {
  const store = createStore();
  store.set('total', 20);
  const text = source({ columns, rows: [{ name: 'Zoe', amount: { $ref: 'total' } }] });
  const view = render(<Prism registry={registry} source={text} store={store} animate={false} />);
  expect(view.getByText('20').hasAttribute('data-prism-flash')).toBe(false);
  act(() => store.set('total', 40));
  expect(view.getByText('40').hasAttribute('data-prism-flash')).toBe(true);
  expect(view.container.querySelector('[data-entering]')).toBeNull();
});

test('linked numeric cells stay readable when a store update supplies an object', () => {
  const store = createStore();
  store.set('total', 20);
  const text = source({ columns, rows: [{ name: 'Zoe', amount: { $ref: 'total' } }] });
  const view = render(<Prism registry={registry} source={text} store={store} />);
  const cell = view.getByText('20').closest('td');
  act(() => store.set('total', { toString: 'label', amount: 40 }));
  expect(cell?.textContent).toBe('');
  expect(view.getByText('Zoe')).toBeTruthy();
  act(() => store.set('total', 40));
  expect(cell?.textContent).toBe('40');
});

test('single selection, keyboard row arrows and Space, Enter sort, undo and persistent store state', () => {
  const store = createStore();
  const text = source({ id: 'people', columns, rows, select: 'single', pageSize: 2 });
  const view = render(<Prism registry={registry} source={text} store={store} />);
  let rendered = bodyRows(view.container);
  act(() => rendered[0].focus());
  fireEvent.keyDown(rendered[0], { key: 'ArrowDown' });
  expect(document.activeElement).toBe(rendered[1]);
  fireEvent.keyDown(rendered[1], { key: ' ' });
  expect((view.getByRole('checkbox', { name: 'Select row 2' }) as HTMLInputElement).checked).toBe(true);
  fireEvent.keyDown(rendered[1], { key: 'ArrowUp' });
  fireEvent.keyDown(rendered[0], { key: ' ' });
  expect((view.getByRole('checkbox', { name: 'Select row 2' }) as HTMLInputElement).checked).toBe(false);
  fireEvent.click(view.getByRole('button', { name: 'Undo table change' }));
  expect((view.getByRole('checkbox', { name: 'Select row 2' }) as HTMLInputElement).checked).toBe(true);
  fireEvent.keyDown(view.getByRole('button', { name: 'Sort by Amount' }), { key: 'Enter' });
  expect(order(view.container)).toEqual(['1', '2']);
  expect(store.get('people.sort')).toEqual({ key: 'amount', direction: 'asc' });
  view.unmount();
  const again = render(<Prism registry={registry} source={text} store={store} />);
  expect(order(again.container)).toEqual(['1', '2']);
  expect((again.getByRole('checkbox', { name: 'Select row 2' }) as HTMLInputElement).checked).toBe(true);
});

test('large unpaginated tables window fixed-height rows and scroll to new windows', () => {
  const many = Array.from({ length: 500 }, (_, index) => ({ name: `Item ${index}`, amount: index }));
  const view = render(<Prism registry={registry} source={source({ rows: many, height: 200 })} />);
  expect(view.getByRole('table').getAttribute('aria-rowcount')).toBe('501');
  expect(bodyRows(view.container).length).toBeLessThan(25);
  expect(order(view.container)[0]).toBe('0');
  const scroll = view.container.querySelector<HTMLElement>('[data-part="scroll"]')!;
  scroll.scrollTop = 8000; fireEvent.scroll(scroll);
  expect(order(view.container)[0]).toBe('148');
  expect(bodyRows(view.container)[0].getAttribute('aria-rowindex')).toBe('150');
  expect(bodyRows(view.container).length).toBeLessThan(25);
  expect(scroll.querySelector('tr[aria-hidden="true"] td')?.getAttribute('style')).toContain('7696px');
  view.rerender(<Prism registry={registry} source={source({ rows: many, pageSize: 10 })} />);
  expect(bodyRows(view.container).length).toBe(10);
  expect(view.getByRole('table').getAttribute('aria-rowcount')).toBeNull();
});

test('paginated tables do not constrain the page height unless height is explicit', () => {
  const view = render(<Prism registry={registry} source={source({ columns, rows, pageSize: 8 })} />);
  expect((view.container.querySelector('[data-part="scroll"]') as HTMLElement).style.maxHeight).toBe('');
  view.rerender(<Prism registry={registry} source={source({ columns, rows, pageSize: 8, height: 160 })} />);
  expect((view.container.querySelector('[data-part="scroll"]') as HTMLElement).style.maxHeight).toBe('160px');
});

test('currency and number columns share right alignment in headers and cells', () => {
  const view = render(<Prism registry={registry} source={source({ columns: [{ key: 'revenue', type: 'currency' }, { key: 'customers', type: 'number' }], rows: [{ revenue: 1200, customers: 20 }] })} />);
  expect(Array.from(view.container.querySelectorAll('th, td')).map(cell => cell.getAttribute('data-align'))).toEqual(['right', 'right', 'right', 'right']);
});

test('streaming pagination caps page one and reserves missing rows', () => {
  let text = '```ui:table\n{"pageSize":8,"columns":[{"key":"name"}],"rows":[';
  const view = render(<Prism registry={registry} source={text} done={false} />);
  expect(view.container.querySelectorAll('[data-part="skeleton"]').length).toBe(8);
  const many = Array.from({ length: 40 }, (_, index) => ({ name: `Row ${index}` }));
  text += many.map(row => JSON.stringify(row)).join(',');
  view.rerender(<Prism registry={registry} source={text} done={false} />);
  expect(bodyRows(view.container).length).toBe(8);
  expect(view.getByText('40 rows')).toBeTruthy();
  expect(view.getByText('1–8 of 40')).toBeTruthy();
  const header = view.container.querySelector('thead');
  view.rerender(<Prism registry={registry} source={text + ']}\n```'} />);
  expect(bodyRows(view.container).length).toBe(8);
  expect(view.container.querySelector('thead')).toBe(header);
});

test('pagination metadata arriving after rows cannot expose the whole streaming table', () => {
  const rows = Array.from({ length: 40 }, (_, index) => ({ name: `Row ${index}` }));
  const prefix = '```ui:table\n' + JSON.stringify({ rows }).slice(0, -1);
  const view = render(<Prism registry={registry} source={prefix} done={false} />);
  expect(bodyRows(view.container).length).toBe(8);
  expect(view.getByText('1–8 of 40')).toBeTruthy();
  view.rerender(<Prism registry={registry} source={prefix + ',"pageSize":8}\n```'} />);
  expect(bodyRows(view.container).length).toBe(8);
});

test('empty completed pages reuse the reserved page height without an additional spacer', () => {
  const view = render(<Prism registry={registry} source={source({ columns, rows: [], pageSize: 8 })} />);
  const empty = view.container.querySelector('[data-part="empty"]')!;
  expect((empty.parentElement as HTMLElement).style.height).toBe('416px');
  expect(view.container.querySelectorAll('tbody tr').length).toBe(1);
});

test('Intl formatting uses Prism locale/currency and per-column formats, invalid values stay readable', () => {
  const view = render(<Prism registry={registry} locale="de-DE" currency="EUR" source={source({ rows: [{ cost: 1234.5, rate: .25, when: '2025-01-02', invalid: 'not a date', text: '<script>' }], columns: [
    { key: 'cost', type: 'currency' }, { key: 'rate', type: 'number', format: 'percent' }, { key: 'when', type: 'date' }, { key: 'invalid', type: 'date' }, { key: 'text' },
  ] })} />);
  const cells = within(bodyRows(view.container)[0]).getAllByRole('cell');
  expect(cells[0].textContent).toBe(new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(1234.5));
  expect(cells[1].textContent).toBe('25 %');
  expect(cells[2].textContent).toBe(new Intl.DateTimeFormat('de-DE').format(new Date('2025-01-02')));
  expect(cells[3].textContent).toBe('not a date');
  expect(view.container.querySelector('script')).toBeNull();
  view.rerender(<Prism registry={registry} locale="en-US" source={source({ rows: [{ value: 10 }], columns: [{ key: 'value', type: 'currency', currency: 'GBP' }] })} />);
  expect(view.getByText('£10.00')).toBeTruthy();
});

test('empty/error-like partial data and unstyled parts/slots remain usable', () => {
  const view = render(<Prism registry={registry} source={source({ columns, rows: [] })} unstyled slots={{ datatable: { empty: props => <div {...props}>Custom empty</div> } }} classNames={{ datatable: { header: 'my-header' } }} styles={{ datatable: { header: { opacity: .5 } } }} />);
  expect(view.getByText('Custom empty')).toBeTruthy();
  expect(view.container.querySelector('[class*="prism-datatable"]')).toBeNull();
  expect(view.container.querySelector('.my-header')?.getAttribute('style')).toContain('0.5');
  const invalid = '```ui:table\n{"columns":[{"key":"name","label":"Name"}],"rows":[null,12,{"name":"Valid"}]}\n```';
  view.rerender(<Prism registry={registry} source={invalid} />);
  expect(bodyRows(view.container).length).toBe(1);
  expect(view.getByText('Valid')).toBeTruthy();
});
