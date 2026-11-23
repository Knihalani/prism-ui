import { componentStrings } from '../strings';
import { Children, createElement, createContext, forwardRef, useContext, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import type { Node } from '@prism-ui/core';
import { useStrings, useTheme, Icon, useSlot, PrismContext, useComponentState, usePart, usePresentation, usePrism, type MarkdownProps, type PrismComponentProps } from '@prism-ui/react';
import { interpolate } from '../interpolate';
import { createFlip } from '../lib/flip';
import { dateValue, format as formatValue, type FormatKind } from '../lib/format';

export const tableStrings = { ...componentStrings.table, tableLabel: 'Table', sortBy: '{column}', sorted: 'Sorted by {column} {direction}.', ascending: 'ascending', descending: 'descending', originalOrder: 'Original order.', loading: 'Loading rows.' };
export interface TableColumn { key: string; label?: string; title?: string; align?: 'left' | 'right' | 'center'; type?: FormatKind }
export interface TableProps { id?: string; label?: string; title?: string; columns?: (TableColumn | string)[]; rows?: unknown[]; pageSize?: number; [key: string]: unknown }
export type TableRow = Node;
export type TableSort = { column: number; dir: 'asc' | 'desc' } | null;
function text(node: Node): string { return node.value ?? (node.children ?? []).map(text).join(''); }
function numeric(value: string): number | undefined {
  const clean = value.trim().replace(/[\p{Sc}%,\s]/gu, '').replace(/^\((.*)\)$/, '-$1');
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean) && Number.isFinite(Number(clean)) ? Number(clean) : undefined;
}
function compare(left: string, right: string, locale?: string): number {
  const a = numeric(left), b = numeric(right);
  if (a !== undefined && b !== undefined) return a - b;
  const dateLike = (value: string) => /\d{4}[-/]\d|\d{1,2}[-/]\d{1,2}[-/]\d|[a-z]{3,}\s+\d/i.test(value);
  if (dateLike(left) && dateLike(right)) {
    const first = Date.parse(left), second = Date.parse(right);
    if (Number.isFinite(first) && Number.isFinite(second)) return first - second;
  }
  return left.localeCompare(right, locale, { numeric: true, sensitivity: 'base' });
}
function valueText(value: unknown): string { return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value); }
function fallbackColumns(props: TableProps): TableColumn[] {
  const rows = Array.isArray(props.rows) ? props.rows : [];
  const columns: TableColumn[] = (Array.isArray(props.columns) ? props.columns : []).flatMap(column => typeof column === 'string' ? [{ key: column, label: column }] : column && typeof column.key === 'string' ? [column] : []);
  if (!columns.length && rows[0] && typeof rows[0] === 'object') columns.push(...Object.keys(rows[0]).map(key => ({ key, label: key })));
  return columns;
}
function fallbackRows(props: TableProps, key: string, locale: string | undefined, currency: string, columns: TableColumn[]): Node[] {
  const rows = Array.isArray(props.rows) ? props.rows : [];
  const cell = (value: unknown, cellKey: string, header: boolean, kind?: FormatKind): Node => {
    const time = !header && (kind === 'date' || kind === 'datetime' || kind === 'relative') ? dateValue(value).getTime() : NaN;
    return { type: header ? 'tableHeader' : 'tableCell', key: cellKey, value: header ? undefined : valueText(Number.isFinite(time) ? time : value), children: [{ type: 'text', key: cellKey + '.0', value: !header && kind ? formatValue(value, kind, { locale, currency, fallback: valueText(value) }) : valueText(value) }] };
  };
  return [
    { type: 'tableRow', key: key + '.header', children: columns.map((column, index) => cell(column.label ?? column.title ?? column.key, key + '.header.' + index, true)) },
    ...rows.map((row, index): Node => ({ type: 'tableRow', key: key + '.row.' + index, children: columns.map((column, col) => cell(row && typeof row === 'object' ? (row as Record<string, unknown>)[column.key] : undefined, key + '.row.' + index + '.' + col, false, column.type)) })),
  ];
}

