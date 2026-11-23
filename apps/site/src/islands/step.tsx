import { runbookDefinition, stepDefinition } from '@prism-ui/components/runbook';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/runbook.css';
import { mount as hydrate, createRegistry } from './example';
export function mount(element: HTMLElement) { return hydrate(element, { registry: createRegistry([runbookDefinition, stepDefinition]) }); }
