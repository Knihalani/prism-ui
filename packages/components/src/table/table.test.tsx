import '../../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, createRegistry, defaultRegistry, type PrismComponentProps } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { tableDef } from './index';

afterEach(cleanup);

test('markdown table preserves component and registry node overrides while sorting rows', () => {
  function Row({ children }: { children?: React.ReactNode }) { return <tr data-override="row">{children}</tr>; }
  function Header({ children }: { children?: React.ReactNode }) { return <th data-override="header">{children}</th>; }
  function Cell({ children }: { children?: React.ReactNode }) { return <td data-override="cell">{children}</td>; }
  function Ignored({ children }: { children?: React.ReactNode }) { return <td data-ignored="yes">{children}</td>; }
  const components = { tableRow: Row, tableHeader: Header, tableCell: Cell };
  const view = render(<Prism scope="test" source="" />);
  for (const mode of ['components', 'registry', 'precedence'] as const) {
    const store = createStore();
    const registry = createRegistry([tableDef, ...Object.entries(components).map(([name, component]) => ({ name, component: mode === 'precedence' ? Ignored : component }))]);
    view.rerender(<Prism scope="test" source={source} store={store} registry={mode === 'components' ? createRegistry([tableDef]) : registry} components={mode === 'registry' ? {} : components} />);
    expect(view.container.querySelectorAll('tr[data-override="row"]').length).toBe(4);
    expect(view.container.querySelectorAll('th[data-override="header"]').length).toBe(4);
    expect(view.container.querySelectorAll('td[data-override="cell"]').length).toBe(12);
    expect(view.container.querySelector('[data-ignored]')).toBeNull();
    const firstRow = view.container.querySelector('tbody tr');
    expect(order(view)).toEqual(['Team 10', 'Team 2', 'Team 1']);
    act(() => store.set('test:table:0.sort', { column: 1, dir: 'asc' }));
    expect(order(view)).toEqual(['Team 2', 'Team 1', 'Team 10']);
    expect(view.container.querySelector('tbody tr:last-child')).toBe(firstRow);
    act(() => store.set('test:table:0.sort', { column: 1, dir: 'desc' }));
    expect(order(view)).toEqual(['Team 10', 'Team 1', 'Team 2']);
    act(() => store.set('test:table:0.sort', null));
    expect(order(view)).toEqual(['Team 10', 'Team 2', 'Team 1']);
  }
});
const source = '| Plan | Price | Change | Date |\n| --- | --- | :---: | --- |\n| **Team 10** | $1,200 | 5% | 2025-02-01 |\n| Team 2 | $20 | 10% | 2024-12-01 |\n| Team 1 | $100 | 2% | 2025-01-01 |';
function order(view: ReturnType<typeof render>, column = 0) { return Array.from(view.container.querySelectorAll('tbody tr')).map(row => row.children[column].textContent); }

test('markdown table renders semantic parts, rich cells, inferred numeric and explicit alignment', () => {
  const view = render(<Prism source={source} />);
  expect(view.getByRole('region', { name: 'Table' }).tabIndex).toBe(0);
  expect(view.getByRole('table').querySelector('thead')?.children.length).toBe(1);
  expect(view.getByRole('table').querySelector('tbody')?.children.length).toBe(3);
  expect(view.container.querySelector('strong')?.textContent).toBe('Team 10');
  const headers = view.getAllByRole('columnheader');
  expect(headers[1].getAttribute('data-align')).toBe('right'); expect(headers[2].getAttribute('data-align')).toBe('center');
  expect(headers[0].getAttribute('aria-sort')).toBe('none');
  view.container.querySelectorAll('[data-prism="table"]').forEach(part => expect(part.classList.contains('prism-table__' + part.getAttribute('data-part'))).toBe(true));
  const root = view.container.querySelector('[data-part="root"][data-prism="table"]')!;
  expect(root.getAttribute('data-state')).toBe('ready'); expect(root.hasAttribute('data-entering')).toBe(true);
  expect(defaultRegistry.docs()).toContain('### table');
});

test('sort cycles ascending, descending and original, with exact aria-sort and stored state', () => {
  const store = createStore(), view = render(<Prism scope="test" source={source} store={store} />);
  const price = view.getByRole('button', { name: 'Price' }), header = view.getAllByRole('columnheader')[1];
  fireEvent.click(price);
  expect(order(view)).toEqual(['Team 2', 'Team 1', 'Team 10']); expect(header.getAttribute('aria-sort')).toBe('ascending');
  expect(store.get('test:table:0.sort')).toEqual({ column: 1, dir: 'asc' });
  fireEvent.click(price); expect(order(view)).toEqual(['Team 10', 'Team 1', 'Team 2']); expect(header.getAttribute('aria-sort')).toBe('descending');
  fireEvent.click(price); expect(order(view)).toEqual(['Team 10', 'Team 2', 'Team 1']); expect(header.getAttribute('aria-sort')).toBe('none');
  expect(store.get('test:table:0.sort')).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Plan' }));
  expect(order(view)).toEqual(['Team 1', 'Team 2', 'Team 10']);
});

test('sort buttons activate with Enter and Space and ignore keyboard repeat', () => {
  const view = render(<Prism source={source} />);
  const button = view.getByRole('button', { name: 'Change' });
  act(() => button.focus()); expect(document.activeElement).toBe(button); expect(button.tabIndex).toBe(0);
  fireEvent.keyDown(button, { key: 'Enter' }); expect(order(view)).toEqual(['Team 1', 'Team 10', 'Team 2']);
  fireEvent.keyDown(button, { key: ' ', repeat: true }); expect(order(view)).toEqual(['Team 1', 'Team 10', 'Team 2']);
  fireEvent.keyDown(button, { key: ' ' }); expect(order(view)).toEqual(['Team 2', 'Team 10', 'Team 1']);
  fireEvent.keyDown(button, { key: 'Enter' }); expect(order(view)).toEqual(['Team 10', 'Team 2', 'Team 1']);
  fireEvent.click(view.getByRole('button', { name: 'Date' })); expect(order(view)).toEqual(['Team 2', 'Team 1', 'Team 10']);
});