export function useTable(props: TableProps, ctx: Pick<PrismComponentProps, 'node' | 'children' | 'complete'>) {
  const { format, animate } = usePrism(), strings = useStrings('table', tableStrings), [stored, setSort] = useComponentState<TableSort>('sort', null), presentation = usePresentation();
  const markdown = ctx.node.type === 'table', definitions = markdown ? [] : fallbackColumns(props), rows = markdown ? ctx.node.children ?? [] : fallbackRows(props, ctx.node.key, format.locale, format.currencyCode, definitions);
  const [page, setPage] = useState(0);
  const headers = rows[0]?.children ?? [], data = rows.slice(1);
  const streaming = ctx.node.complete === false || !ctx.complete || markdown && ctx.node.complete === undefined && !Object.isFrozen(ctx.node);
  const state = streaming ? 'streaming' : 'done';
  const sort = stored && Number.isInteger(stored.column) && stored.column >= 0 && stored.column < headers.length && (stored.dir === 'asc' || stored.dir === 'desc') ? stored : null;
  const align = headers.map((_, index) => {
    const explicit = markdown ? ctx.node.align?.[index] : definitions[index]?.align;
    if (explicit) return explicit;
    const values = data.map(row => text(row.children?.[index] ?? { type: 'text', key: '', value: '' })).filter(value => value.trim());
    return values.length && values.filter(value => numeric(value) !== undefined).length / values.length >= .8 ? 'right' : 'left';
  });
  const order = data.map((_, index) => index);
  if (sort && !streaming) order.sort((a, b) => {
    const first = text(data[a].children?.[sort.column] ?? { type: 'text', key: '' }), second = text(data[b].children?.[sort.column] ?? { type: 'text', key: '' });
    return compare(first, second, format.locale) * (sort.dir === 'asc' ? 1 : -1) || a - b;
  });
  const paginated = !markdown && typeof props.pageSize === 'number' && Number.isFinite(props.pageSize) && props.pageSize > 0;
  const pageSize = paginated ? Math.max(1, Math.floor(props.pageSize!)) : data.length || 1;
  const pages = Math.max(1, Math.ceil(data.length / pageSize)), currentPage = Math.min(page, pages - 1);
  const visibleOrder = order.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const flip = useRef<ReturnType<typeof createFlip>>(undefined), pending = useRef(false);
  const elements = () => Array.from(scrollRef.current?.querySelectorAll('tbody tr') ?? []);
  const onSort = (column: number) => {
    if (streaming || !Number.isInteger(column) || column < 0 || column >= headers.length) return;
    const style = scrollRef.current && getComputedStyle(scrollRef.current), token = style?.getPropertyValue('--prism-table-motion-base').trim() || style?.getPropertyValue('--prism-motion-base').trim() || '0ms';
    const duration = animate ? (parseFloat(token) || 0) * (/ms$/.test(token) ? 1 : 1000) : 0;
    const next = createFlip({ duration, easing: style?.getPropertyValue('--prism-table-motion-spring').trim() || style?.getPropertyValue('--prism-motion-spring').trim() || 'ease' });
    next.measure(elements()); flip.current?.cancel(); flip.current = next; pending.current = true;
    setPage(0); setSort(sort?.column !== column ? { column, dir: 'asc' } : sort.dir === 'asc' ? { column, dir: 'desc' } : null);
  };
  useLayoutEffect(() => { if (pending.current && !streaming) { pending.current = false; flip.current?.play(elements()); } }, [stored, streaming]);
  useLayoutEffect(() => () => flip.current?.cancel(), []);
  const parts = { root: usePart('table', 'root', state), scroll: usePart('table', 'scroll', state), table: usePart('table', 'table', state), head: usePart('table', 'head', state), body: usePart('table', 'body', state), pagination: usePart('table', 'pagination', state), pageButton: usePart('table', 'pageButton', state) };
  const scrollRef = useRef<HTMLDivElement>(null), [edges, setEdges] = useState({ start: false, end: false });
  const theme = useTheme();
  const [hostBackground, setHostBackground] = useState<string>();
  useLayoutEffect(() => {
    let element = scrollRef.current?.parentElement;
    while (element) { const background = getComputedStyle(element).backgroundColor; if (background && background !== 'transparent' && background !== 'rgba(0, 0, 0, 0)') { setHostBackground(background); break; } element = element.parentElement; }
  }, [theme]);
  const measure = () => {
    const element = scrollRef.current;
    const next = { start: !!element && element.scrollLeft > 1, end: !!element && element.scrollLeft + element.clientWidth < element.scrollWidth - 1 };
    setEdges(old => old.start === next.start && old.end === next.end ? old : next);
  };
  useLayoutEffect(() => {
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    if (scrollRef.current) { observer?.observe(scrollRef.current); if (scrollRef.current.firstElementChild) observer?.observe(scrollRef.current.firstElementChild); }
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [ctx.node, props.columns, props.rows]);
  const columns: TableColumn[] = headers.map((header, index) => ({ ...definitions[index], key: definitions[index]?.key ?? String(index), label: text(header), align: align[index] as TableColumn['align'] }));
  const cells = new Map(rows.flatMap(row => (row.children ?? []).map((cell, index) => [cell.key, { row, column: columns[index], index, text: (cell.children ?? []).map(text).join('') }] as const)));
  const label = strings.label ?? props.label ?? strings.title ?? props.title ?? strings.tableLabel;
  const announcement = streaming ? strings.loading : sort ? interpolate(strings.sorted, { column: columns[sort.column]?.label ?? '', direction: sort.dir === 'asc' ? strings.ascending : strings.descending }) : strings.originalOrder;
  return { strings, columns, cells, label, announcement, animate, parts,
    pageStatus: interpolate(strings.pageStatus, { page: currentPage + 1, pages }),
    sortLabel(column?: TableColumn) { return interpolate(strings.sortBy, { column: column?.label ?? '' }); },
    onSortKeyDown(event: React.KeyboardEvent, column: number) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) onSort(column); } }, rows, headers, order: visibleOrder, sort, align, onSort, streaming, state, markdown, scrollRef, measure, paginated, page: currentPage, pages, setPage,
    rendered: Children.toArray(ctx.children),
    rootProps: { ...parts.root, ...presentation, style: { '--prism-table-host-background': hostBackground, ...parts.root.style } as CSSProperties, 'data-overflow-start': edges.start ? '' : undefined, 'data-overflow-end': edges.end ? '' : undefined, 'data-animate': animate === false ? 'false' : undefined, 'data-paginated': paginated ? '' : undefined },
    scrollProps: { ...parts.scroll, role: 'region', 'aria-label': label, tabIndex: 0, onScroll: measure } };
}
export type TableModel = ReturnType<typeof useTable>;
export const tableParts = ['body','cell','head','header','pageButton','pagination','root','row','scroll','sort','sortIcon','table','page-status','status','icon'] as const;
export type TablePart = typeof tableParts[number];
export type TableSlotProps = { [P in TablePart]: { table: TableModel; row?: TableRow; column?: TableColumn } }
  & { row: { table: TableModel; row: TableRow }; cell: { table: TableModel; row: TableRow; column: TableColumn } }
  & { [P in 'header' | 'sort' | 'sortIcon']: { table: TableModel; column: TableColumn; row: TableRow } };
