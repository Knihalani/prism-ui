import type { ComponentType, ReactNode } from 'react';
import type { Node } from '@prism-ui/core';
import { toPromptDocs as docs, s, type Schema, type Infer, type Issue, type Definition } from '@prism-ui/schema';
import type { Action } from './context';

export interface PrismComponentProps<P = Record<string, unknown>> {
  node: Node; props: P; children: ReactNode; id: string; complete: boolean; partial: boolean; issues: Issue[];
}
export interface ComponentDef<S extends Schema<any> = Schema<any>> {
  name: string; schema?: S; component: ComponentType<PrismComponentProps<Infer<S>>>;
  fallback?: ComponentType<PrismComponentProps<Infer<S>>>;
  skeleton?: ComponentType<PrismComponentProps<Infer<S>>>;
  requiresFinalId?: boolean;
  parts?: string[];
  strings?: Record<string, string>;
  docs?: string; examples?: string[]; inline?: boolean; syntax?: Definition['syntax'];
  message?(action: Action): string;
}
export function defineComponent<S extends Schema<any>>(def: ComponentDef<S>): ComponentDef<S> { return def; }
export function createRegistry(defs: ComponentDef[] = []) {
  const map = new Map(defs.map(def => [def.name, def]));
  return {
    register<S extends Schema<any>>(def: ComponentDef<S>) { map.set(def.name, def); },
    get(name: string) { return map.get(name); },
    list() { return [...map.values()]; },
    docs(): string { return toPromptDocs([...map.values()]); },
  };
}
export type Registry = ReturnType<typeof createRegistry>;
export const defaultRegistry = createRegistry();
export function registerComponent<S extends Schema<any>>(def: ComponentDef<S>) { defaultRegistry.register(def); }
const emptySchema = s.object({});
export function toPromptDocs(defs: Registry | readonly ComponentDef[]): string {
  const list = 'list' in defs ? defs.list() : defs;
  return docs(list.map(def => ({ ...def, schema: def.schema ?? emptySchema })));
}
