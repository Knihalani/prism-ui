import { useContext, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ComponentContext, useComponentState, useEmit, useFlash, useSent, useStrings, useTheme, type PrismContextValue } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { filter, prepare } from '../lib/fuzzy';
import { format } from '../lib/format';
import { componentStrings } from '../strings';
import { interpolate } from '../interpolate';
import { useFrame } from '../frame';
import { createFlip } from '../lib/flip';

export interface DataTableColumn {
  key: string; label?: string; type?: 'text' | 'number' | 'currency' | 'date';
  align?: 'left' | 'center' | 'right'; format?: 'text' | 'number' | 'currency' | 'percent' | 'compact' | 'date' | 'datetime'; currency?: string;
  magnitude?: boolean; badge?: boolean; detail?: boolean;
}
export type DataTableRow = Record<string, unknown>;
export interface DataTableEntry { row: DataTableRow; index: number; cells: string[] }
export const dataTableStrings = { ...componentStrings.datatable, title: '', tableLabel: 'Data table', showAllColumns: 'Show all columns', sortBy: 'Sort by {column}', selectRow: 'Select row {row}', noMatches: 'No rows match “{query}”', selectedCount: '{count} selected', rowCount: '{count} rows', range: '{start}–{end} of {count}', emptyRange: '0 of 0', matching: ' matching {query}', sorted: 'Sorted by {column} {direction}.', ascending: 'ascending', descending: 'descending', originalOrder: 'Original order.', loadingRows: 'Loading rows.', announcement: '{count} rows{matching}. {order}', useSelected: 'Use {count} selected', askMessage: 'Tell me more about this table…', selectMessage: 'Use {count} selected rows.' };

export interface DataTableProps {
  labels?: Partial<typeof dataTableStrings>; id?: string; title?: string; subtitle?: string; caption?: string; columns?: DataTableColumn[]; rows?: DataTableRow[];
  pageSize?: number; selectable?: boolean; select?: 'single' | 'multiple'; filter?: boolean;
  actionLabel?: string; actionHint?: string;
  height?: number; density?: 'compact' | 'comfortable' | 'spacious'; complete?: boolean;
}
export interface DataTableSelection { rows: DataTableRow[]; indices: number[] }
export const dataTableSchema = s.object({
  id: s.string().optional().describe('Stable state id.'),
  title: s.string().optional().describe('Table heading.'),
  subtitle: s.string().optional().describe('Supporting context below the heading.'),
  caption: s.string().optional().describe('Accessible table caption.'),
  labels: s.any().optional().describe('String overrides; theme strings take precedence.'),
  columns: s.array(s.object({
    key: s.string().describe('Row object key.'), label: s.string().optional().describe('Column heading; defaults to key.'),
    type: s.enum(['text', 'number', 'currency', 'date']).optional().describe('Value type; inferred by default.'),
    align: s.enum(['left', 'center', 'right']).optional().describe('Header/cell alignment; numbers default right.'),
    format: s.enum(['text', 'number', 'currency', 'percent', 'compact', 'date', 'datetime']).optional().describe('Intl display format.'),
    currency: s.string().optional().describe('ISO currency code; defaults to Prism currency.'),
    magnitude: s.boolean().optional().describe('Show a magnitude rail for numeric values.'),
    badge: s.boolean().optional().describe('Display cell text as a status badge.'),
    detail: s.boolean().optional().describe('Tuck this column behind Show all columns on narrow screens.'),
  })).optional().describe('Ordered columns; defaults to first-row keys.'),
  rows: s.array(s.any()).optional().describe('Row objects. select emits {rows, indices}: original objects and zero-based input positions, in input order.'),
  pageSize: s.number({ min: 0, step: 1 }).optional().describe('Rows/page. Default 0: all rows, windowed above 200.'),
  selectable: s.boolean().optional().describe('Enable checkboxes and Use N selected.'),
  select: s.enum(['single', 'multiple']).optional().describe('Enable selection; selectable defaults to multiple.'),
  actionLabel: s.string().optional().describe('Label for the action that submits the selected rows.'),
  actionHint: s.string().optional().describe('Supporting text next to the selection action.'),
  filter: s.boolean().optional().describe('Show fuzzy search (default true).'),
  height: s.number({ min: 80 }).optional().describe('Max scroll height (px). Default: 360 when virtualized, otherwise fit page.'),
  density: s.enum(['compact', 'comfortable', 'spacious']).optional().describe('Row spacing override.'),
}).example({
  columns: [{
    key: 'name', label: 'Name', type: 'text', align: undefined, format: undefined,
    currency: undefined, magnitude: undefined, badge: undefined, detail: undefined,
  }],
  rows: [{ name: 'Ada' }], pageSize: 10, selectable: true,
  id: undefined, title: undefined, subtitle: undefined, caption: undefined, select: undefined, labels: undefined,
  filter: undefined, height: undefined, density: undefined, actionLabel: undefined, actionHint: undefined,
});