test('streaming retains header and arriving rows while sorting is disabled, then enables sorting', () => {
  const header = '| Item | Amount |\n| --- | ---: |\n', row = '| A | 20 |\n', view = render(<Prism source={header} done={false} />);
  expect(view.getAllByRole('columnheader').length).toBe(2); expect(view.getAllByRole('button').every(button => (button as HTMLButtonElement).disabled)).toBe(true);
  expect(view.container.querySelector('[data-prism="table"]')?.getAttribute('data-state')).toBe('streaming');
  view.rerender(<Prism source={header + row} done={false} />);
  expect(order(view)).toEqual(['A']);
  fireEvent.click(view.getByRole('button', { name: 'Amount' })); expect(order(view)).toEqual(['A']);
  view.rerender(<Prism source={header + row + '| B | 10 |\n'} done={false} />);
  expect(order(view)).toEqual(['A', 'B']);
  view.rerender(<Prism source={header + row + '| B | 10 |\n'} done />);
  expect(view.container.querySelector('[data-prism="table"]')?.getAttribute('data-state')).toBe('ready');
  expect((view.getByRole('button', { name: 'Amount' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(view.getByRole('button', { name: 'Amount' })); expect(order(view)).toEqual(['B', 'A']);
});

test('component fences have a basic sortable fallback with optional columns/rows', () => {
  const registry = createRegistry([tableDef]);
  const input = '```ui:table\n{"id":"fallback","label":"Plans","columns":[{"key":"name","label":"Name"},{"key":"cost","label":"Cost"}],"rows":[{"name":"A","cost":20},{"name":"B","cost":5}]}\n```';
  const view = render(<Prism source={input} registry={registry} />);
  expect(view.getByRole('region', { name: 'Plans' })).toBeDefined();
  expect(order(view)).toEqual(['A', 'B']); fireEvent.click(view.getByRole('button', { name: 'Cost' })); expect(order(view)).toEqual(['B', 'A']);
  view.rerender(<Prism source={'```ui:table\n{}\n```'} registry={registry} />);
  expect(view.getByRole('table')).toBeDefined(); expect(order(view)).toEqual([]);
  view.rerender(<Prism source={'```ui:table\n{"columns":"invalid","rows":[null]}\n```'} registry={registry} />);
  expect(view.getByRole('table')).toBeDefined();
});

test('component-node dispatch delegates all props unchanged but never delegates markdown', () => {
  let received: PrismComponentProps | undefined;
  function Delegate(input: PrismComponentProps) { received = input; return <div>Delegated</div>; }
  const registry = createRegistry([tableDef, { name: 'dataTable', component: Delegate }]);
  const props = { id: 'demo', columns: [{ key: 'x' }], rows: [{ x: 1 }], pageSize: 10, custom: 'preserved' };
  const view = render(<Prism source={'```ui:table\n' + JSON.stringify(props) + '\n```'} registry={registry} />);
  expect(view.getByText('Delegated')).toBeDefined(); expect(received?.props).toEqual(props); expect(received?.node.type).toBe('component');
  view.rerender(<Prism source={source} registry={registry} />);
  expect(view.queryByText('Delegated')).toBeNull(); expect(view.getByRole('table')).toBeDefined();
});

test('empty/mixed cells do not break numeric detection, stable sorting or invalid agent sort state', () => {
  const store = createStore(), view = render(<Prism scope="test" source={'| Name | Value |\n| --- | --- |\n| A | 2 |\n| B | 2 |\n| C | note |\n| D | |'} store={store} />);
  expect(view.getAllByRole('columnheader')[1].getAttribute('data-align')).toBe('left');
  fireEvent.click(view.getByRole('button', { name: 'Value' })); expect(order(view)).toEqual(['D', 'A', 'B', 'C']);
  act(() => store.set('test:table:0.sort', { column: 100, dir: 'asc' })); expect(order(view)).toEqual(['A', 'B', 'C', 'D']);
});

test('unstyled mode, slots and horizontal overflow state are supported', () => {
  function Cell({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) { return <td {...props} data-custom="yes">{children}</td>; }
  const view = render(<Prism source={source} unstyled animate={false} slots={{ table: { cell: Cell } }} styles={{ table: { root: { color: 'red' } } }} />);
  const root = view.container.querySelector('[data-prism="table"]') as HTMLElement;
  expect(root.style.color).toBe('red'); expect(root.hasAttribute('data-entering')).toBe(false); expect(view.container.querySelector('td')?.getAttribute('data-custom')).toBe('yes');
  view.container.querySelectorAll('[data-prism="table"]').forEach(part => expect(part.className).toBe(''));
  const scroll = view.getByRole('region');
  Object.defineProperties(scroll, { clientWidth: { value: 100 }, scrollWidth: { value: 300 }, scrollLeft: { value: 0, writable: true } });
  fireEvent.scroll(scroll); expect(root.hasAttribute('data-overflow-end')).toBe(true); expect(root.hasAttribute('data-overflow-start')).toBe(false);
  scroll.scrollLeft = 200; fireEvent.scroll(scroll); expect(root.hasAttribute('data-overflow-start')).toBe(true); expect(root.hasAttribute('data-overflow-end')).toBe(false);
});
