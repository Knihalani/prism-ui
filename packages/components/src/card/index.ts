import { defineComponent, registerComponent } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { Card } from './card';

export { Card, useCard } from './card';
export type { CardProps } from './card';
export const cardDef = defineComponent({
  name: 'card', component: Card, syntax: 'container',
  schema: s.object({ id: s.string().optional().describe('Stable instance identifier'), title: s.string().optional().describe('Card title'), subtitle: s.string().optional().describe('Supporting description'), image: s.string().optional().describe('Top media URL'), href: s.string().optional().describe('Title destination URL'), action: s.string().optional().describe('Primary action label'), variant: s.enum(['elevated', 'outline', 'ghost']).default('outline').describe('Surface style'), size: s.enum(['sm', 'md', 'lg']).default('md').describe('Card spacing') }),
  docs: 'Present one idea with optional media and a primary selection action.',
  examples: [':::card{title="Launch plan" action="Choose"}\nA focused proposal.\n:::'],
});
registerComponent(cardDef);
