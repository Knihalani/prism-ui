import { componentStrings } from '../strings';
import { createElement, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ElementType, type HTMLAttributes } from 'react';
import { useStrings, createFlip, useReducedMotion, StreamSkeleton, PrismPart, cx, defineComponent, registerComponent, useFlash, usePart, usePrism, useSlot, type PrismComponentProps } from '@prism-ui/react';
import { FrameIcon, useFrame } from '../frame';
import { CheckMark, Odometer } from '../shared';
import { dataTableSchema, numericCell, useDataTable, type DataTableColumn, type DataTableProps } from './use-datatable';

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
  return <PrismPart as="input" {...part} {...props} className={cx(part.className, !unstyled && 'prism-check') || undefined} ref={ref} type="checkbox" />;
}
function reference(value: unknown) {
  return value && typeof value === 'object' && Object.hasOwn(value, '$ref') && '$ref' in value && typeof value.$ref === 'string' ? value.$ref : undefined;
}
function cellPath(rows: unknown, index: number, key: string) {
  const row = Array.isArray(rows) ? rows[index] : undefined;
  const cell = row && typeof row === 'object' && Object.hasOwn(row, key) ? row[key] : undefined;
  const direct = reference(cell);
  if (direct !== undefined) return direct;
  const rowsPath = reference(rows);
  const rowPath = reference(row) ?? (rowsPath === undefined ? undefined : `${rowsPath}.${index}`);
  return rowPath === undefined ? undefined : key.includes('.') ? rowPath : `${rowPath}.${key}`;
}
function LinkedCellValue({ path, value, column, text }: { path: string; value: unknown; column: DataTableColumn; text: string }) {
  const { animate } = usePrism();
  const flash = useFlash(path);
  const number = numericCell(value, column);
  return <span className="prism-flash" data-prism-flash={flash ? '' : undefined}>
    {animate && number !== undefined && Number.isFinite(number) ? <Odometer value={number} format={() => text} /> : text}
  </span>;
}
export function DataTable({ props: inputProps, complete, node }: PrismComponentProps<DataTableProps>) {
  const themeStrings = useStrings('datatable', componentStrings.datatable);
  const props = {
    ...inputProps,
    title: typeof inputProps.title === 'string' ? inputProps.title : undefined,
    subtitle: typeof inputProps.subtitle === 'string' ? inputProps.subtitle : undefined,
    caption: typeof inputProps.caption === 'string' ? inputProps.caption : undefined,
  };
  const ctx = usePrism();
  const vm = useDataTable({ ...props, complete }, ctx);
  const frame = useFrame({ component: 'datatable', title: props.title, undo: true });
  const scroll = useRef<HTMLDivElement>(null);
  const previewLayout = useRef<{ height: number; pageSize: number } | undefined>(undefined);
  const resizeAnimation = useRef<Animation | undefined>(undefined);
  const flip = useMemo(() => createFlip(), []), reduced = useReducedMotion();
  const sortPending = useRef(false);
  const rows = () => Array.from(scroll.current?.querySelectorAll('tr[data-index]') ?? []);
  const selectionKey = useMemo(() => JSON.stringify(vm.selected.map(entry => [entry.index, ...entry.cells])), [vm.selected]);
  const previousSelection = useRef(selectionKey);
  const sent = vm.sent !== undefined;
  const payload = vm.sent?.payload as Partial<{ indices: number[] }> | undefined;
  const sentCount = Array.isArray(payload?.indices) ? payload.indices.length : vm.selected.length;
  const styled = (name: string) => ctx.unstyled ? undefined : name;
  const [showDetails, setShowDetails] = useState(false);
  const tableId = useId();
  const hintId = useId();
  const canHideDetails = !ctx.unstyled && vm.columns.some(column => column.detail) && vm.columns.some(column => !column.detail);
  const magnitudes = useMemo(() => vm.columns.map(column => {
    if (ctx.unstyled || !column.magnitude) return 0;
    return vm.entries.reduce((max, entry) => {
      const value = numericCell(entry.row[column.key], column) ?? 0;
      return Number.isFinite(value) ? Math.max(max, Math.abs(value)) : max;
    }, 0);
  }), [ctx.unstyled, vm.columns, vm.entries]);
  useLayoutEffect(() => {
    if (previousSelection.current === selectionKey) return;
    previousSelection.current = selectionKey;
    vm.resetSent();
  }, [selectionKey, vm.resetSent]);
  useLayoutEffect(() => {
    if (!sortPending.current) return;
    sortPending.current = false;
    if (ctx.animate && !vm.virtual) flip.play(rows()); else flip.cancel();
  }, [vm.sort, ctx.animate, vm.virtual, flip]);
  useLayoutEffect(() => () => flip.cancel(), [flip]);
  useLayoutEffect(() => {
    if (vm.focusIndex !== null) scroll.current?.querySelector<HTMLElement>(`tr[data-index="${vm.focusIndex}"]`)?.focus({ preventScroll: true });
  }, [vm.focusIndex, vm.start]);
  const columns = vm.columns.length + (vm.mode ? 1 : 0), missing = Math.max(0, (vm.pageSize || 3) - vm.visible.length), skeletonCount = complete ? 0 : missing;
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const previous = previewLayout.current;
    if (previous && previous.pageSize !== vm.pageSize) resizeAnimation.current?.cancel();
    const height = element.offsetHeight;
    previewLayout.current = complete ? undefined : { height, pageSize: vm.pageSize };
    // Page size can arrive after the rows. Settle from the preview's height
    // without holding extra rows or delaying the pagination controls.
    if (!reduced && ctx.animate && !ctx.unstyled && vm.pageSize && previous && previous.pageSize !== vm.pageSize && previous.height > height) {
      const style = getComputedStyle(element), time = style.getPropertyValue('--prism-motion-base').trim();
      const duration = parseFloat(time) * (time.endsWith('ms') ? 1 : 1000);
      resizeAnimation.current = element.animate?.(
        [{ minHeight: `${previous.height}px` }, { minHeight: `${height}px` }],
        { duration: Number.isFinite(duration) ? duration : 0, easing: style.getPropertyValue('--prism-motion-ease').trim() || 'linear' },
      );
    }
  }, [complete, reduced, ctx.animate, ctx.unstyled, props.height, vm.pageSize, vm.rowHeight, vm.visible.length, skeletonCount]);
  useLayoutEffect(() => () => resizeAnimation.current?.cancel(), [ctx.animate, ctx.unstyled]);
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
    flip.measure(rows());
    sortPending.current = true;
    vm.toggleSort(key);
  };
  return <Part part="root" className={styled('prism-materialise')} role="region" aria-label={props.title ?? props.caption ?? 'Data table'} onKeyDown={frame.rootProps.onKeyDown} data-state={frame.rootProps['data-state']} data-entering={frame.rootProps['data-entering']} data-animate={ctx.animate ? undefined : 'false'} data-density={props.density} data-hide-details={canHideDetails && !showDetails ? '' : undefined}>
    <Part part="toolbar">
      {(props.title || props.subtitle) && <Part part="intro">
        {props.title && <Part part="title" as="h3">{props.title}</Part>}
        {props.subtitle && <Part part="subtitle" as="p">{props.subtitle}</Part>}
      </Part>}
      <Part part="ask" className={styled('prism-icon-btn')} as="button" type="button" onClick={frame.onAsk} aria-label={themeStrings.askAboutThisTable} title={themeStrings.askAboutThisTable}><FrameIcon name="ask" /></Part>
      <Part part="undo" className={styled('prism-icon-btn')} as="button" type="button" onClick={frame.onUndo} disabled={!frame.canUndo} aria-label={themeStrings.undoTableChange} title={themeStrings.undoTableChange} aria-keyshortcuts="Control+Z Meta+Z"><FrameIcon name="undo" /></Part>
      {props.filter !== false && <Part part="filter" as="input" type="search" aria-label={themeStrings.filterRows} placeholder={themeStrings.filterRows2} value={vm.query} disabled={!complete} onInput={event => { vm.changeQuery((event.currentTarget as HTMLInputElement).value); resetScroll(); }} />}
      {canHideDetails && <Part part="details" as="button" type="button" aria-pressed={showDetails} aria-controls={tableId} onClick={() => setShowDetails(current => !current)}>{showDetails ? themeStrings.showEssentialColumns : themeStrings.showAllColumns}</Part>}
    </Part>
    <PrismPart as="div" ref={scroll} {...usePart('datatable', 'scroll')} style={{ maxHeight: typeof props.height === 'number' && Number.isFinite(props.height) || vm.virtual ? vm.height : undefined, ...ctx.styles.datatable?.scroll }} onScroll={event => vm.setScrollTop(event.currentTarget.scrollTop)}>
      <Part part="table" as="table" id={tableId} data-virtual={vm.virtual ? '' : undefined} aria-label={props.caption ?? props.title ?? 'Data table'} aria-rowcount={vm.virtual ? vm.count + 1 : undefined} aria-colcount={columns || undefined} aria-busy={!complete}>
        {props.caption && <Part part="caption" as="caption">{props.caption}</Part>}
        <Part part="header" as="thead"><tr>
          {vm.mode && <Part part="heading" as="th" scope="col">{vm.mode === 'multiple' && <Checkbox aria-label={themeStrings.selectAllRowsOnPage} checked={vm.pageSelected} mixed={vm.selectedOnPage > 0 && !vm.pageSelected} onChange={vm.togglePage} />}</Part>}
          {vm.columns.map(column => <Part key={column.key} part="heading" as="th" scope="col" aria-sort={complete && vm.sort?.key === column.key ? vm.sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'} data-align={column.align} data-detail={column.detail ? '' : undefined} data-magnitude={column.magnitude ? '' : undefined}>
            <Part part="sort" as="button" type="button" disabled={!complete} onClick={() => sortBy(column.key)} onKeyDown={(event: React.KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); sortBy(column.key); } }} aria-label={`Sort by ${column.label}`}>
              {column.label}<span aria-hidden="true">{vm.sort?.key === column.key && complete ? vm.sort.direction === 'asc' ? ' ↑' : ' ↓' : ' ↕'}</span>
            </Part>
          </Part>)}
        </tr></Part>
        <tbody>
          {vm.virtual && vm.start > 0 && <tr aria-hidden="true"><td colSpan={columns} style={{ height: vm.start * vm.rowHeight, padding: 0, border: 0 }} /></tr>}
          {vm.visible.map((entry, position) => <Part key={entry.index} part="row" as="tr" data-index={entry.index} data-entering={complete ? undefined : frame.rootProps['data-entering']} state={vm.selection.includes(entry.index) ? 'selected' : undefined} aria-selected={vm.mode ? vm.selection.includes(entry.index) : undefined} aria-rowindex={vm.virtual ? vm.start + position + 2 : undefined} tabIndex={vm.focusIndex === entry.index || !vm.visible.some(item => item.index === vm.focusIndex) && position === 0 ? 0 : -1} onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => onRowKeyDown(event, entry.index)} onFocus={(event: React.FocusEvent<HTMLElement>) => { if (event.target === event.currentTarget) vm.setFocusIndex(entry.index); }} style={{ height: vm.rowHeight, '--prism-motion-index': Math.min(position, 8) } as CSSProperties}>
            {vm.mode && <Part part="cell" as="td"><Checkbox aria-label={`Select row ${entry.index + 1}`} checked={vm.selection.includes(entry.index)} onChange={() => vm.toggleRow(entry.index)} /></Part>}
            {vm.columns.map((column, index) => {
              const path = ctx.unstyled ? undefined : cellPath(node.props?.rows, entry.index, column.key);
              const text = entry.cells[index];
              const value = entry.row[column.key];
              const magnitude = magnitudes[index] ? Math.abs(numericCell(value, column) ?? 0) / magnitudes[index] : 0;
              const content = path === undefined ? text : <LinkedCellValue key={path} path={path} value={value} column={column} text={text} />;
              return <Part key={column.key} part="cell" as="td" data-align={column.align} data-detail={column.detail ? '' : undefined} title={text}>
                {Number.isFinite(magnitude) && magnitude > 0 && <Part part="magnitude" as="span" data-max={magnitude === 1 ? '' : undefined} style={{ width: '80%', transform: `scaleX(${magnitude})` }} aria-hidden="true" />}
                {!ctx.unstyled && column.badge && text ? <Part part="badge" className="prism-chip" as="span">{content}</Part> : content}
              </Part>;
            })}
          </Part>)}
          {vm.virtual && vm.end < vm.count && <tr aria-hidden="true"><td colSpan={columns} style={{ height: (vm.count - vm.end) * vm.rowHeight, padding: 0, border: 0 }} /></tr>}
          {Array.from({ length: skeletonCount }, (_, index) => <tr key={`skeleton-${index}`} aria-hidden="true" style={{ height: vm.rowHeight }}>{Array.from({ length: Math.max(1, columns) }, (_, cell) => <Part key={cell} part="cell" as="td" data-detail={vm.columns[cell - Number(Boolean(vm.mode))]?.detail ? '' : undefined}><Part part="skeleton" as={StreamSkeleton} data-prism-skeleton-line={styled('')} /></Part>)}</tr>)}
          {complete && vm.currentPage === 0 && !vm.query && vm.count > 0 && vm.pageSize > 0 && missing > 0 && <tr aria-hidden="true"><td colSpan={Math.max(1, columns)} style={{ height: missing * vm.rowHeight, padding: 0 }} /></tr>}
          {!skeletonCount && !vm.count && <tr><td colSpan={Math.max(1, columns)} style={{ height: vm.pageSize ? vm.pageSize * vm.rowHeight : undefined }}><Part part="empty">{vm.query ? `No rows match “${vm.query}”` : themeStrings.noRowsYet}{vm.query && <Part part="clear" as="button" type="button" onClick={() => vm.changeQuery('')}>{themeStrings.clearFilter}</Part>}</Part></td></tr>}
        </tbody>
      </Part>
    </PrismPart>
    <Part part="footer">
      <Part part="count">{vm.mode && complete ? vm.selected.length ? `${vm.selected.length} selected` : themeStrings.noRowsSelected : `${vm.count} rows`}</Part>
      <Part part="range">{vm.range}</Part>
      <Part part="actions">
      {vm.pageSize > 0 && <><Part part="previous" className={styled('prism-icon-btn')} as="button" type="button" aria-label={themeStrings.previousPage} title={themeStrings.previousPage} disabled={vm.currentPage === 0} onClick={() => { vm.changePage(vm.currentPage - 1); resetScroll(); }}>‹</Part><Part part="next" className={styled('prism-icon-btn')} as="button" type="button" aria-label={themeStrings.nextPage} title={themeStrings.nextPage} disabled={vm.currentPage >= vm.pageCount - 1} onClick={() => { vm.changePage(vm.currentPage + 1); resetScroll(); }}>›</Part></>}
      {vm.mode && <Part part="submission">
        <Part part="submit" className={styled('prism-pill')} as="button" type="button" disabled={!vm.selected.length} aria-describedby={props.actionHint ? hintId : undefined} data-feedback="" data-sent={sent ? '' : undefined} onClick={vm.submit}>
          <span aria-hidden={sent || undefined} hidden={ctx.unstyled && sent}>{props.actionLabel || `Use ${vm.selected.length} selected`}</span>
          <span aria-hidden={!sent || undefined} hidden={ctx.unstyled && !sent}>{ctx.unstyled ? <FrameIcon name="check" /> : <CheckMark />} {themeStrings.sent.replace('{count}', String(sentCount))}</span>
        </Part>
        {props.actionHint && <Part part="action-hint" as="span" id={hintId}>{props.actionHint}</Part>}
      </Part>}
    </Part></Part>
    <Part part="status" role="status" aria-live="polite">{vm.announcement}</Part>
  </Part>;
}
export const dataTableDefinition = defineComponent({ name: 'dataTable', parts: ["action-hint","actions","ask","badge","caption","cell","checkbox","clear","count","details","empty","filter","footer","header","heading","intro","magnitude","next","previous","range","root","row","scroll","skeleton","sort","status","submission","submit","subtitle","table","title","toolbar","undo"], strings: componentStrings.datatable, schema: dataTableSchema, component: DataTable, syntax: 'fence',
  docs: 'Sortable, fuzzy-searchable, paginated/windowed table. Streaming appends unsorted/unfiltered. select emits {rows, indices}: original objects and zero-based input positions in input order. Keep input order stable. View/selection state supports undo.',
  examples: ['```ui:table\n{"columns":[{"key":"name","label":"Name"},{"key":"cost","label":"Cost","type":"currency"}],"rows":[{"name":"Pro","cost":24}],"pageSize":10,"selectable":true}\n```'] });
registerComponent(dataTableDefinition);
