import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { createElement, forwardRef } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, createRegistry, defineTheme, type Action } from '@prism-ui/react';
import { dataTableDefinition, type DataTableModel, type DataTableSlotProps } from '../src/datatable';
import { tableDef } from '../src/table';

afterEach(cleanup);
const registry = createRegistry([tableDef, dataTableDefinition]);
const rows = [{ name: 'Zoe', amount: 20, status: 'Ready' }, { name: 'Ada', amount: 3, status: 'Review' }, { name: 'Ben', amount: 12, status: 'Ready' }];
const columns = [{ key: 'name', label: 'Name' }, { key: 'amount', label: 'Amount', type: 'number' as const, magnitude: true }, { key: 'status', label: 'Status', detail: true, badge: true }];
const base = { id: 'records', title: 'People', subtitle: 'Three choices', caption: 'Comparison', rows, columns, selectable: true, pageSize: 4, actionHint: 'Review before sending' };
const source = (props: unknown, name = 'table') => '```ui:' + name + '\n' + JSON.stringify(props) + '\n```';

test('every declared DataTable part is model-aware and replaceable in populated, empty, filtered, malformed, streamed, virtual and sent states', () => {
  const covered = new Set<string>();
  for (const fixture of ['ready', 'empty', 'filtered', 'malformed', 'stream', 'virtual', 'sent']) {
    const props = fixture === 'virtual' ? { ...base, pageSize: 0, rows: Array.from({ length: 210 }, (_, index) => ({ name: 'Person ' + index, amount: index })) } : { ...base, rows: fixture === 'empty' ? [] : fixture === 'malformed' ? [null, 2] : rows };
    const mount = (slots = {}) => {
      const view = render(<Prism registry={registry} source={fixture === 'stream' ? '```ui:table\n{"columns":[{"key":"name"}],"rows":[' : source(props)} done={fixture !== 'stream'} animate={false} slots={slots} onAction={() => {}} />);
      if (fixture === 'filtered') fireEvent.input(view.getByRole('searchbox'), { target: { value: 'missing' } });
      if (fixture === 'virtual') { const scroll = view.container.querySelector<HTMLElement>('[data-part="scroll"]')!; scroll.scrollTop = 1000; fireEvent.scroll(scroll); }
      if (fixture === 'sent') { fireEvent.click(view.getByRole('checkbox', { name: 'Select all rows on page' })); fireEvent.click(view.getByRole('button', { name: 'Use 3 selected' })); }
      return view;
    };
    const initial = mount(), observed = Array.from(initial.container.querySelectorAll('[data-prism="datatable"][data-part]')).map(node => node.getAttribute('data-part')!); cleanup();
    for (const part of observed) {
      expect(dataTableDefinition.parts).toContain(part); if (covered.has(part)) continue;
      const Marker = forwardRef<any, any>(function Marker({ as = 'div', table, row, column, entry, ...props }, ref) { expect((table as DataTableModel).strings.sortBy).toBeDefined(); expect(table.changeQuery).toBeFunction(); if (part === 'cell') { expect(row).toBeDefined(); expect(column.key).toBeDefined(); expect(entry.row).toBe(row); } if (part === 'heading') expect(column.key).toBeDefined(); return createElement(as, { ...props, ref, 'data-marker': part }); });
      const view = mount({ datatable: { [part]: Marker } }); expect(view.container.querySelector('[data-marker="' + part + '"]')).not.toBeNull(); covered.add(part); cleanup();
    }
  }
  expect([...covered].sort()).toEqual([...dataTableDefinition.parts!].sort());
});

