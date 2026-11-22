import { memo, useCallback, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createParser, type Node, type Plugin } from '@prism-ui/core';
import { createStore, type Store, type Adapter, type Patch } from '@prism-ui/state';
import { ComponentContext, PrismContext, cx, usePrism, type Action, type Middleware, type Components, type Slots, type ClassNames, type Styles } from './context';
import { createRegistry, defaultRegistry, type Registry } from './registry';
import { FeedbackSurface, RenderBoundary, rendererView, type Renderers } from './renderers';
import { defaultRenderers } from './markdown';
import { ThemeScope, useMotion, useTheme, type Theme, type Density, type Mode } from './theme';
import { createFormat } from './format';
import { usePrismStream, type PrismStream } from './stream';
import { useComponentId } from './identity';
import { createReceipt } from './presentation';
import './presentation.css';

const empty = {};
function equal(a: any, b: any, depth: number): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && (depth ? equal(a[key], b[key], depth - 1) : Object.is(a[key], b[key])));
}
function useStable<T>(value: T, depth = 0): T {
  const ref = useRef(value);
  if (!equal(ref.current, value, depth)) ref.current = value;
  return ref.current;
}
const safe = (key: string) => !['__proto__', 'constructor', 'prototype'].includes(key);
function bindings(value: any, resolve: (path: string) => unknown): any {
  if (!value || typeof value !== 'object') return value;
  if (Object.hasOwn(value, '$ref') && typeof value.$ref === 'string') return resolve(value.$ref);
  if (Array.isArray(value)) return value.map(v => bindings(v, resolve));
  return Object.fromEntries(Object.keys(value).filter(safe).map(key => [key, bindings(value[key], resolve)]));
}
function useBindings(node: Node, store: Store) {
  const watch = useMemo(() => {
    const paths = new Set<string>(); bindings(node.props ?? empty, path => { paths.add(path); });
    const list = [...paths]; let previous: unknown[] = [];
    return {
      subscribe(fn: () => void) { const offs = list.map(path => store.subscribe(path, fn)); return () => offs.forEach(off => off()); },
      snapshot() { const next = list.map(path => store.get(path)); if (next.length !== previous.length || next.some((v, i) => !Object.is(v, previous[i]))) previous = next; return previous; },
    };
  }, [node, store]);
  const values = useSyncExternalStore(watch.subscribe, watch.snapshot, watch.snapshot);
  return useMemo(() => bindings(node.props ?? empty, store.get), [node, store, values]);
}
const appliedNodes = new WeakMap<Set<string>, WeakSet<Node>>();
function StatePatch({ node }: { node: Node }) {
  const { store, applied } = usePrism();
  useLayoutEffect(() => {
    let nodes = appliedNodes.get(applied); if (!nodes) appliedNodes.set(applied, nodes = new WeakSet());
    if (!node.complete || !Object.isFrozen(node) || nodes.has(node)) return;
    nodes.add(node);
    const signature = JSON.stringify([node.key, node.props]);
    if (!applied.has(signature)) { applied.add(signature); store.apply(node.props as Patch); }
  }, [node, store, applied]);
  return null;
}
function Directive({ node }: { node: Node }) {
  const context = usePrism(), name = node.type === 'component' ? node.name! : node.type;
  const def = context.registry.get(name), raw = useBindings(node, context.store);
  const result = def?.schema?.coerce(raw) ?? { value: raw, issues: [], partial: false };
  const coerced = result.value ?? {}, complete = node.complete !== false;
  const { id, ready, owner } = useComponentId(node, coerced.id ?? raw.id, context.store, context.scope, def?.requiresFinalId);
  const receipt = useMemo(createReceipt, [owner]);
  const finalized = Object.isFrozen(node), settled = ready && finalized;
  const props = coerced.id === undefined ? coerced : { ...coerced, id };
  const Skeleton = !finalized || (complete && !ready) ? def?.skeleton : undefined;
  const View = !complete && result.partial && def?.fallback ? def.fallback : context.components[name] ?? def?.component;
  const value = useMemo(() => ({ name, id, props, node, def, settled, receipt }), [name, id, props, node, def, settled, receipt]);
  const viewProps = { node, props, id, complete, partial: result.partial, issues: result.issues };
  if (Skeleton) return <ComponentContext.Provider value={value}><Skeleton key={owner} {...viewProps} children={null} /></ComponentContext.Provider>;
  if (!ready) return null;
  const children = renderChildren(node);
  const rendered = View ? <RenderBoundary key={owner} name={name}><View {...viewProps}>{children}</View></RenderBoundary> : <div data-prism="unknown" data-name={name}>{children}</div>;
  return <ComponentContext.Provider value={value}>{(def?.feedback ?? context.feedback) ? <FeedbackSurface targetKey={owner}>{rendered}</FeedbackSurface> : rendered}</ComponentContext.Provider>;
}
function renderChildren(node: Node) { return node.children?.map(child => <NodeView key={child.key} node={Object.isFrozen(child) ? child : { ...child }} />); }
const NodeView = memo(function NodeView({ node }: { node: Node }) {
  const context = usePrism();
  if (node.type === 'component') return node.name === 'state' ? <StatePatch node={node} /> : <Directive node={node} />;
  const override = context.components[node.type] ?? (node.type === 'thematicBreak' ? context.components.hr : undefined);
  const def = override ? undefined : context.registry.get(node.type);
  // Keep a provisional, empty fence out of the prose flow until it has content.
  if (node.type === 'code' && node.value === '' && node.complete === false && !Object.isFrozen(node)
    && !override && !def?.skeleton && !def?.fallback) return null;
  if (def) return <Directive node={node} />;
  const View = override ?? defaultRenderers[node.type as keyof typeof defaultRenderers];
  return View ? <View node={node}>{renderChildren(node)}</View> : <>{renderChildren(node) ?? node.value}</>;
}, (previous, next) => previous.node === next.node);

