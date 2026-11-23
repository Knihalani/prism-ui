import { createContext, createElement, forwardRef, useContext, useRef, type ComponentPropsWithRef, type ComponentType, type CSSProperties, type ElementType, type ReactElement } from 'react';
import type { Store } from '@prism-ui/state';
import type { Node } from '@prism-ui/core';
import type { Registry, ComponentDef } from './registry';
import { ThemeContext, type Theme, type ResolvedTheme } from './theme';
import type { Format } from './format';
import type { Receipt } from './presentation';
import { SkeletonPart } from './skeleton';
import { ReplyEntryContext } from './reply-entry';

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
  feedback?: boolean;
  resolvedTheme: ResolvedTheme;
  customization?: { slots: Slots; classNames: ClassNames; styles: Styles };
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
  const { animate, unstyled, customization, classNames, styles } = usePrism(), theme = useContext(ThemeContext).theme.components[component];
  const entry = useContext(ReplyEntryContext);
  const className = customization ? customization.classNames[component]?.[part] ?? theme?.classNames?.[part] : classNames[component]?.[part];
  const style = customization ? { ...theme?.styles?.[part], ...customization.styles[component]?.[part] } : styles[component]?.[part];
  return { className: cx(!unstyled && `prism-${component}__${part}`, className) || undefined,
    style: part === 'root' && animate && !unstyled && entry ? { ...style, '--prism-motion-index': entry.index } as CSSProperties : style,
    'data-prism': component, 'data-part': part, 'data-state': state };
}
export function useSlot<T extends ComponentType<any>>(component: string, part: string, Default: T): T {
  const prism = usePrism(), theme = useContext(ThemeContext).theme;
  return (prism.customization ? prism.customization.slots[component]?.[part] ?? theme.components[component]?.slots?.[part] ?? Default : prism.slots[component]?.[part] ?? Default) as T;
}
export function useStrings(component: string, fallback: Record<string, string> = {}, suppliedProps?: object): Record<string, string> {
  const prism = useContext(PrismContext), current = useContext(ComponentContext), theme = useContext(ThemeContext).theme;
  const defaults = { ...fallback, ...prism?.registry.get(component)?.strings };
  const props = (suppliedProps ?? (current?.name === component ? current.props : {})) as Record<string, unknown>;
  const labels = props.labels && typeof props.labels === 'object' ? props.labels : {};
  return { ...defaults, ...labels, ...Object.fromEntries(Object.entries(props).filter(([, value]) => typeof value === 'string')), ...theme.components[component]?.strings } as Record<string, string>;
}
export const PrismPart = forwardRef<any, { as?: ElementType; slotProps?: Record<string, unknown>; [key: string]: any }>(function PrismPart({ as = 'div', slotProps, ...props }, ref) {
  const prism = useContext(PrismContext);
  const entry = useContext(ReplyEntryContext), history = useRef(entry?.history ?? false);
  if (history.current && prism?.animate && !prism.unstyled) props['data-prism-entered'] = '';
  const theme = useContext(ThemeContext).theme, component = props['data-prism'], part = props['data-part'];
  const Custom = prism?.customization ? prism.customization.slots[component]?.[part] ?? theme.components[component]?.slots?.[part] : prism?.slots[component]?.[part];
  const elementProps = { ...props, ...(Custom ? { as, ...slotProps } : {}) };
  if (typeof as === 'string' && (props['data-prism-skeleton'] !== undefined || ['skeleton', 'skeleton-line', 'stepPlaceholder'].includes(part))) {
    return createElement(SkeletonPart, { element: (Custom ?? as) as ElementType, elementProps, ref });
  }
  return createElement(Custom ?? as, { ...elementProps, ref });
}) as <T extends ElementType = 'div'>(props: { as?: T; slotProps?: Record<string, unknown> } & Omit<ComponentPropsWithRef<T>, 'as'>) => ReactElement;
export function useStore() { return usePrism().store; }
export function useFormat() { return usePrism().format; }
export function message(action: Pick<Action, 'type' | 'component' | 'payload'>): string {
  let payload = ''; try { payload = JSON.stringify(action.payload) ?? ''; } catch { payload = '[unserializable]'; }
  return action.type === 'ask' ? `Tell me more about this ${action.component}…` : `User ${action.type} in ${action.component}: ${payload.slice(0, 160)}`;
}