const TableContext = createContext<TableModel | null>(null);
const Element = forwardRef<any, { as?: ElementType; [key: string]: any }>(function Element({ as = 'div', ...props }, ref) { return createElement(as, { ...props, ref }); });
const Part = forwardRef<any, { part: TablePart; as?: ElementType; row?: TableRow; column?: TableColumn; [key: string]: any }>(function Part({ part, row, column, as = 'div', ...props }, ref) {
  const table = useContext(TableContext)!, attrs = usePart('table', part, table.state), View = useSlot('table', part, Element);
  return <View as={as} {...attrs} {...props} {...(part === 'row' ? { 'data-prism-enter': table.rootProps['data-entering'] } : {})} ref={ref} {...(View === Element ? {} : { table, row, column })} />;
});
function TableRowView({ node, children }: MarkdownProps) {
  return <Part part="row" as="tr" row={node}>{children}</Part>;
}
function TableCellView({ node, children }: MarkdownProps) {
  const table = useContext(TableContext)!, context = table.cells.get(node.key), index = context?.index ?? 0, column = context?.column, row = context?.row, header = node.type === 'tableHeader', alignment = table.align[index];
  const dir = table.sort?.column === index ? table.sort.dir : undefined;
  if (!header) return <Part part="cell" as="td" row={row} column={column} title={context?.text} data-align={alignment} data-identity={index === 0 ? '' : undefined}>{children}</Part>;
  return <Part part="header" as="th" row={row} column={column} data-align={alignment} data-identity={index === 0 ? '' : undefined} scope="col" aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
    <Part part="sort" as="button" row={row} column={column} type="button" aria-label={table.sortLabel(column)} disabled={table.streaming} onClick={() => table.onSort(index)} onKeyDown={(event: React.KeyboardEvent) => table.onSortKeyDown(event, index)}>{children}<Part part="sortIcon" as="span" row={row} column={column} data-direction={dir}><Part part="icon" as={Icon} row={row} column={column} name={dir === 'asc' ? 'arrow-up' : dir === 'desc' ? 'arrow-down' : 'sort'} /></Part></Part>
  </Part>;
}
export function MarkdownTable({ props, ...ctx }: PrismComponentProps<TableProps>) {
  const model = useTable(props, ctx), prism = usePrism();
  const scoped = useMemo(() => ({ ...prism, components: {
    ...Object.fromEntries(Object.entries({ tableRow: TableRowView, tableHeader: TableCellView, tableCell: TableCellView }).filter(([name]) => !prism.components[name] && !prism.registry.get(name))),
    ...prism.components,
  } }), [prism]);
  const renderRow = (index: number): ReactNode => {
    const node = model.rows[index];
    if (model.markdown) return model.rendered[index];
    return <TableRowView key={node.key} node={node}>{node.children?.map(cell => <TableCellView key={cell.key} node={cell}>{cell.children?.map(text).join('')}</TableCellView>)}</TableRowView>;
  };
  return <TableContext.Provider value={model}><PrismContext.Provider value={scoped}><Part part="root" {...model.rootProps}>
    <Part part="scroll" {...model.scrollProps} ref={model.scrollRef}><Part part="table" as="table" aria-label={model.label} aria-busy={model.streaming}>
      <Part part="head" as="thead">{model.rows.length > 0 && renderRow(0)}</Part>
      <Part part="body" as="tbody">{model.order.map(index => renderRow(index + 1))}</Part>
    </Part></Part>
    {model.paginated && <Part part="pagination" as="nav" aria-label={model.strings.tablePagination}><Part part="pageButton" as="button" type="button" aria-label={model.strings.previousPage} disabled={model.streaming || model.page === 0} onClick={() => model.setPage(model.page - 1)}><Part part="icon" as={Icon} name="chevron-left" /></Part><Part part="page-status" as="span" aria-live="polite">{model.pageStatus}</Part><Part part="pageButton" as="button" type="button" aria-label={model.strings.nextPage} disabled={model.streaming || model.page + 1 >= model.pages} onClick={() => model.setPage(model.page + 1)}><Part part="icon" as={Icon} name="chevron-right" /></Part></Part>}
    <Part part="status" role="status" aria-live={model.streaming ? 'off' : 'polite'}>{model.announcement}</Part>
  </Part></PrismContext.Provider></TableContext.Provider>;
}
export function TableDispatcher(input: PrismComponentProps<TableProps>) {
  const { registry } = usePrism(), Delegate = input.node.type === 'table' ? undefined : registry.get('dataTable')?.component;
  return Delegate && Delegate !== TableDispatcher ? <Delegate {...input} /> : <MarkdownTable {...input} />;
}
