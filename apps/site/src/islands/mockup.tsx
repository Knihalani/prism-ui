import { mockupDefinition, mockupPlugin } from '@prism-ui/components/mockup';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/mockup.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([mockupDefinition]), plugins: [mockupPlugin] }, { deferContentHydration: true }); }