const emptyRows: DataTableRow[] = [];
export function inferType(values: unknown[]): DataTableColumn['type'] {
  const present = values.filter(value => value != null && value !== '');
  if (!present.length) return 'text';
  if (present.every(value => typeof value === 'number' || /^-?(?:\d[\d,]*)(?:\.\d+)?%?$/.test(String(value)))) return 'number';
  if (present.every(value => /^[$€£¥]-?[\d,]+(?:\.\d+)?$/.test(String(value)))) return 'currency';
  if (present.every(value => /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(String(value)) && Number.isFinite(Date.parse(String(value))))) return 'date';
  return 'text';
}
function numeric(value: unknown) { return typeof value === 'number' ? value : Number(String(value).replace(/[$€£¥,%\s]/g, '')); }
function scalar(value: unknown) { return value == null || ['string', 'number', 'boolean'].includes(typeof value) ? value : undefined; }
function inferCurrency(value: unknown) { return ({ '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' } as Record<string, string>)[String(value)[0]]; }
export function numericCell(input: unknown, column: DataTableColumn): number | undefined {
  const value = scalar(input);
  const kind = column.format ?? column.type ?? 'text';
  if (!['number', 'currency', 'compact', 'percent'].includes(kind) || value == null || value === '') return;
  return numeric(value);
}
export function formatCell(input: unknown, column: DataTableColumn, context: PrismContextValue['format'], intermediate?: number) {
  const value = scalar(input);
  return format(intermediate ?? numericCell(value, column) ?? value, column.format ?? column.type ?? 'text', {
    locale: context.locale, currency: column.currency ?? (column.type === 'currency' ? inferCurrency(value) : undefined) ?? context.currencyCode,
    fallback: value == null ? '' : String(value),
  });
}
function useDataTableState(props: DataTableProps, ctx: PrismContextValue) {
  const defaults = { ...dataTableStrings, ...ctx.registry.get('dataTable')?.strings };
  const canonical = useStrings('dataTable', defaults), theme = useTheme().theme, component = useContext(ComponentContext);
  const delegated = component?.name === 'table' ? component.props : {};
  const labels = delegated.labels && typeof delegated.labels === 'object' ? delegated.labels : {};
  const strings = { ...canonical, ...labels, ...Object.fromEntries(Object.entries(delegated).filter(([, value]) => typeof value === 'string')), ...theme.components.datatable?.strings, ...theme.components.table?.strings, ...theme.components.dataTable?.strings } as Record<string, string>;

  const rows = Array.isArray(props.rows) ? props.rows : emptyRows, complete = props.complete !== false;
  const columns = useMemo(() => {
    const first = rows.find(row => row && typeof row === 'object' && !Array.isArray(row));
    return (Array.isArray(props.columns) ? props.columns.filter(column => column && typeof column.key === 'string' && column.key) : Object.keys(first ?? {}).map(key => ({ key } as DataTableColumn))).map(column => {
      const type = ['text', 'number', 'currency', 'date'].includes(column.type!) ? column.type : inferType(rows.map(row => scalar(row?.[column.key])));
      const format = ['text', 'number', 'currency', 'percent', 'compact', 'date', 'datetime'].includes(column.format!) ? column.format : undefined;
      const numericFormat = ['number', 'currency', 'percent', 'compact'].includes(format ?? type ?? '');
      return { key: column.key, type, label: typeof column.label === 'string' ? column.label : column.key,
        align: ['left', 'center', 'right'].includes(column.align!) ? column.align : numericFormat ? 'right' : 'left',
        format,
        currency: typeof column.currency === 'string' ? column.currency : undefined,
        magnitude: column.magnitude === true, badge: column.badge === true, detail: column.detail === true };
    });
  }, [rows, props.columns]);
  const [sort, setSort] = useComponentState<{ key: string; direction: 'asc' | 'desc' } | null>('sort', null);
  const [query, setQuery] = useComponentState('filter', '');
  const [page, setPage] = useComponentState('page', 0);
  const [selection, setSelection] = useComponentState<number[]>('selection', []);
  const [scrollTop, setScrollTop] = useState(0), [focusIndex, setFocusIndex] = useState<number | null>(null);
  const { sent, send, reset } = useSent(), mode = props.select ?? (props.selectable ? 'multiple' : undefined);
  const entries = useMemo(() => rows.flatMap((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return [];
    const cells = columns.map(column => formatCell(row[column.key], column, ctx.format));
    return [{ row, index, cells }];
  }), [rows, columns, ctx.format]);
  const search = useMemo(() => prepare(entries, entry => entry.cells.join(' ')), [entries]);
  const ordered = useMemo(() => {
    let result = entries;
    if (complete && query.trim()) { const matches = new Set(filter(search, query).map(match => match.item.index)); result = result.filter(entry => matches.has(entry.index)); }
    if (complete && sort) {
      const column = columns.find(column => column.key === sort.key);
      if (column) result = [...result].sort((a, b) => {
        const av = scalar(a.row[sort.key]), bv = scalar(b.row[sort.key]);
        const comparison = column.type === 'date' ? Date.parse(String(av)) - Date.parse(String(bv)) : column.type === 'number' || column.type === 'currency' ? numeric(av) - numeric(bv) : String(av ?? '').localeCompare(String(bv ?? ''), ctx.format.locale, { numeric: true });
        return (Number.isNaN(comparison) ? 0 : comparison) * (sort.direction === 'asc' ? 1 : -1) || a.index - b.index;
      });
    }
    return result;
  }, [entries, search, query, sort, complete, columns, ctx.format.locale]);
  const pageSize = Math.max(0, Math.floor(Number.isFinite(props.pageSize) ? props.pageSize! : 0)), pageCount = pageSize ? Math.max(1, Math.ceil(ordered.length / pageSize)) : 1;
  const currentPage = complete ? Math.min(Math.max(0, page), pageCount - 1) : 0, offset = pageSize ? currentPage * pageSize : 0;
  const limit = pageSize || (!complete && props.pageSize !== 0 ? 8 : 0);
  const paged = useMemo(() => limit ? ordered.slice(offset, offset + limit) : ordered, [ordered, offset, limit]);
  const rowHeight = props.density === 'compact' ? 32 : props.density === 'spacious' ? 60 : 52;
  const height = typeof props.height === 'number' && Number.isFinite(props.height) ? Math.max(80, props.height) : 360, virtual = !pageSize && ordered.length > 200;
  const start = virtual ? Math.min(Math.max(0, ordered.length - 1), Math.max(0, Math.floor(scrollTop / rowHeight) - 5)) : 0;
  const end = virtual ? Math.min(ordered.length, start + Math.ceil(height / rowHeight) + 10) : paged.length;
  const visible = virtual ? ordered.slice(start, end) : paged;
  const selected = useMemo(() => entries.filter(entry => selection.includes(entry.index)), [entries, selection]);
  const selectedOnPage = paged.filter(entry => selection.includes(entry.index)).length;
  const pageSelected = !!paged.length && selectedOnPage === paged.length;
  const resetPage = (change: () => void) => { ctx.store.batch(() => { change(); setPage(0); }); setScrollTop(0); };
  return { strings, columns, entries, ordered, visible, selected, selection, mode, sort, query, complete, currentPage, pageCount, paged, pageSize, offset,
    rowHeight, height, virtual, start, end, focusIndex, setFocusIndex, setScrollTop, pageSelected, selectedOnPage, sent, resetSent: reset,
    count: ordered.length, range: ordered.length ? interpolate(strings.range, { start: offset + 1, end: limit && !virtual ? Math.min(offset + limit, ordered.length) : ordered.length, count: ordered.length }) : strings.emptyRange,
    announcement: interpolate(strings.announcement, { count: ordered.length, matching: complete && query ? interpolate(strings.matching, { query }) : '', order: complete && sort ? interpolate(strings.sorted, { column: columns.find(column => column.key === sort.key)?.label ?? sort.key, direction: strings[sort.direction === 'asc' ? 'ascending' : 'descending'] }) : complete ? strings.originalOrder : strings.loadingRows }),
    changeQuery(value: string) { resetPage(() => setQuery(value)); },
    changePage(value: number) { setPage(Math.min(pageCount - 1, Math.max(0, value))); },
    toggleSort(key: string) { if (complete) resetPage(() => setSort(old => old?.key !== key ? { key, direction: 'asc' } : old.direction === 'asc' ? { key, direction: 'desc' } : null)); },
    toggleRow(index: number) { if (!mode) return; setSelection(old => old.includes(index) ? old.filter(value => value !== index) : mode === 'single' ? [index] : [...old, index]); },
    togglePage() { if (mode !== 'multiple') return; const ids = paged.map(entry => entry.index); setSelection(old => pageSelected ? old.filter(index => !ids.includes(index)) : [...new Set([...old, ...ids])]); },
    submit() { const payload: DataTableSelection = { rows: selected.map(entry => entry.row), indices: selected.map(entry => entry.index) }; send('select', payload, interpolate(strings.selectMessage, { count: selected.length })); },
  };
}