test('both documented string names override labels/props in direct and delegated tables, with canonical precedence', () => {
  for (const name of ['dataTable', 'table']) for (const themeName of ['dataTable', 'table']) {
    const theme = defineTheme({ name: 'translated-' + name + '-' + themeName, components: { [themeName]: { strings: { title: 'Personnes', sortBy: 'Trier {column}', selectRow: 'Cocher {row}', filterRows: 'Chercher', filterRows2: 'Recherche', rowCount: '{count} lignes', noRowsSelected: 'Aucune sélection', selectedCount: '{count} cochées', useSelected: 'Choisir {count}', sent: 'Envoyé {count}', range: '{start} à {end} sur {count}', emptyRange: 'Vide', noMatches: 'Introuvable {query}', clearFilter: 'Effacer', announcement: '{count} résultats{matching}. {order}', originalOrder: 'Ordre initial.', askMessage: 'Expliquer les lignes', selectMessage: 'Choix de {count} lignes' } } } });
    const actions: Action[] = [], view = render(<Prism registry={registry} source={source({ ...base, caption: undefined, title: 'Prop', labels: { title: 'Label' } }, name)} theme={theme} animate={false} onAction={action => actions.push(action)} />);
    expect(view.getByRole('region', { name: 'Personnes' })).toBeDefined(); expect(view.getByRole('button', { name: 'Trier Name' })).toBeDefined(); expect(view.getByText('1 à 3 sur 3')).toBeDefined();
    fireEvent.click(view.getByRole('checkbox', { name: 'Cocher 1' })); expect(view.getByText('1 cochées')).toBeDefined(); fireEvent.click(view.getByRole('button', { name: 'Choisir 1' })); expect(view.getByText('Envoyé 1')).toBeDefined(); expect(actions[0].message).toBe('Choix de 1 lignes');
    fireEvent.click(view.getByRole('button', { name: 'Ask about this table' })); expect(actions.at(-1)?.message).toBe('Expliquer les lignes');
    fireEvent.input(view.getByRole('searchbox', { name: 'Chercher' }), { target: { value: 'absent' } }); expect(view.getByText('Introuvable absent')).toBeDefined(); fireEvent.click(view.getByRole('button', { name: 'Effacer' })); expect(view.getByRole('status').textContent).toContain('Ordre initial.'); cleanup();
  }
  const theme = defineTheme({ name: 'canonical-wins', components: { table: { strings: { title: 'Alias' } }, dataTable: { strings: { title: 'Canonical' } } } });
  const view = render(<Prism registry={registry} source={source({ rows })} theme={theme} />); expect(view.getByRole('region', { name: 'Canonical' })).toBeDefined();
});

test('themed icons and typed cell slots preserve sort, page, select, receipt and editing behaviour', () => {
  const cells: DataTableSlotProps['cell'][] = [], actions: Action[] = [];
  const theme = defineTheme({ name: 'table-behaviour', icons: { 'arrow-up': props => <svg {...props} data-sort-icon="" /> }, components: { datatable: { slots: { cell: forwardRef<any, any>(function Cell({ as, table, row, column, entry, ...props }, ref) { cells.push({ table, row, column, entry }); return <td {...props} ref={ref} />; }) } } } });
  const view = render(<Prism registry={registry} source={source({ ...base, pageSize: 2 })} theme={theme} animate={false} onAction={action => actions.push(action)} />);
  fireEvent.keyDown(view.getByRole('button', { name: 'Sort by Amount' }), { key: 'Enter' }); expect(view.container.querySelector('[data-sort-icon]')).not.toBeNull(); expect(view.container.querySelector('tbody tr[data-index]')?.getAttribute('data-index')).toBe('1'); expect(cells[0].row.name).toBe('Zoe');
  fireEvent.click(view.getByRole('checkbox', { name: 'Select row 2' })); fireEvent.click(view.getByRole('button', { name: 'Use 1 selected' })); expect(actions[0].payload).toEqual({ rows: [rows[1]], indices: [1] }); expect(view.getByText('Sent · 1')).toBeDefined();
  fireEvent.click(view.getByRole('checkbox', { name: 'Select row 3' })); expect(view.getByText('Use 2 selected')).toBeDefined(); fireEvent.click(view.getByRole('button', { name: 'Next page' })); expect(view.getByText('3–3 of 3')).toBeDefined();
});

