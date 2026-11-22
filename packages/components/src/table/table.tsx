import { componentStrings } from '../strings';
import { Children, createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode, type ThHTMLAttributes } from 'react';
import type { Node } from '@prism-ui/core';
import { useStrings, Icon, PrismPart, PrismContext, useComponentState, usePart, usePresentation, usePrism, useSlot, type MarkdownProps, type PrismComponentProps } from '@prism-ui/react';
import { dateValue, format as formatValue, type FormatKind } from '../lib/format';

export interface TableColumn { key: string; label?: string; title?: string; align?: 'left' | 'right' | 'center'; type?: FormatKind }
export interface TableProps { id?: string; label?: string; title?: string; columns?: (TableColumn | string)[]; rows?: unknown[]; pageSize?: number; [key: string]: unknown }
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
function fallbackRows(props: TableProps, key: string, locale: string | undefined, currency: string): Node[] {
  const rows = Array.isArray(props.rows) ? props.rows : [];
  const columns: TableColumn[] = (Array.isArray(props.columns) ? props.columns : []).flatMap(column => typeof column === 'string' ? [{ key: column, label: column }] : column && typeof column.key === 'string' ? [column] : []);
  if (!columns.length && rows[0] && typeof rows[0] === 'object') columns.push(...Object.keys(rows[0]).map(key => ({ key, label: key })));
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
  const { format } = usePrism(), [stored, setSort] = useComponentState<TableSort>('sort', null), presentation = usePresentation();
  const markdown = ctx.node.type === 'table', rows = markdown ? ctx.node.children ?? [] : fallbackRows(props, ctx.node.key, format.locale, format.currencyCode);
  const [page, setPage] = useState(0);
  const headers = rows[0]?.children ?? [], data = rows.slice(1);
  const streaming = ctx.node.complete === false || !ctx.complete || markdown && ctx.node.complete === undefined && !Object.isFrozen(ctx.node);
  const state = streaming ? 'streaming' : 'done';
  const sort = stored && Number.isInteger(stored.column) && stored.column >= 0 && stored.column < headers.length && (stored.dir === 'asc' || stored.dir === 'desc') ? stored : null;
  const align = headers.map((_, index) => {
    const explicit = markdown ? ctx.node.align?.[index] : (Array.isArray(props.columns) && typeof props.columns[index] === 'object' ? (props.columns[index] as TableColumn)?.align : undefined);
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
  const onSort = (column: number) => { if (!streaming) { setPage(0); setSort(sort?.column !== column ? { column, dir: 'asc' } : sort.dir === 'asc' ? { column, dir: 'desc' } : null); } };
  const parts = { root: usePart('table', 'root', state), scroll: usePart('table', 'scroll', state), table: usePart('table', 'table', state), head: usePart('table', 'head', state), body: usePart('table', 'body', state), pagination: usePart('table', 'pagination', state), pageButton: usePart('table', 'pageButton', state) };
  const scrollRef = useRef<HTMLDivElement>(null), [edges, setEdges] = useState({ start: false, end: false });
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
  return { parts, rows, headers, order: visibleOrder, sort, align, onSort, streaming, state, markdown, scrollRef, measure, paginated, page: currentPage, pages, setPage,
    rendered: Children.toArray(ctx.children),
    rootProps: { ...parts.root, ...presentation, 'data-overflow-start': edges.start ? '' : undefined, 'data-overflow-end': edges.end ? '' : undefined },
    scrollProps: { ...parts.scroll, role: 'region', 'aria-label': props.label ?? props.title ?? 'Table', tabIndex: 0, onScroll: measure } };
}
const TableContext = createContext<ReturnType<typeof useTable> | null>(null);
function Row(props: HTMLAttributes<HTMLTableRowElement>) { return <PrismPart as="tr" {...props} />; }
function Header(props: ThHTMLAttributes<HTMLTableCellElement>) { return <PrismPart as="th" {...props} />; }
function Cell(props: HTMLAttributes<HTMLTableCellElement>) { return <PrismPart as="td" {...props} />; }
function Head(props: HTMLAttributes<HTMLTableSectionElement>) { return <PrismPart as="thead" {...props} />; }
function Body(props: HTMLAttributes<HTMLTableSectionElement>) { return <PrismPart as="tbody" {...props} />; }
function TableRowView({ children }: MarkdownProps) {
  const model = useContext(TableContext)!, part = usePart('table', 'row', model.state), RowSlot = useSlot('table', 'row', Row);
  return <RowSlot {...part}>{children}</RowSlot>;
}
function TableCellView({ node, children }: MarkdownProps) {
  const model = useContext(TableContext)!, index = Number(node.key.split('.').at(-1)), header = node.type === 'tableHeader';
  const part = usePart('table', header ? 'header' : 'cell', model.state), button = usePart('table', 'sort', model.state), icon = usePart('table', 'sortIcon', model.state);
  const HeaderSlot = useSlot('table', 'header', Header), CellSlot = useSlot('table', 'cell', Cell);
  const alignment = model.align[index], style = { textAlign: alignment as 'left' | 'right' | 'center', ...part.style };
  if (!header) return <CellSlot {...part} style={style} data-align={alignment}>{children}</CellSlot>;
  const dir = model.sort?.column === index ? model.sort.dir : undefined;
  return <HeaderSlot {...part} style={style} data-align={alignment} scope="col" aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
    <PrismPart as="button" {...button} type="button" disabled={model.streaming} onClick={() => model.onSort(index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) model.onSort(index); } }}>{children}<PrismPart as="span" {...icon} data-direction={dir}><Icon name="sort" width="12" height="12" /></PrismPart></PrismPart>
  </HeaderSlot>;
}
export function MarkdownTable({ props, ...ctx }: PrismComponentProps<TableProps>) {
  const themeStrings = useStrings('table', componentStrings.table);
  const model = useTable(props, ctx), prism = usePrism(), HeadSlot = useSlot('table', 'head', Head), BodySlot = useSlot('table', 'body', Body);
  const scoped = useMemo(() => ({ ...prism, components: {
    ...Object.fromEntries(Object.entries({ tableRow: TableRowView, tableHeader: TableCellView, tableCell: TableCellView }).filter(([name]) => !prism.components[name] && !prism.registry.get(name))),
    ...prism.components,
  } }), [prism]);
  const renderRow = (index: number): ReactNode => {
    const node = model.rows[index];
    if (model.markdown) return model.rendered[index];
    return <TableRowView key={node.key} node={node}>{node.children?.map(cell => <TableCellView key={cell.key} node={cell}>{cell.children?.map(text).join('')}</TableCellView>)}</TableRowView>;
  };
  return <TableContext.Provider value={model}><PrismContext.Provider value={scoped}><PrismPart as="div" {...model.rootProps}>
    <PrismPart as="div" {...model.scrollProps} ref={model.scrollRef}><PrismPart as="table" {...model.parts.table}>
      <HeadSlot {...model.parts.head}>{model.rows.length > 0 && renderRow(0)}</HeadSlot>
      <BodySlot {...model.parts.body}>{model.order.map(index => renderRow(index + 1))}</BodySlot>
    </PrismPart></PrismPart>
    {model.paginated && <PrismPart as="nav" {...model.parts.pagination} aria-label={themeStrings.tablePagination}><PrismPart as="button" {...model.parts.pageButton} type="button" disabled={model.streaming || model.page === 0} onClick={() => model.setPage(model.page - 1)}>{themeStrings.previousPage}</PrismPart><span aria-live="polite">{themeStrings.pageStatus.replace('{page}', String(model.page + 1)).replace('{pages}', String(model.pages))}</span><PrismPart as="button" {...model.parts.pageButton} type="button" disabled={model.streaming || model.page + 1 >= model.pages} onClick={() => model.setPage(model.page + 1)}>{themeStrings.nextPage}</PrismPart></PrismPart>}
  </PrismPart></PrismContext.Provider></TableContext.Provider>;
}
export function TableDispatcher(input: PrismComponentProps<TableProps>) {
  const { registry } = usePrism(), Delegate = input.node.type === 'table' ? undefined : registry.get('dataTable')?.component;
  return Delegate && Delegate !== TableDispatcher ? <Delegate {...input} /> : <MarkdownTable {...input} />;
}
