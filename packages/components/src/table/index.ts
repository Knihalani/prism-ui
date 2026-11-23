import { defineComponent, registerComponent } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { TableDispatcher, tableParts, tableStrings } from './table';

export { MarkdownTable, TableDispatcher, useTable } from './table';
export type { TableProps, TableColumn, TableSort, TableRow, TableModel, TablePart, TableSlotProps } from './table';
export const tableDef = defineComponent({
  name: 'table', parts: [...tableParts], strings: tableStrings, component: TableDispatcher, syntax: 'fence',
  schema: s.any().describe('Optional id, label, title, columns (key/label/align) and rows; additional dataTable props are preserved'),
  docs: 'GFM pipe tables have sortable columns and a scrollable sticky header. A ui:table fence accepts columns (key/label/type), rows and optional pageSize. The fallback formats typed cells using the current locale/currency and paginates after sorting; it delegates unchanged to dataTable when registered.',
  examples: ['| Plan | Price |\n| --- | ---: |\n| Pro | $20 |', '```ui:table\n{"columns":[{"key":"plan","label":"Plan"}],"rows":[{"plan":"Pro"}]}\n```'],
});
registerComponent(tableDef);