function reference(value: unknown) { return value && typeof value === 'object' && Object.hasOwn(value, '$ref') && '$ref' in value && typeof value.$ref === 'string' ? value.$ref : undefined; }
function cellPath(rows: unknown, index: number, key: string) {
  const row = Array.isArray(rows) ? rows[index] : undefined, cell = row && typeof row === 'object' && Object.hasOwn(row, key) ? row[key] : undefined;
  const direct = reference(cell); if (direct !== undefined) return direct;
  const rowsPath = reference(rows), rowPath = reference(row) ?? (rowsPath === undefined ? undefined : `${rowsPath}.${index}`);
  return rowPath === undefined ? undefined : key.includes('.') ? rowPath : `${rowPath}.${key}`;
}
export function useDataTable(props: DataTableProps, ctx: PrismContextValue, rawRows?: unknown) {
  const vm = useDataTableState(props, ctx), emit = useEmit(), { mode: appearance, theme } = useTheme();
  const frame = useFrame({ component: 'datatable', title: vm.strings.title, undo: true });
  const scroll = useRef<HTMLDivElement>(null), pageCheckbox = useRef<HTMLInputElement>(null), tableId = useId(), hintId = useId();
  const [showDetails, setShowDetails] = useState(false);
  const [hostBackground, setHostBackground] = useState<string>();
  useLayoutEffect(() => {
    let element: HTMLElement | null = scroll.current;
    while (element) {
      const background = getComputedStyle(element).backgroundColor;
      const alphaText = background.startsWith('rgba(') ? background.split(',').at(-1) : background.split('/')[1];
      const alpha = alphaText ? parseFloat(alphaText) / (alphaText.includes('%') ? 100 : 1) : 1;
      if (background && background !== 'transparent' && alpha >= 1) { setHostBackground(background); return; }
      element = element.parentElement;
    }
    setHostBackground(undefined);
  }, [appearance, theme, ctx.styles.datatable?.root, ctx.styles.datatable?.scroll]);
  const flip = useRef<ReturnType<typeof createFlip> | null>(null), sortPending = useRef(false), resizeAnimation = useRef<Animation | undefined>(undefined);
  const preview = useRef<{ height: number; pageSize: number } | undefined>(undefined);
  const selectionKey = JSON.stringify(vm.selected.map(entry => [entry.index, ...entry.cells])), previousSelection = useRef(selectionKey);
  const magnitudes = useMemo(() => vm.columns.map(column => !ctx.unstyled && column.magnitude ? vm.entries.reduce((max, entry) => { const value = numericCell(entry.row[column.key], column) ?? 0; return Number.isFinite(value) ? Math.max(max, Math.abs(value)) : max; }, 0) : 0), [vm.columns, vm.entries, ctx.unstyled]);
  const columnCount = vm.columns.length + Number(Boolean(vm.mode)), missing = Math.max(0, (vm.pageSize || 3) - vm.visible.length), skeletonCount = vm.complete ? 0 : missing;
  const elements = () => Array.from(scroll.current?.querySelectorAll('tr[data-index]') ?? []);
  const motion = () => {
    if (!ctx.animate || ctx.unstyled || typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return { duration: 0, easing: 'linear' };
    const style = scroll.current && getComputedStyle(scroll.current), token = style?.getPropertyValue('--prism-datatable-motion-base').trim() || style?.getPropertyValue('--prism-motion-base').trim() || '0ms';
    return { duration: parseFloat(token) * (token.endsWith('ms') ? 1 : 1000) || 0, easing: style?.getPropertyValue('--prism-datatable-motion-spring').trim() || style?.getPropertyValue('--prism-motion-spring').trim() || 'linear' };
  };
  useLayoutEffect(() => { if (previousSelection.current !== selectionKey) { previousSelection.current = selectionKey; vm.resetSent(); } }, [selectionKey, vm.resetSent]);
  useLayoutEffect(() => { if (pageCheckbox.current) pageCheckbox.current.indeterminate = vm.selectedOnPage > 0 && !vm.pageSelected; }, [vm.selectedOnPage, vm.pageSelected]);
  useLayoutEffect(() => { if (sortPending.current) { sortPending.current = false; if (ctx.animate) flip.current?.play(elements()); else flip.current?.cancel(); } }, [vm.sort, ctx.animate]);
  useLayoutEffect(() => () => { flip.current?.cancel(); resizeAnimation.current?.cancel(); }, [ctx.animate, ctx.unstyled]);
  useLayoutEffect(() => { if (vm.focusIndex !== null) scroll.current?.querySelector<HTMLElement>(`tr[data-index="${vm.focusIndex}"]`)?.focus({ preventScroll: true }); }, [vm.focusIndex, vm.start]);
  useLayoutEffect(() => {
    const element = scroll.current; if (!element) return;
    const before = preview.current, height = element.offsetHeight;
    preview.current = vm.complete ? undefined : { height, pageSize: vm.pageSize };
    if (before && before.pageSize !== vm.pageSize) resizeAnimation.current?.cancel();
    const options = motion();
    if (options.duration && vm.pageSize && before && before.pageSize !== vm.pageSize && before.height > height) resizeAnimation.current = element.animate?.([{ minHeight: before.height + 'px' }, { minHeight: height + 'px' }], options);
  }, [vm.complete, ctx.animate, ctx.unstyled, props.height, vm.pageSize, vm.rowHeight, vm.visible.length, skeletonCount]);
  const resetScroll = () => { if (scroll.current) scroll.current.scrollTop = 0; };
  const sortBy = (key: string) => { if (!vm.complete) return; resetScroll(); if (!vm.virtual) { flip.current?.cancel(); flip.current = createFlip(motion()); flip.current.measure(elements()); sortPending.current = true; } vm.toggleSort(key); };
  const payload = vm.sent?.payload as Partial<DataTableSelection> | undefined, sent = vm.sent !== undefined;
  return { ...vm, props: { ...props, actionHint: vm.strings.actionHint }, frame, scroll, pageCheckbox, tableId, hintId, appearance, hostBackground, animate: ctx.animate, unstyled: ctx.unstyled,
    presentation: Object.fromEntries(Object.entries(frame.rootProps).filter(([key]) => key.startsWith('data-'))),
    columnCount, missing, skeletonCount, showDetails, canHideDetails: !ctx.unstyled && vm.columns.some(column => column.detail) && vm.columns.some(column => !column.detail),
    toggleDetails() { setShowDetails(value => !value); }, submitted: sent,
    title: vm.strings.title, subtitle: vm.strings.subtitle, caption: vm.strings.caption,
    label: vm.strings.title || vm.strings.caption || vm.strings.tableLabel, tableLabel: vm.strings.caption || vm.strings.title || vm.strings.tableLabel,
    countLabel: vm.mode && vm.complete ? vm.selected.length ? interpolate(vm.strings.selectedCount, { count: vm.selected.length }) : vm.strings.noRowsSelected : interpolate(vm.strings.rowCount, { count: vm.count }),
    actionLabel: vm.strings.actionLabel || interpolate(vm.strings.useSelected, { count: vm.selected.length }),
    receiptLabel: interpolate(vm.strings.sent, { count: Array.isArray(payload?.indices) ? payload.indices.length : vm.selected.length }),
    emptyLabel: vm.query ? interpolate(vm.strings.noMatches, { query: vm.query }) : vm.strings.noRowsYet,
    onAsk() { emit('ask', undefined, vm.strings.askMessage); }, sortBy,
    changeQuery(value: string) { vm.changeQuery(value); resetScroll(); }, changePage(value: number) { vm.changePage(value); resetScroll(); },
    sortLabel(column: DataTableColumn) { return interpolate(vm.strings.sortBy, { column: column.label ?? column.key }); },
    sortIcon(column: DataTableColumn) { return vm.sort?.key === column.key && vm.complete ? vm.sort.direction === 'asc' ? 'arrow-up' as const : 'arrow-down' as const : 'sort' as const; },
    selectLabel(index: number) { return interpolate(vm.strings.selectRow, { row: index + 1 }); },
    onSortKeyDown(event: KeyboardEvent, key: string) { if (event.key === 'Enter') { event.preventDefault(); sortBy(key); } },
    onRowKeyDown(event: KeyboardEvent<HTMLElement>, index: number) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); const list = vm.virtual ? vm.ordered : vm.paged, position = list.findIndex(entry => entry.index === index), next = Math.max(0, Math.min(list.length - 1, position + (event.key === 'ArrowDown' ? 1 : -1))), target = list[next]; if (!target) return;
        if (vm.virtual && scroll.current) { const top = next * vm.rowHeight; if (top < scroll.current.scrollTop || top + vm.rowHeight > scroll.current.scrollTop + vm.height - vm.rowHeight) { scroll.current.scrollTop = Math.max(0, top - vm.rowHeight); vm.setScrollTop(scroll.current.scrollTop); } } vm.setFocusIndex(target.index);
      } else if (event.key === ' ' && event.target === event.currentTarget) { event.preventDefault(); vm.toggleRow(index); }
    },
    cell(entry: DataTableEntry, column: DataTableColumn) {
      const index = vm.columns.findIndex(item => item.key === column.key), value = entry.row[column.key], max = magnitudes[index], amount = max ? Math.abs(numericCell(value, column) ?? 0) / max : 0;
      return { text: entry.cells[index], value, path: ctx.unstyled ? undefined : cellPath(rawRows, entry.index, column.key), magnitude: Number.isFinite(amount) ? amount : 0 };
    },
  };
}
export type DataTableModel = ReturnType<typeof useDataTable>;
export function useDataTableCell(table: DataTableModel, entry: DataTableEntry, column: DataTableColumn) {
  const cell = table.cell(entry, column), flash = useFlash(cell.path ?? []), number = numericCell(cell.value, column);
  return { ...cell, flash, number, animated: cell.path !== undefined && table.animate && number !== undefined && Number.isFinite(number) };
}
