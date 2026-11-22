import { createContext, createElement, forwardRef, useContext, type ComponentType, type CSSProperties, type ElementType } from 'react';
import type { Store } from '@prism-ui/state';
import type { Node } from '@prism-ui/core';
import type { Registry, ComponentDef } from './registry';
import type { Theme, ResolvedTheme } from './theme';
import type { Format } from './format';
import type { Receipt } from './presentation';

export interface Action {
  type: string; component: string; id: string; payload: unknown;
  context: { component: string; props: Record<string, unknown>; state: unknown }; message: string;
}
export type Middleware = (action: Action, next: (action: Action) => void) => void;
export type Components = Record<string, ComponentType<any>>;
export type Slots = Record<string, Record<string, ComponentType<any>>>;
export type ClassNames = Record<string, Record<string, string>>;
export type Styles = Record<string, Record<string, CSSProperties>>;
export interface PrismContextValue {
  registry: Registry; components: Components; store: Store; emit(action: Action, delivered?: (action: Action) => void): void;
  theme: Theme; unstyled: boolean; slots: Slots; classNames: ClassNames; styles: Styles; format: Format; animate: boolean;
  applied: Set<string>;
  scope: string;
  resolvedTheme: ResolvedTheme;
}
export const PrismContext = createContext<PrismContextValue | null>(null);
export const ComponentContext = createContext<{
  name: string; id: string; props: Record<string, unknown>; node: Node; def?: ComponentDef;
  settled?: boolean; receipt?: Receipt;
} | null>(null);
export function usePrism(): PrismContextValue {
  const value = useContext(PrismContext); if (!value) throw Error('Prism provider required'); return value;
}
export const cx = (...values: (string | false | null | undefined)[]) => values.filter(Boolean).join(' ');
export function usePart(component: string, part: string, state?: string) {
  const { unstyled, classNames, styles } = usePrism();
  return { className: cx(!unstyled && `prism-${component}__${part}`, classNames[component]?.[part]) || undefined, style: styles[component]?.[part], 'data-prism': component, 'data-part': part, 'data-state': state };
}
export function useSlot<T extends ComponentType<any>>(component: string, part: string, Default: T): T { return (usePrism().slots[component]?.[part] ?? Default) as T; }
export function useStrings(component: string): Record<string, string> {
  const prism = usePrism(), current = useContext(ComponentContext);
  const defaults = prism.registry.get(component)?.strings ?? {};
  const props = current?.name === component ? current.props : {};
  return { ...defaults, ...Object.fromEntries(Object.entries(props).filter(([, value]) => typeof value === 'string')), ...prism.resolvedTheme.components[component]?.strings } as Record<string, string>;
}
export const PrismPart = forwardRef<any, { as?: ElementType; [key: string]: any }>(function PrismPart({ as = 'div', ...props }, ref) {
  const prism = useContext(PrismContext);
  const Custom = prism?.slots[props['data-prism']]?.[props['data-part']];
  return createElement(Custom ?? as, { ...props, ...(Custom ? { as } : {}), ref });
});
export function useStore() { return usePrism().store; }
export function useFormat() { return usePrism().format; }
export function message(action: Pick<Action, 'type' | 'component' | 'payload'>): string {
  let payload = ''; try { payload = JSON.stringify(action.payload) ?? ''; } catch { payload = '[unserializable]'; }
  return action.type === 'ask' ? `Tell me more about this ${action.component}…` : `User ${action.type} in ${action.component}: ${payload.slice(0, 160)}`;
}
