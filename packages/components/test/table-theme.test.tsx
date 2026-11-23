import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { createElement, forwardRef } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, createRegistry, defineTheme } from '@prism-ui/react';
import { tableDef, type TableModel, type TableSlotProps } from '../src/table';
import { dataTableDefinition } from '../src/datatable';

afterEach(cleanup);
const registry = createRegistry([tableDef]);
const props = { id: 'comparison', columns: [{ key: 'name', label: 'Space' }, { key: 'cost', label: 'Hire', type: 'currency' }], rows: [{ name: 'Aster', cost: 24 }, { name: 'Foundry', cost: 12 }, { name: 'Studio', cost: 18 }], pageSize: 2 };
const source = (value: unknown) => '```ui:table\n' + JSON.stringify(value) + '\n```';
const markdown = '| Space | Hire |\n| --- | ---: |\n| **Aster** | 24 |\n| Foundry | 12 |\n| Studio | 18 |\n';

test('all declared parts are replaceable and model-aware across GFM, fallback, empty, malformed and streaming tables', () => {
  const covered = new Set<string>();
  for (const [value, done] of [[markdown, true], [source(props), true], [source({ columns: [null, 'name'], rows: [null, {}] }), true], [source({ rows: [] }), true], ['```ui:table\n{"columns":["name"],"rows":[', false], [markdown.slice(0, -8), false]] as const) {
    const baseline = render(<Prism registry={registry} source={value} done={done} animate={false} />);
    const observed = new Set(Array.from(baseline.container.querySelectorAll('[data-prism="table"][data-part]')).map(node => node.getAttribute('data-part')!)); cleanup();
    for (const part of observed) {
      expect(tableDef.parts).toContain(part);
      const Marker = forwardRef<any, any>(function Marker({ as = 'div', table, row, column, ...attributes }, ref) {
        expect((table as TableModel).onSort).toBeFunction(); expect(table.strings.tableLabel).toBeDefined();
        if (part === 'row' || part === 'cell') expect(row.type).toBe('tableRow');
        if (['cell','header','sort','sortIcon'].includes(part)) expect(column.key).toBeDefined();
        return createElement(as, { ...attributes, ref, 'data-marker': part });
      });
      const view = render(<Prism registry={registry} source={value} done={done} slots={{ table: { [part]: Marker } }} animate={false} />);
      expect(view.container.querySelector('[data-marker="' + part + '"]')).not.toBeNull(); covered.add(part); cleanup();
    }
  }
  expect([...covered].sort()).toEqual([...tableDef.parts!].sort());
});

test('localized strings, central icons and typed slots preserve sorting and pagination for both render paths', () => {
  const Cell = ({ table, row, column, as = 'td', ...attributes }: TableSlotProps['cell'] & Record<string, any>) => { expect(table.rows).toContain(row); expect(column.key).toBeDefined(); return createElement(as, attributes); };
  const theme = defineTheme({ name: 'translated-table', icons: { 'arrow-up': () => <svg data-sort-override="" /> }, components: { table: { slots: { cell: Cell }, strings: { tableLabel: 'Comparaison', sortBy: 'Trier {column}', sorted: '{column} : {direction}', ascending: 'croissant', descending: 'décroissant', originalOrder: 'Ordre initial', loading: 'Chargement', previousPage: 'Avant', nextPage: 'Après', tablePagination: 'Pages', pageStatus: '{page} / {pages}' } } } });
  for (const value of [markdown, source(props)]) {
    const view = render(<Prism registry={registry} source={value} theme={theme} />);
    expect(view.getByRole('table', { name: 'Comparaison' })).toBeDefined(); expect(view.getAllByRole('status').find(node => !node.hasAttribute('data-prism-announcer'))!.textContent).toBe('Ordre initial');
    fireEvent.keyDown(view.getByRole('button', { name: 'Trier Hire' }), { key: 'Enter' });
    expect(view.getByRole('button', { name: 'Trier Hire' }).closest('th')?.getAttribute('aria-sort')).toBe('ascending');
    expect(view.getAllByRole('status').find(node => !node.hasAttribute('data-prism-announcer'))!.textContent).toBe('Hire : croissant'); expect(view.container.querySelector('[data-sort-override]')).not.toBeNull();
    expect(view.container.querySelector('tbody tr')?.textContent).toContain('Foundry');
    if (value !== markdown) { expect(view.getByRole('navigation', { name: 'Pages' })).toBeDefined(); fireEvent.click(view.getByRole('button', { name: 'Après' })); expect(view.getByText('2 / 2')).toBeDefined(); expect(view.container.querySelector('tbody')?.textContent).toContain('Aster'); }
    fireEvent.click(view.getByRole('button', { name: 'Trier Hire' })); expect(view.getAllByRole('status').find(node => !node.hasAttribute('data-prism-announcer'))!.textContent).toBe('Hire : décroissant');
    fireEvent.click(view.getByRole('button', { name: 'Trier Hire' })); expect(view.getAllByRole('status').find(node => !node.hasAttribute('data-prism-announcer'))!.textContent).toBe('Ordre initial'); cleanup();
  }
});

test('streaming, empty, definition/prop precedence and dataTable delegation remain accessible', () => {
  const custom = createRegistry([{ ...tableDef, strings: { ...tableDef.strings, tableLabel: 'Definition' } }]);
  const view = render(<Prism registry={custom} source={source({ rows: [] })} />); expect(view.getByRole('table', { name: 'Definition' })).toBeDefined();
  view.rerender(<Prism registry={custom} source={source({ ...props, label: 'Prop' })} />); expect(view.getByRole('table', { name: 'Prop' })).toBeDefined();
  view.rerender(<Prism registry={custom} theme={defineTheme({ name: 'label', components: { table: { strings: { label: 'Theme' } } } })} source={source({ ...props, label: 'Prop' })} />); expect(view.getByRole('table', { name: 'Theme' })).toBeDefined();
  view.rerender(<Prism registry={registry} source={markdown.slice(0, -8)} done={false} />);
  expect(view.getByRole('table').getAttribute('aria-busy')).toBe('true'); expect(view.getAllByRole('status').find(node => !node.hasAttribute('data-prism-announcer'))!.textContent).toBe('Loading rows.');
  for (const button of Array.from(view.container.querySelectorAll('thead button'))) expect((button as HTMLButtonElement).disabled).toBe(true);
  view.rerender(<Prism registry={createRegistry([tableDef, dataTableDefinition])} source={source(props)} />); expect(view.container.querySelector('[data-prism="datatable"]')).not.toBeNull();
});
