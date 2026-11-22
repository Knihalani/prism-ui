import { defineComponent, registerComponent } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { Grid } from './grid';

export { Grid, useGrid } from './grid';
export type { GridProps } from './grid';
export const gridDef = defineComponent({
  name: 'grid', parts: ["body","header","meta","root","title"], strings: {}, component: Grid, syntax: 'container',
  schema: s.object({ id: s.string().optional().describe('Stable instance identifier'), title: s.string().optional().describe('Grid heading'), meta: s.string().optional().describe('Short detail alongside the heading'), cols: s.number({ min: 1, max: 6, step: 1 }).default(2).describe('Maximum column count'), gap: s.enum(['sm', 'md', 'lg']).default('md').describe('Space between items'), min: s.number({ min: 1 }).default(190).describe('Minimum column width in pixels') }),
  docs: 'Arrange arbitrary content in responsive equal-height columns.',
  examples: [':::grid{cols=3}\nContent\n:::'],
});
registerComponent(gridDef);