export interface PrismProps {
  renderers?: Renderers; feedback?: boolean;
  source?: string; done?: boolean; stream?: PrismStream; components?: Components; plugins?: Plugin[];
  store?: Store; persist?: Adapter; namespace?: string; registry?: Registry; scope?: string;
  onAction?(action: Action): void; middleware?: Middleware[];
  theme?: Theme; mode?: Mode; density?: Density; animate?: boolean; unstyled?: boolean;
  locale?: string; currency?: string; slots?: Slots; classNames?: ClassNames; styles?: Styles;
  className?: string; style?: CSSProperties;
}
export function Prism({ renderers = empty, feedback, scope: providedScope, source = '', done = true, stream, plugins, store: provided, persist, namespace, registry: providedRegistry = defaultRegistry, components = empty, onAction, middleware, theme, mode, density = 'comfortable', animate = true, unstyled = false, locale, currency = 'USD', slots = empty, classNames = empty, styles = empty, className, style }: PrismProps) {
  const instance = useId(), scope = providedScope ?? instance;
  components = useStable(components); slots = useStable(slots, 1); classNames = useStable(classNames, 1);
  renderers = useStable(renderers);
  const registry = useMemo(() => createRegistry([...providedRegistry.list(), ...Object.entries(renderers).map(([name, renderer]) => typeof renderer === 'object' && renderer !== null && 'component' in renderer ? { ...renderer, name } : { name, component: rendererView(renderer as import('react').ComponentType<any>) })]), [providedRegistry, renderers]);
  styles = useStable(styles, 2); theme = useStable(theme); middleware = useStable(middleware);
  const themed = useTheme(theme, mode), resolvedTheme = themed.theme;
  const overrides = useMemo(() => {
    const mergedSlots: Slots = {}, mergedClasses: ClassNames = {}, mergedStyles: Styles = {};
    for (const name of new Set([...Object.keys(resolvedTheme.components), ...Object.keys(slots), ...Object.keys(classNames), ...Object.keys(styles)])) {
      const entry = resolvedTheme.components[name];
      mergedSlots[name] = { ...entry?.slots, ...slots[name] };
      mergedClasses[name] = { ...entry?.classNames, ...classNames[name] };
      mergedStyles[name] = Object.fromEntries([...new Set([...Object.keys(entry?.styles ?? {}), ...Object.keys(styles[name] ?? {})])].map(part => [part, { ...entry?.styles?.[part], ...styles[name]?.[part] }]));
    }
    return { slots: mergedSlots, classNames: mergedClasses, styles: mergedStyles };
  }, [resolvedTheme, slots, classNames, styles]);
  const [owned] = useState(() => provided ?? createStore({ persist, namespace })), store = provided ?? owned;
  const [applied] = useState(() => new Set<string>()), motion = useMotion(animate);
  const handlers = useRef({ onAction, middleware }); handlers.current = { onAction, middleware };
  const emit = useCallback((action: Action, delivered?: (action: Action) => void) => {
    const { middleware = [], onAction } = handlers.current;
    const next = (index: number, action: Action): void => {
      if (index < middleware.length) middleware[index](action, action => next(index + 1, action));
      else if (onAction) { onAction(action); delivered?.(action); }
    };
    next(0, action);
  }, []);
  const format = useMemo(() => createFormat(locale, currency), [locale, currency]);
  const customization = useMemo(() => ({ slots, classNames, styles }), [slots, classNames, styles]);
  const current = useRef<{ parser: ReturnType<typeof createParser>; text: string; ended: boolean; plugins?: Plugin[] } | null>(null);
  if (!current.current || current.current.plugins !== plugins || !source.startsWith(current.current.text) || (current.current.ended && (source !== current.current.text || !done))) current.current = { parser: createParser({ plugins }), text: '', ended: false, plugins };
  const state = current.current;
  if (source.length > state.text.length) state.parser.push(source.slice(state.text.length));
  state.text = source;
  if (done && !state.ended) { state.parser.end(); state.ended = true; }
  const streamed = usePrismStream(stream, { plugins }), root = stream ? streamed.root : state.parser.root;
  const context = useMemo(() => ({ registry, components, store, emit, theme: theme ?? resolvedTheme, resolvedTheme, unstyled, ...overrides, customization, format, animate: motion, applied, scope, feedback }), [registry, components, store, emit, theme, resolvedTheme, unstyled, overrides, customization, format, motion, applied, scope, feedback]);
  const streaming = stream ? !streamed.done : !done;
  return <PrismContext.Provider value={context}><ThemeScope theme={theme} mode={mode} density={density} animate={motion}
    className={cx('prism-root', className)} style={style} data-state={streaming ? 'streaming' : 'ready'}
    data-prism-presentation={unstyled ? undefined : ''}>
    {root.children.map(node => <NodeView key={node.key} node={node} />)}
  </ThemeScope></PrismContext.Provider>;
}
