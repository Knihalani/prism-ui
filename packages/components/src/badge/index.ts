import { defineComponent, registerComponent } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { Badge } from './badge';

export { Badge, useBadge } from './badge';
export type { BadgeProps } from './badge';
export const badgeDef = defineComponent({
  name: 'badge', component: Badge, syntax: 'inline', inline: true,
  schema: s.object({ id: s.string().optional().describe('Stable instance identifier'), tone: s.enum(['neutral', 'accent', 'info', 'success', 'warning', 'danger']).default('neutral').describe('Semantic tone'), variant: s.enum(['soft', 'solid', 'outline']).default('soft').describe('Pill style'), size: s.enum(['sm', 'md']).default('sm').describe('Pill size'), dot: s.boolean().default(false).describe('Show status dot') }),
  docs: 'An inline status or category label.',
  examples: [':badge[New]{tone=success}'],
});
registerComponent(badgeDef);
