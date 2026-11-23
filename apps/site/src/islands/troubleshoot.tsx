import { troubleshootDefinition } from '@prism-ui/components/troubleshoot';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/troubleshoot.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([troubleshootDefinition]) }); }
