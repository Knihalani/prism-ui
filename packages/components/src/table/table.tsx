import { Children, createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode, type ThHTMLAttributes } from 'react';
import type { Node } from '@prism-ui/core';
import { PrismContext, useComponentState, usePart, usePrism, useSlot, type MarkdownProps, type PrismComponentProps } from '@prism-ui/react';

export interface TableColumn { key: string; label?: string; title?: string; align?: 'left' | 'right' | 'center' }
export interface TableProps { id?: string; label?: string; title?: string; columns?: (TableColumn | string)[]; rows?: unknown[]; [key: string]: unknown }
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
function fallbackRows(props: TableProps, key: string): Node[] {
  const rows = Array.isArray(props.rows) ? props.rows : [];
  const columns: TableColumn[] = (Array.isArray(props.columns) ? props.columns : []).flatMap(column => typeof column === 'string' ? [{ key: column, label: column }] : column && typeof column.key === 'string' ? [column] : []);
  if (!columns.length && rows[0] && typeof rows[0] === 'object') columns.push(...Object.keys(rows[0]).map(key => ({ key, label: key })));
  const cell = (value: unknown, cellKey: string, header: boolean): Node => ({ type: header ? 'tableHeader' : 'tableCell', key: cellKey, children: [{ type: 'text', key: cellKey + '.0', value: valueText(value) }] });
  return [
    { type: 'tableRow', key: key + '.header', children: columns.map((column, index) => cell(column.label ?? column.title ?? column.key, key + '.header.' + index, true)) },
    ...rows.map((row, index): Node => ({ type: 'tableRow', key: key + '.row.' + index, children: columns.map((column, col) => cell(row && typeof row === 'object' ? (row as Record<string, unknown>)[column.key] : undefined, key + '.row.' + index + '.' + col, false)) })),
  ];
}

export function useTable(props: TableProps, ctx: Pick<PrismComponentProps, 'node' | 'children' | 'complete'>) {
  const { animate, format } = usePrism(), [stored, setSort] = useComponentState<TableSort>('sort', null);
  const markdown = ctx.node.type === 'table', rows = markdown ? ctx.node.children ?? [] : fallbackRows(props, ctx.node.key);
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
  const onSort = (column: number) => { if (!streaming) setSort(sort?.column !== column ? { column, dir: 'asc' } : sort.dir === 'asc' ? { column, dir: 'desc' } : null); };
  const parts = { root: usePart('table', 'root', state), scroll: usePart('table', 'scroll', state), table: usePart('table', 'table', state), head: usePart('table', 'head', state), body: usePart('table', 'body', state) };
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
  return { parts, rows, headers, order, sort, align, onSort, streaming, state, markdown, scrollRef, measure,
    rendered: Children.toArray(ctx.children),
    rootProps: { ...parts.root, 'data-prism-enter': animate ? '' : undefined, 'data-overflow-start': edges.start ? '' : undefined, 'data-overflow-end': edges.end ? '' : undefined },
    scrollProps: { ...parts.scroll, role: 'region', 'aria-label': props.label ?? props.title ?? 'Table', tabIndex: 0, onScroll: measure } };
}
const TableContext = createContext<ReturnType<typeof useTable> | null>(null);
function Row(props: HTMLAttributes<HTMLTableRowElement>) { return <tr {...props} />; }
function Header(props: ThHTMLAttributes<HTMLTableCellElement>) { return <th {...props} />; }
function Cell(props: HTMLAttributes<HTMLTableCellElement>) { return <td {...props} />; }
function Head(props: HTMLAttributes<HTMLTableSectionElement>) { return <thead {...props} />; }
function Body(props: HTMLAttributes<HTMLTableSectionElement>) { return <tbody {...props} />; }
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
    <button {...button} type="button" disabled={model.streaming} onClick={() => model.onSort(index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) model.onSort(index); } }}>{children}<svg {...icon} aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d={dir === 'asc' ? 'm3 7 3-3 3 3' : dir === 'desc' ? 'm3 5 3 3 3-3' : 'm3 4 3-2 3 2M3 8l3 2 3-2'} /></svg></button>
  </HeaderSlot>;
}
export function MarkdownTable({ props, ...ctx }: PrismComponentProps<TableProps>) {
  const model = useTable(props, ctx), prism = usePrism(), HeadSlot = useSlot('table', 'head', Head), BodySlot = useSlot('table', 'body', Body);
  const scoped = useMemo(() => ({ ...prism, components: {
    ...Object.fromEntries(Object.entries({ tableRow: TableRowView, tableHeader: TableCellView, tableCell: TableCellView }).filter(([name]) => !prism.components[name] && !prism.registry.get(name))),
    ...prism.components,
  } }), [prism]);
  const renderRow = (index: number): ReactNode => {
    const node = model.rows[index];
    if (model.markdown) return model.rendered[index];
    return <TableRowView key={node.key} node={node}>{node.children?.map(cell => <TableCellView key={cell.key} node={cell}>{text(cell)}</TableCellView>)}</TableRowView>;
  };
  return <TableContext.Provider value={model}><PrismContext.Provider value={scoped}><div {...model.rootProps}>
    <div {...model.scrollProps} ref={model.scrollRef}><table {...model.parts.table}>
      <HeadSlot {...model.parts.head}>{model.rows.length > 0 && renderRow(0)}</HeadSlot>
      <BodySlot {...model.parts.body}>{model.order.map(index => renderRow(index + 1))}</BodySlot>
    </table></div>
  </div></PrismContext.Provider></TableContext.Provider>;
}
export function TableDispatcher(input: PrismComponentProps<TableProps>) {
  const { registry } = usePrism(), Delegate = input.node.type === 'table' ? undefined : registry.get('dataTable')?.component;
  return Delegate && Delegate !== TableDispatcher ? <Delegate {...input} /> : <MarkdownTable {...input} />;
}
