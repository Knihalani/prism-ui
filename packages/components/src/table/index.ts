import { defineComponent, registerComponent } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { TableDispatcher } from './table';

export { MarkdownTable, TableDispatcher, useTable } from './table';
export type { TableProps, TableColumn, TableSort } from './table';
export const tableDef = defineComponent({
  name: 'table', component: TableDispatcher, syntax: 'fence',
  schema: s.any().describe('Optional id, label, title, columns (key/label/align) and rows; additional dataTable props are preserved'),
  docs: 'GFM pipe tables have sortable columns and a scrollable sticky header. A ui:table fence accepts optional columns and rows, and delegates unchanged to dataTable when registered.',
  examples: ['| Plan | Price |\n| --- | ---: |\n| Pro | $20 |', '```ui:table\n{"columns":[{"key":"plan","label":"Plan"}],"rows":[{"plan":"Pro"}]}\n```'],
});
registerComponent(tableDef);
