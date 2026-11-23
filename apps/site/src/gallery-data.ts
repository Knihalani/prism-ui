import { defaultRegistry, type ComponentDef } from '@prism-ui/react';
import { formatSource } from './format-source';

export const groups = ['Decisions & inputs', 'Data', 'Structure', 'Content', 'Artifacts'] as const;
const categories: Record<string, typeof groups[number]> = {
  ask: 'Decisions & inputs', pick: 'Decisions & inputs', estimate: 'Decisions & inputs', num: 'Decisions & inputs', calc: 'Decisions & inputs',
  chart: 'Data', dataTable: 'Data', table: 'Data',
  grid: 'Structure', tabs: 'Structure', tab: 'Structure', card: 'Structure', view: 'Structure',
  artifact: 'Artifacts', mockup: 'Artifacts',
};
export function category(name: string) { return categories[name] ?? 'Content'; }
export function components() { return defaultRegistry.list().sort((a, b) => a.name.localeCompare(b.name)); }
export function description(def: ComponentDef) { return def.docs?.split(/(?<=\.)\s/)[0] ?? 'A component for model-authored replies.'; }
export function examples(def: ComponentDef) { return def.examples?.length ? def.examples.map(formatSource) : ['']; }

export type Property = { name: string; type: string; defaultValue: string; required: boolean; description: string };
type SchemaInfo = NonNullable<ComponentDef['schema']>;
export function properties(schema?: SchemaInfo, prefix = ''): Property[] {
  if (!schema) return [];
  if (!schema.shape) return [{ name: prefix || 'value', type: schema.type, defaultValue: JSON.stringify(schema.defaultValue) ?? '—', required: !schema.isOptional && schema.defaultValue === undefined, description: schema.description }];
  return Object.entries(schema.shape).flatMap(([key, value]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    return [{ name, type: value.type, defaultValue: JSON.stringify(value.defaultValue) ?? '—', required: !value.isOptional && value.defaultValue === undefined, description: value.description }, ...(value.shape ? properties(value, name) : [])];
  });
}

export function slotSnippet(def: ComponentDef) {
  const part = def.parts?.includes('root') ? 'root' : def.parts?.[0];
  if (!part) return '// This component declares no replaceable parts.';
  return `import { forwardRef, type ComponentPropsWithRef } from 'react';\nimport { Prism, type Slots } from '@prism-ui/react';\n\nconst MySlot = forwardRef<HTMLDivElement, ComponentPropsWithRef<'div'>>(\n  function MySlot({ children, ...props }, ref) {\n    return <div {...props} ref={ref}>{children}</div>;\n  }\n);\n\nconst slots = { ${JSON.stringify(def.name)}: { ${JSON.stringify(part)}: MySlot } } satisfies Slots;\n\n<Prism source={source} slots={slots} />`;
}
