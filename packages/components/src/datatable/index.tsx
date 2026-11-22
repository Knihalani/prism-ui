import { createContext, createElement, useContext, forwardRef, type CSSProperties, type ElementType } from 'react';
import { Icon, useSlot, cx, defineComponent, registerComponent, usePart, usePrism, type PrismComponentProps, type IconName } from '@prism-ui/react';
import { Odometer } from '../shared';
import { dataTableSchema, dataTableStrings, useDataTable, useDataTableCell, type DataTableColumn, type DataTableEntry, type DataTableModel, type DataTableProps, type DataTableRow } from './use-datatable';
export { useDataTable, dataTableSchema } from './use-datatable';
export type { DataTableProps, DataTableColumn, DataTableRow, DataTableEntry, DataTableModel, DataTableSelection } from './use-datatable';
const parts = ['action-hint','actions','ask','badge','caption','cell','checkbox','clear','count','details','empty','filter','footer','header','heading','intro','magnitude','next','previous','range','root','row','scroll','skeleton','sort','status','submission','submit','subtitle','table','title','toolbar','undo','header-row','body','selection-heading','selection-cell','placeholder-row','placeholder-cell','spacer-row','spacer-cell','empty-row','empty-cell','submit-label','receipt','value','icon'] as const;
export type DataTablePart = typeof parts[number];
export type DataTableSlotProps = { [P in DataTablePart]: { table: DataTableModel; row?: DataTableRow; column?: DataTableColumn; entry?: DataTableEntry } }
  & { [P in 'row' | 'selection-cell']: { table: DataTableModel; row: DataTableRow; entry: DataTableEntry } }
  & { [P in 'heading' | 'sort']: { table: DataTableModel; column: DataTableColumn } }
  & { [P in 'cell' | 'value' | 'badge' | 'magnitude']: { table: DataTableModel; row: DataTableRow; column: DataTableColumn; entry: DataTableEntry } };
