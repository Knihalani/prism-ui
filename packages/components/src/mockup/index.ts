import { registerComponent } from '@prism-ui/react';
import { mockupDefinition } from './mockup';

registerComponent(mockupDefinition);
export { Mockup, MockupView, mockupDefinition, mockupSchema } from './mockup';
export { useMockup, mockupLabels } from './use-mockup';
export type { MockupProps, MockupLabels, MockupDevice, MockupOptions, MockupModel } from './use-mockup';
export { mockupPlugin, parseMockupMeta } from './plugin';
export * from './engine';
export { GroupedMockup, useMockupGroup } from './group';
export type { MockupGroupPayload } from './group';

export type { MockupSlotProps } from './mockup';
export type { MockupGroupModel } from './group';

export type { MockupFooterModel } from './chrome';