test('computed announcements, empty/loading states, pagination, hints and definition/prop precedence are localized', () => {
  const theme = defineTheme({ name: 'all-table-strings', components: { dataTable: { strings: { rowCount: '{count} entrées', announcement: '{count} résultats{matching}. {order}', matching: ' pour {query}', sorted: 'Tri {column} {direction}', ascending: 'croissant', descending: 'décroissant', originalOrder: 'Source', loadingRows: 'Chargement', noRowsYet: 'Aucune entrée', emptyRange: 'Zéro', range: '{start}/{end}/{count}', previousPage: 'Précédent', nextPage: 'Suivant', selectAllRowsOnPage: 'Tout cocher', actionHint: 'Vérifier', showAllColumns: 'Tout voir', showEssentialColumns: 'Réduire', askAboutThisTable: 'Expliquer', undoTableChange: 'Annuler' } } } });
  const view = render(<Prism registry={registry} source={source({ ...base, selectable: false, pageSize: 2 })} theme={theme} animate={false} />);
  expect(view.getByText('3 entrées')).toBeDefined(); expect((view.getByRole('button', { name: 'Précédent' }) as HTMLButtonElement).disabled).toBe(true); fireEvent.click(view.getByRole('button', { name: 'Suivant' })); expect(view.getByText('3/3/3')).toBeDefined();
  const sort = view.getByRole('button', { name: 'Sort by Amount' }); fireEvent.click(sort); expect(view.getByRole('status').textContent).toBe('3 résultats. Tri Amount croissant'); fireEvent.click(sort); expect(view.getByRole('status').textContent).toBe('3 résultats. Tri Amount décroissant');
  fireEvent.input(view.getByRole('searchbox'), { target: { value: 'Ada' } }); expect(view.getByRole('status').textContent).toBe('1 résultats pour Ada. Tri Amount décroissant');
  fireEvent.input(view.getByRole('searchbox'), { target: { value: '' } }); view.rerender(<Prism registry={registry} source={source({ ...base, rows: [], selectable: true })} theme={theme} animate={false} />);
  expect(view.getByText('Aucune entrée')).toBeDefined(); expect(view.getByText('Zéro')).toBeDefined(); expect(view.getByText('Vérifier')).toBeDefined(); expect(view.getByRole('checkbox', { name: 'Tout cocher' })).toBeDefined();
  fireEvent.click(view.getByRole('button', { name: 'Tout voir' })); expect(view.getByRole('button', { name: 'Réduire' })).toBeDefined(); expect(view.getByRole('button', { name: 'Expliquer' })).toBeDefined(); expect(view.getByRole('button', { name: 'Annuler' })).toBeDefined(); cleanup();
  const stream = render(<Prism registry={registry} source={'```ui:table\n{"columns":[{"key":"name"}],"rows":['} done={false} theme={theme} />); expect(stream.getByRole('status').textContent).toContain('Chargement'); cleanup();
  const defaults = render(<Prism registry={registry} source={source({ rows: [] })} />); expect(defaults.getByRole('region', { name: 'Data table' })).toBeDefined(); cleanup();
  const labels = render(<Prism registry={registry} source={source({ title: 'Prop', labels: { title: 'Label' }, rows: [] })} />); expect(labels.getByRole('region', { name: 'Prop' })).toBeDefined();
});

test('delegated definition defaults and streaming detail-column metadata survive delegation', () => {
  const custom = createRegistry([tableDef, { ...dataTableDefinition, strings: { ...dataTableDefinition.strings, noRowsYet: 'Definition empty' } }]);
  const view = render(<Prism registry={custom} source={source({ rows: [] })} />); expect(view.getByText('Definition empty')).toBeDefined();
  view.rerender(<Prism registry={custom} source={'```ui:table\n' + JSON.stringify({ columns, selectable: true, rows: [] }).slice(0, -2)} done={false} />);
  const placeholders = view.container.querySelectorAll('[data-part="placeholder-row"]'); expect(placeholders).toHaveLength(3);
  placeholders.forEach(row => { expect(row.children).toHaveLength(4); expect(row.lastElementChild?.hasAttribute('data-detail')).toBe(true); expect(row.children[1].hasAttribute('data-identity')).toBe(true); });
});