const DataTableContext = createContext<DataTableModel | null>(null);
const Element = forwardRef<any, { as?: ElementType; [key: string]: any }>(function Element({ as = 'div', ...props }, ref) { return createElement(as, { ...props, ref }); });
const Part = forwardRef<any, { part: DataTablePart; row?: DataTableRow; column?: DataTableColumn; entry?: DataTableEntry; as?: ElementType; state?: string; [key: string]: any }>(function Part({ part, row, column, entry, as = 'div', state, style, className, ...props }, ref) {
  const table = useContext(DataTableContext)!, attrs = usePart('datatable', part, state), View = useSlot('datatable', part, Element);
  return <View as={as} {...attrs} {...props} ref={ref} {...(View === Element ? {} : { table, row, column, entry })} className={cx(attrs.className, className) || undefined} style={{ ...style, ...attrs.style }} />;
});
function TableIcon({ name, column }: { name: IconName; column?: DataTableColumn }) { return <Part part="icon" as={Icon} column={column} name={name} />; }
function Value({ entry, column }: { entry: DataTableEntry; column: DataTableColumn }) {
  const table = useContext(DataTableContext)!, cell = useDataTableCell(table, entry, column), model = { entry, column, row: entry.row };
  return <Part part="value" as="span" {...model} data-prism-flash={cell.flash ? '' : undefined}>{cell.animated ? <Odometer value={cell.number!} format={() => cell.text} /> : cell.text}</Part>;
}
export function DataTable({ props: input, complete, node }: PrismComponentProps<DataTableProps>) {
  const table = useDataTable({ ...input, complete }, usePrism(), node.props?.rows), { props, strings } = table;
  return <DataTableContext.Provider value={table}><Part part="root" {...table.presentation} role="region" aria-label={table.label} onKeyDown={table.frame.rootProps.onKeyDown} data-animate={table.animate ? undefined : 'false'} data-density={props.density} data-theme-mode={table.appearance} data-selectable={table.mode || undefined} data-hide-details={table.canHideDetails && !table.showDetails ? '' : undefined} style={{ '--prism-datatable-host-background': table.hostBackground } as CSSProperties}>
    <Part part="toolbar">
      <Part part="intro">{table.title && <Part part="title" as="h3">{table.title}</Part>}{table.subtitle && <Part part="subtitle" as="p">{table.subtitle}</Part>}</Part>
      <Part part="ask" as="button" type="button" onClick={table.onAsk} aria-label={strings.askAboutThisTable} title={strings.askAboutThisTable}><TableIcon name="ask" /></Part>
      <Part part="undo" as="button" type="button" onClick={table.frame.onUndo} disabled={!table.frame.canUndo} aria-label={strings.undoTableChange} title={strings.undoTableChange} aria-keyshortcuts="Control+Z Meta+Z"><TableIcon name="undo" /></Part>
      {props.filter !== false && <Part part="filter" as="input" type="search" aria-label={strings.filterRows} placeholder={strings.filterRows2} value={table.query} disabled={!complete} onInput={(event: React.FormEvent<HTMLInputElement>) => table.changeQuery(event.currentTarget.value)} />}
      {table.canHideDetails && <Part part="details" as="button" type="button" aria-pressed={table.showDetails} title={table.showDetails ? strings.showEssentialColumns : strings.showAllColumns} aria-controls={table.tableId} onClick={table.toggleDetails}>{table.showDetails ? strings.showEssentialColumns : strings.showAllColumns}<TableIcon name="chevron-right" /></Part>}
    </Part>
    <Part part="scroll" ref={table.scroll} tabIndex={0} role="group" aria-label={table.tableLabel} onScroll={(event: React.UIEvent<HTMLElement>) => table.setScrollTop(event.currentTarget.scrollTop)} style={{ maxHeight: typeof props.height === 'number' && Number.isFinite(props.height) || table.virtual ? table.height : undefined }}>
      <Part part="table" as="table" id={table.tableId} data-virtual={table.virtual ? '' : undefined} aria-label={table.tableLabel} aria-rowcount={table.virtual ? table.count + 1 : undefined} aria-colcount={table.columnCount || undefined} aria-busy={!complete}>
        {table.caption && <Part part="caption" as="caption">{table.caption}</Part>}
        <Part part="header" as="thead"><Part part="header-row" as="tr">
          {table.mode && <Part part="selection-heading" as="th" scope="col">{table.mode === 'multiple' && <Part part="checkbox" as="input" type="checkbox" ref={table.pageCheckbox} aria-label={strings.selectAllRowsOnPage} checked={table.pageSelected} onChange={table.togglePage} />}</Part>}
          {table.columns.map((column, index) => <Part key={column.key} part="heading" as="th" column={column} scope="col" aria-sort={complete && table.sort?.key === column.key ? table.sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'} data-align={column.align} data-detail={column.detail ? '' : undefined} data-identity={index === 0 ? '' : undefined}>
            <Part part="sort" as="button" column={column} type="button" disabled={!complete} onClick={() => table.sortBy(column.key)} onKeyDown={(event: React.KeyboardEvent) => table.onSortKeyDown(event, column.key)} aria-label={table.sortLabel(column)}>{column.label}<TableIcon column={column} name={table.sortIcon(column)} /></Part>
          </Part>)}
        </Part></Part>
        <Part part="body" as="tbody">
          {table.virtual && table.start > 0 && <Part part="spacer-row" as="tr" aria-hidden="true"><Part part="spacer-cell" as="td" colSpan={table.columnCount} style={{ height: table.start * table.rowHeight }} /></Part>}
          {table.visible.map((entry, position) => <Part key={entry.index} part="row" as="tr" row={entry.row} entry={entry} data-index={entry.index} data-prism-enter={table.virtual ? undefined : table.frame.rootProps['data-prism-enter']} state={table.selection.includes(entry.index) ? 'selected' : undefined} aria-selected={table.mode ? table.selection.includes(entry.index) : undefined} aria-rowindex={table.virtual ? table.start + position + 2 : undefined} tabIndex={table.focusIndex === entry.index || !table.visible.some(item => item.index === table.focusIndex) && position === 0 ? 0 : -1} onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => table.onRowKeyDown(event, entry.index)} onFocus={(event: React.FocusEvent<HTMLElement>) => { if (event.target === event.currentTarget) table.setFocusIndex(entry.index); }} style={{ height: table.rowHeight }}>
            {table.mode && <Part part="selection-cell" as="td" row={entry.row} entry={entry}><Part part="checkbox" as="input" type="checkbox" row={entry.row} entry={entry} aria-label={table.selectLabel(entry.index)} checked={table.selection.includes(entry.index)} onChange={() => table.toggleRow(entry.index)} /></Part>}
            {table.columns.map((column, index) => { const cell = table.cell(entry, column), model = { row: entry.row, column, entry }; return <Part key={column.key} part="cell" as="td" {...model} data-identity={index === 0 ? '' : undefined} data-align={column.align} data-detail={column.detail ? '' : undefined} title={cell.text}>
              {cell.magnitude > 0 && <Part part="magnitude" as="span" {...model} data-max={cell.magnitude === 1 ? '' : undefined} style={{ '--prism-datatable-magnitude': cell.magnitude } as CSSProperties} aria-hidden="true" />}
              {!table.unstyled && column.badge && cell.text ? <Part part="badge" as="span" {...model}><Value entry={entry} column={column} /></Part> : <Value entry={entry} column={column} />}
            </Part>; })}
          </Part>)}
          {table.virtual && table.end < table.count && <Part part="spacer-row" as="tr" aria-hidden="true"><Part part="spacer-cell" as="td" colSpan={table.columnCount} style={{ height: (table.count - table.end) * table.rowHeight }} /></Part>}
          {Array.from({ length: table.skeletonCount }, (_, index) => <Part part="placeholder-row" as="tr" key={index} aria-hidden="true" style={{ height: table.rowHeight }}>{Array.from({ length: Math.max(1, table.columnCount) }, (_, cell) => { const column = table.columns[cell - Number(Boolean(table.mode))]; return <Part key={cell} part="placeholder-cell" as="td" column={column} data-detail={column?.detail ? '' : undefined} data-identity={cell === Number(Boolean(table.mode)) ? '' : undefined}><Part part="skeleton" column={column} data-prism-skeleton-line={table.unstyled ? undefined : ''} /></Part>; })}</Part>)}
          {complete && table.currentPage === 0 && !table.query && table.count > 0 && table.pageSize > 0 && table.missing > 0 && <Part part="spacer-row" as="tr" aria-hidden="true"><Part part="spacer-cell" as="td" colSpan={Math.max(1, table.columnCount)} style={{ height: table.missing * table.rowHeight }} /></Part>}
          {!table.skeletonCount && !table.count && <Part part="empty-row" as="tr"><Part part="empty-cell" as="td" colSpan={Math.max(1, table.columnCount)} style={{ height: table.pageSize ? table.pageSize * table.rowHeight : undefined }}><Part part="empty">{table.emptyLabel}{table.query && <Part part="clear" as="button" type="button" onClick={() => table.changeQuery('')}>{strings.clearFilter}</Part>}</Part></Part></Part>}
        </Part>
      </Part>
    </Part>
    <Part part="footer"><Part part="count">{table.countLabel}</Part><Part part="range">{table.range}</Part><Part part="actions">
      {table.pageSize > 0 && <><Part part="previous" as="button" type="button" aria-label={strings.previousPage} title={strings.previousPage} disabled={table.currentPage === 0} onClick={() => table.changePage(table.currentPage - 1)}><TableIcon name="chevron-left" /></Part><Part part="next" as="button" type="button" aria-label={strings.nextPage} title={strings.nextPage} disabled={table.currentPage >= table.pageCount - 1} onClick={() => table.changePage(table.currentPage + 1)}><TableIcon name="chevron-right" /></Part></>}
      {table.mode && <Part part="submission"><Part part="submit" as="button" type="button" disabled={!table.selected.length} aria-describedby={props.actionHint ? table.hintId : undefined} data-sent={table.submitted ? '' : undefined} onClick={table.submit}><Part part="submit-label" as="span" hidden={table.submitted}>{table.actionLabel}</Part><Part part="receipt" as="span" hidden={!table.submitted}><TableIcon name="check" />{table.receiptLabel}</Part></Part>{props.actionHint && <Part part="action-hint" as="span" id={table.hintId}>{props.actionHint}</Part>}</Part>}
    </Part></Part>
    <Part part="status" role="status" aria-live="polite">{table.announcement}</Part>
  </Part></DataTableContext.Provider>;
}
export const dataTableDefinition = defineComponent({ name: 'dataTable', parts: [...parts], strings: dataTableStrings, schema: dataTableSchema, component: DataTable, syntax: 'fence',
  docs: 'Sortable, fuzzy-searchable, paginated/windowed table. Streaming appends unsorted/unfiltered. select emits {rows, indices}: original objects and zero-based input positions in input order. Keep input order stable. View/selection state supports undo. Theme strings accept dataTable or table (dataTable wins when both are provided); datatable remains supported for compatibility. Narrow containers scroll horizontally with pinned identity and selection columns.',
  examples: ['```ui:table\n{"columns":[{"key":"name","label":"Name"},{"key":"cost","label":"Cost","type":"currency"}],"rows":[{"name":"Pro","cost":24}],"pageSize":10,"selectable":true}\n```'] });
registerComponent(dataTableDefinition);
