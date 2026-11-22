import { componentStrings } from '../strings';
import { defineComponent, registerComponent } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { Tabs, Tab } from './tabs';

export { Tabs, Tab, useTabs, useTab } from './tabs';
export type { TabsModel, TabsSlotProps, TabsProps, TabProps, TabModel, TabSlotProps } from './tabs';
export const tabsDef = defineComponent({
  name: 'tabs', parts: ["badge","body","indicator","linkedText","label","list","root","skeleton","tab","title"], strings: componentStrings.tabs, component: Tabs, syntax: 'container',
  schema: s.object({ id: s.string().optional().describe('Stable instance identifier'), title: s.string().optional().describe('Visible heading above the tablist'), label: s.string().optional().describe('Accessible tablist label'), variant: s.enum(['underline', 'pill']).default('underline').describe('Navigation style'), size: s.enum(['sm', 'md']).default('md').describe('Tab height'), fitted: s.boolean().default(false).describe('Fill the available width') }),
  docs: 'Group tab containers into keyboard-accessible navigation. Use four colons around tabs and three around each tab.',
  examples: ['::::tabs{label="Project"}\n:::tab{label="Overview"}\nProject overview.\n:::\n:::tab{label="Details"}\nProject details.\n:::\n::::'],
});
export const tabDef = defineComponent({
  name: 'tab', parts: ["body","root","title"], strings: {}, component: Tab, syntax: 'container',
  schema: s.object({ id: s.string().optional().describe('Stable instance identifier'), label: s.string().describe('Tab label'), badge: s.string().optional().describe('Optional count or status') }),
  docs: 'A mounted panel inside tabs; renders as a titled section outside tabs.',
  examples: [':::tab{label="Overview" badge="3"}\nPanel content.\n:::'],
});
registerComponent(tabsDef);
registerComponent(tabDef);
