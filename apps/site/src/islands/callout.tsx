import { calloutDef } from '@prism-ui/components/callout';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/callout.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([calloutDef]) }); }
