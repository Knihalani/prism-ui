import { askDefinition } from '@prism-ui/components/ask';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/ask.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([askDefinition]) }); }
