import type { DataTableColumn, DataTableEntry, DataTableRow } from '../datatable/use-datatable';
import type { PrismContextValue } from '@prism-ui/react';
import { formatCell, inferType, scalar } from './format/cell';

export function tableColumns(rows: DataTableRow[], input?: DataTableColumn[]): DataTableColumn[] {
  const first = rows.find(row => row && typeof row === 'object' && !Array.isArray(row));
  return (Array.isArray(input) ? input.filter(column => column && typeof column.key === 'string' && column.key) : Object.keys(first ?? {}).map(key => ({ key } as DataTableColumn))).map(column => {
    const type = ['text', 'number', 'currency', 'date'].includes(column.type!) ? column.type : inferType(rows.map(row => scalar(row?.[column.key])));
    const format = ['text', 'number', 'currency', 'percent', 'compact', 'date', 'datetime'].includes(column.format!) ? column.format : undefined;
    const numericFormat = ['number', 'currency', 'percent', 'compact'].includes(format ?? type ?? '');
    return { key: column.key, type, label: typeof column.label === 'string' ? column.label : column.key,
      align: ['left', 'center', 'right'].includes(column.align!) ? column.align : numericFormat ? 'right' : 'left',
      format,
      currency: typeof column.currency === 'string' ? column.currency : undefined,
      magnitude: column.magnitude === true, badge: column.badge === true, detail: column.detail === true };
  });
}
export function tableEntries(rows: DataTableRow[], columns: DataTableColumn[], context: PrismContextValue['format']): DataTableEntry[] {
  return rows.flatMap((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return [];
    const cells = columns.map(column => formatCell(row[column.key], column, context));
    return [{ row, index, cells }];
  });
}
