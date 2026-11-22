import { useMemo, useState } from 'react';
import { useComponentState, useSent, type PrismContextValue } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { filter, prepare } from '../lib/fuzzy';
import { format } from '../lib/format';

export interface DataTableColumn {
  key: string; label?: string; type?: 'text' | 'number' | 'currency' | 'date';
  align?: 'left' | 'center' | 'right'; format?: 'text' | 'number' | 'currency' | 'percent' | 'compact' | 'date' | 'datetime'; currency?: string;
  magnitude?: boolean; badge?: boolean; detail?: boolean;
}
export type DataTableRow = Record<string, unknown>;
export interface DataTableProps {
  id?: string; title?: string; subtitle?: string; caption?: string; columns?: DataTableColumn[]; rows?: DataTableRow[];
  pageSize?: number; selectable?: boolean; select?: 'single' | 'multiple'; filter?: boolean;
  height?: number; density?: 'compact' | 'comfortable' | 'spacious'; complete?: boolean;
}
export interface DataTableSelection { rows: DataTableRow[]; indices: number[] }
export const dataTableSchema = s.object({
  id: s.string().optional().describe('Stable state id.'),
  title: s.string().optional().describe('Table heading.'),
  subtitle: s.string().optional().describe('Supporting context below the heading.'),
  caption: s.string().optional().describe('Accessible table caption.'),
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
  filter: s.boolean().optional().describe('Show fuzzy search (default true).'),
  height: s.number({ min: 80 }).optional().describe('Max scroll height (px). Default: 360 when virtualized, otherwise fit page.'),
  density: s.enum(['compact', 'comfortable', 'spacious']).optional().describe('Row spacing override.'),
}).example({
  columns: [{
    key: 'name', label: 'Name', type: 'text', align: undefined, format: undefined,
    currency: undefined, magnitude: undefined, badge: undefined, detail: undefined,
  }],
  rows: [{ name: 'Ada' }], pageSize: 10, selectable: true,
  id: undefined, title: undefined, subtitle: undefined, caption: undefined, select: undefined,
  filter: undefined, height: undefined, density: undefined,
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
export function useDataTable(props: DataTableProps, ctx: PrismContextValue) {
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
  return { columns, entries, ordered, visible, selected, selection, mode, sort, query, complete, currentPage, pageCount, paged, pageSize, offset,
    rowHeight, height, virtual, start, end, focusIndex, setFocusIndex, setScrollTop, pageSelected, selectedOnPage, sent, resetSent: reset,
    count: ordered.length, range: ordered.length ? `${offset + 1}–${limit && !virtual ? Math.min(offset + limit, ordered.length) : ordered.length} of ${ordered.length}` : '0 of 0',
    announcement: `${ordered.length} rows${complete && query ? ` matching ${query}` : ''}. ${complete && sort ? `Sorted by ${columns.find(column => column.key === sort.key)?.label ?? sort.key} ${sort.direction === 'asc' ? 'ascending' : 'descending'}.` : complete ? 'Original order.' : 'Loading rows.'}`,
    changeQuery(value: string) { resetPage(() => setQuery(value)); },
    changePage(value: number) { setPage(Math.min(pageCount - 1, Math.max(0, value))); },
    toggleSort(key: string) { if (complete) resetPage(() => setSort(old => old?.key !== key ? { key, direction: 'asc' } : old.direction === 'asc' ? { key, direction: 'desc' } : null)); },
    toggleRow(index: number) { if (!mode) return; setSelection(old => old.includes(index) ? old.filter(value => value !== index) : mode === 'single' ? [index] : [...old, index]); },
    togglePage() { if (mode !== 'multiple') return; const ids = paged.map(entry => entry.index); setSelection(old => pageSelected ? old.filter(index => !ids.includes(index)) : [...new Set([...old, ...ids])]); },
    submit() { const payload: DataTableSelection = { rows: selected.map(entry => entry.row), indices: selected.map(entry => entry.index) }; send('select', payload); },
  };
}
