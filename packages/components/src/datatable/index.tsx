import { createElement, useLayoutEffect, useMemo, useRef, useState, type ElementType, type HTMLAttributes } from 'react';
import { cx, defineComponent, registerComponent, usePart, usePrism, useSlot, type PrismComponentProps } from '@prism-ui/react';
import { FrameIcon, useFrame } from '../frame';
import { createFlip } from '../lib/flip';
import { dataTableSchema, useDataTable, type DataTableProps } from './use-datatable';

export { useDataTable, dataTableSchema } from './use-datatable';
export type { DataTableProps, DataTableColumn, DataTableRow, DataTableSelection } from './use-datatable';

interface ElementProps extends HTMLAttributes<HTMLElement> { as?: ElementType; [key: string]: any }
function Element({ as = 'div', ...props }: ElementProps) { return createElement(as, props); }
function Part({ part, state, style, className, ...props }: ElementProps & { part: string; state?: string }) {
  const attrs = usePart('datatable', part, state), View = useSlot('datatable', part, Element);
  return <View {...attrs} {...props} className={cx(attrs.className, className) || undefined} style={{ ...style, ...attrs.style }} />;
}
function Checkbox({ mixed, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { mixed?: boolean }) {
  const ref = useRef<HTMLInputElement>(null), part = usePart('datatable', 'checkbox');
  const { unstyled } = usePrism();
  useLayoutEffect(() => { if (ref.current) ref.current.indeterminate = !!mixed; }, [mixed]);
  return <input {...part} {...props} className={cx(part.className, !unstyled && 'prism-check') || undefined} ref={ref} type="checkbox" />;
}
export function DataTable({ props: inputProps, complete }: PrismComponentProps<DataTableProps>) {
  const props = { ...inputProps, title: typeof inputProps.title === 'string' ? inputProps.title : undefined, caption: typeof inputProps.caption === 'string' ? inputProps.caption : undefined };
  const ctx = usePrism();
  const vm = useDataTable({ ...props, complete }, ctx);
  const frame = useFrame({ component: 'datatable', title: props.title, undo: true });
  const scroll = useRef<HTMLDivElement>(null);
  const flip = useMemo(() => createFlip({ duration: 180, easing: 'cubic-bezier(.22, 1, .36, 1)' }), []);
  const sortPending = useRef(false);
  const rows = () => Array.from(scroll.current?.querySelectorAll('tr[data-index]') ?? []);
  const [lastSent, setLastSent] = useState<string>();
  const selectionKey = useMemo(() => JSON.stringify(vm.selected.map(entry => [entry.index, ...entry.cells])), [vm.selected]);
  const sent = vm.selected.length > 0 && lastSent === selectionKey;
  const styled = (name: string) => ctx.unstyled ? undefined : name;
  useLayoutEffect(() => {
    if (!sortPending.current) return;
    sortPending.current = false;
    if (ctx.animate) flip.play(rows()); else flip.cancel();
  }, [vm.sort, ctx.animate, flip]);
  useLayoutEffect(() => () => flip.cancel(), [flip]);
  useLayoutEffect(() => {
    if (vm.focusIndex !== null) scroll.current?.querySelector<HTMLElement>(`tr[data-index="${vm.focusIndex}"]`)?.focus({ preventScroll: true });
  }, [vm.focusIndex, vm.start]);
  const columns = vm.columns.length + (vm.mode ? 1 : 0), missing = Math.max(0, (vm.pageSize || 3) - vm.visible.length), skeletonCount = complete ? 0 : missing;
  const onRowKeyDown = (event: React.KeyboardEvent<HTMLElement>, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const list = vm.virtual ? vm.ordered : vm.paged, position = list.findIndex(entry => entry.index === index);
      const next = Math.max(0, Math.min(list.length - 1, position + (event.key === 'ArrowDown' ? 1 : -1))), target = list[next];
      if (!target) return;
      if (vm.virtual && scroll.current) {
        const top = next * vm.rowHeight;
        if (top < scroll.current.scrollTop || top + vm.rowHeight > scroll.current.scrollTop + vm.height - vm.rowHeight) {
          scroll.current.scrollTop = Math.max(0, top - vm.rowHeight); vm.setScrollTop(scroll.current.scrollTop);
        }
      }
      vm.setFocusIndex(target.index);
    } else if (event.key === ' ' && event.target === event.currentTarget) { event.preventDefault(); vm.toggleRow(index); }
  };
  const resetScroll = () => { if (scroll.current) scroll.current.scrollTop = 0; };
  const sortBy = (key: string) => {
    resetScroll();
    if (ctx.animate && !vm.virtual) {
      flip.measure(rows());
      sortPending.current = true;
    }
    vm.toggleSort(key);
  };
  return <Part part="root" state={complete ? 'done' : 'streaming'} role="region" aria-label={props.title ?? props.caption ?? 'Data table'} onKeyDown={frame.rootProps.onKeyDown} data-animate={ctx.animate ? undefined : 'false'} data-density={props.density}>
    <Part part="toolbar">
      {props.title && <Part part="title" as="h3">{props.title}</Part>}
      {props.filter !== false && <Part part="filter" as="input" type="search" aria-label="Filter rows" placeholder="Filter rows…" value={vm.query} disabled={!complete} onInput={event => { vm.changeQuery((event.currentTarget as HTMLInputElement).value); resetScroll(); }} />}
      <Part part="count">{vm.count} rows</Part>
      <Part part="ask" className={styled('prism-icon-btn')} as="button" type="button" onClick={frame.onAsk} aria-label="Ask about this table" title="Ask about this table"><FrameIcon name="ask" /></Part>
      <Part part="undo" className={styled('prism-icon-btn')} as="button" type="button" onClick={frame.onUndo} disabled={!frame.canUndo} aria-label="Undo table change" title="Undo table change" aria-keyshortcuts="Control+Z Meta+Z"><FrameIcon name="undo" /></Part>
    </Part>
    <div ref={scroll} {...usePart('datatable', 'scroll')} style={{ maxHeight: typeof props.height === 'number' && Number.isFinite(props.height) || vm.virtual ? vm.height : undefined, ...ctx.styles.datatable?.scroll }} onScroll={event => vm.setScrollTop(event.currentTarget.scrollTop)}>
      <Part part="table" as="table" data-virtual={vm.virtual ? '' : undefined} aria-label={props.caption ?? props.title ?? 'Data table'} aria-rowcount={vm.virtual ? vm.count + 1 : undefined} aria-colcount={columns || undefined} aria-busy={!complete}>
        {props.caption && <Part part="caption" as="caption">{props.caption}</Part>}
        <Part part="header" as="thead"><tr>
          {vm.mode && <Part part="heading" as="th" scope="col">{vm.mode === 'multiple' && <Checkbox aria-label="Select all rows on page" checked={vm.pageSelected} mixed={vm.selectedOnPage > 0 && !vm.pageSelected} onChange={vm.togglePage} />}</Part>}
          {vm.columns.map(column => <Part key={column.key} part="heading" as="th" scope="col" aria-sort={complete && vm.sort?.key === column.key ? vm.sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'} data-align={column.align}>
            <Part part="sort" as="button" type="button" disabled={!complete} onClick={() => sortBy(column.key)} onKeyDown={(event: React.KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); sortBy(column.key); } }} aria-label={`Sort by ${column.label}`}>
              {column.label}<span aria-hidden="true">{vm.sort?.key === column.key && complete ? vm.sort.direction === 'asc' ? ' ↑' : ' ↓' : ' ↕'}</span>
            </Part>
          </Part>)}
        </tr></Part>
        <tbody>
          {vm.virtual && vm.start > 0 && <tr aria-hidden="true"><td colSpan={columns} style={{ height: vm.start * vm.rowHeight, padding: 0, border: 0 }} /></tr>}
          {vm.visible.map((entry, position) => <Part key={entry.index} part="row" as="tr" data-index={entry.index} state={vm.selection.includes(entry.index) ? 'selected' : undefined} aria-selected={vm.mode ? vm.selection.includes(entry.index) : undefined} aria-rowindex={vm.virtual ? vm.start + position + 2 : undefined} tabIndex={vm.focusIndex === entry.index || !vm.visible.some(item => item.index === vm.focusIndex) && position === 0 ? 0 : -1} onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => onRowKeyDown(event, entry.index)} onFocus={(event: React.FocusEvent<HTMLElement>) => { if (event.target === event.currentTarget) vm.setFocusIndex(entry.index); }} style={{ height: vm.rowHeight }}>
            {vm.mode && <Part part="cell" as="td"><Checkbox aria-label={`Select row ${entry.index + 1}`} checked={vm.selection.includes(entry.index)} onChange={() => vm.toggleRow(entry.index)} /></Part>}
            {vm.columns.map((column, index) => <Part key={column.key} part="cell" as="td" data-align={column.align} title={entry.cells[index]}>{entry.cells[index]}</Part>)}
          </Part>)}
          {vm.virtual && vm.end < vm.count && <tr aria-hidden="true"><td colSpan={columns} style={{ height: (vm.count - vm.end) * vm.rowHeight, padding: 0, border: 0 }} /></tr>}
          {Array.from({ length: skeletonCount }, (_, index) => <tr key={`skeleton-${index}`} aria-hidden="true" style={{ height: vm.rowHeight }}>{Array.from({ length: Math.max(1, columns) }, (_, cell) => <Part key={cell} part="cell" as="td"><Part part="skeleton" className={styled('prism-skeleton')}>&nbsp;</Part></Part>)}</tr>)}
          {complete && vm.count > 0 && vm.pageSize > 0 && missing > 0 && <tr aria-hidden="true"><td colSpan={Math.max(1, columns)} style={{ height: missing * vm.rowHeight, padding: 0 }} /></tr>}
          {!skeletonCount && !vm.count && <tr><td colSpan={Math.max(1, columns)} style={{ height: vm.pageSize ? vm.pageSize * vm.rowHeight : undefined }}><Part part="empty">{vm.query ? `No rows match “${vm.query}”` : 'No rows yet'}{vm.query && <Part part="clear" as="button" type="button" onClick={() => vm.changeQuery('')}>Clear filter</Part>}</Part></td></tr>}
        </tbody>
      </Part>
    </div>
    <Part part="footer"><Part part="range">{vm.range}</Part><Part part="actions">
      {vm.pageSize > 0 && <><Part part="previous" className={styled('prism-icon-btn')} as="button" type="button" aria-label="Previous page" title="Previous page" disabled={vm.currentPage === 0} onClick={() => { vm.changePage(vm.currentPage - 1); resetScroll(); }}>←</Part><Part part="next" className={styled('prism-icon-btn')} as="button" type="button" aria-label="Next page" title="Next page" disabled={vm.currentPage >= vm.pageCount - 1} onClick={() => { vm.changePage(vm.currentPage + 1); resetScroll(); }}>→</Part></>}
      {vm.mode && <Part part="submit" className={styled('prism-pill')} as="button" type="button" disabled={!vm.selected.length} data-feedback="" data-sent={sent ? '' : undefined} onClick={() => { vm.submit(); setLastSent(selectionKey); }}>
        <span aria-hidden={sent || undefined} hidden={ctx.unstyled && sent}>Use {vm.selected.length} selected</span>
        <span aria-hidden={!sent || undefined} hidden={ctx.unstyled && !sent}><FrameIcon name="check" /> Sent · {vm.selected.length}</span>
      </Part>}
    </Part></Part>
    <Part part="status" role="status" aria-live="polite">{vm.announcement}</Part>
  </Part>;
}
export const dataTableDefinition = defineComponent({ name: 'dataTable', schema: dataTableSchema, component: DataTable, syntax: 'fence',
  docs: 'Sortable, fuzzy-searchable, paginated/windowed table. Streaming appends unsorted/unfiltered. select emits {rows, indices}: original objects and zero-based input positions in input order. Keep input order stable. View/selection state supports undo.',
  examples: ['```ui:table\n{"columns":[{"key":"name","label":"Name"},{"key":"cost","label":"Cost","type":"currency"}],"rows":[{"name":"Pro","cost":24}],"pageSize":10,"selectable":true}\n```'] });
registerComponent(dataTableDefinition);
