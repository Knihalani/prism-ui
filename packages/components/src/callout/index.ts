import { componentStrings } from '../strings';
import { defineComponent, registerComponent } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { Callout } from './callout';

export { Callout, useCallout } from './callout';
export type { CalloutProps } from './callout';
export const calloutDef = defineComponent({
  name: 'callout', parts: ["ask","body","header","icon","root","skeleton","title"], strings: componentStrings.callout, component: Callout, syntax: 'container',
  schema: s.object({ id: s.string().optional().describe('Stable instance identifier'), tone: s.enum(['info', 'success', 'warning', 'danger', 'note', 'tip']).default('info').describe('Semantic tone'), title: s.string().optional().describe('Callout title'), variant: s.enum(['soft', 'outline']).default('soft').describe('Rail style'), icon: s.boolean().default(true).describe('Show tone icon') }),
  docs: 'Highlight useful context, guidance or warnings.',
  examples: [':::callout{title="Good to know" tone=info}\nUseful context.\n:::'],
});
registerComponent(calloutDef);
