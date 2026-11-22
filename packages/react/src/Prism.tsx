import { memo, useCallback, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createParser, type Node, type Plugin } from '@prism-ui/core';
import { createStore, type Store, type Adapter, type Patch } from '@prism-ui/state';
import { ComponentContext, PrismContext, cx, usePrism, type Action, type Middleware, type Components, type Slots, type ClassNames, type Styles } from './context';
import { defaultRegistry, type Registry } from './registry';
import { defaultRenderers } from './markdown';
import { ThemeScope, useMotion, type Theme, type Density } from './theme';
import { createFormat } from './format';
import { usePrismStream, type PrismStream } from './stream';
import { useComponentId } from './identity';

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
  const { id, ready, key: viewKey } = useComponentId(node, coerced.id ?? raw.id, context.store, context.scope, def?.requiresFinalId);
  const props = coerced.id === undefined ? coerced : { ...coerced, id };
  const View = !complete && result.partial && def?.fallback ? def.fallback : context.components[name] ?? def?.component;
  const children = renderChildren(node);
  const value = useMemo(() => ({ name, id, props, node, def }), [name, id, props, node, def]);
  if (!ready) return null;
  return <ComponentContext.Provider value={value}>{View ? <View key={def?.requiresFinalId ? viewKey : undefined} node={node} props={props} id={id} complete={complete} partial={result.partial} issues={result.issues}>{children}</View> : <div data-prism="unknown" data-name={name}>{children}</div>}</ComponentContext.Provider>;
}
function renderChildren(node: Node) { return node.children?.map(child => <NodeView key={child.key} node={Object.isFrozen(child) ? child : { ...child }} />); }
const NodeView = memo(function NodeView({ node }: { node: Node }) {
  const context = usePrism();
  if (node.type === 'component') return node.name === 'state' ? <StatePatch node={node} /> : <Directive node={node} />;
  const override = context.components[node.type] ?? (node.type === 'thematicBreak' ? context.components.hr : undefined);
  if (!override && context.registry.get(node.type)) return <Directive node={node} />;
  const View = override ?? defaultRenderers[node.type as keyof typeof defaultRenderers];
  return View ? <View node={node}>{renderChildren(node)}</View> : <>{renderChildren(node) ?? node.value}</>;
}, (previous, next) => previous.node === next.node);

export interface PrismProps {
  source?: string; done?: boolean; stream?: PrismStream; components?: Components; plugins?: Plugin[];
  store?: Store; persist?: Adapter; namespace?: string; registry?: Registry; scope?: string;
  onAction?(action: Action): void; middleware?: Middleware[];
  theme?: Theme; density?: Density; animate?: boolean; unstyled?: boolean;
  locale?: string; currency?: string; slots?: Slots; classNames?: ClassNames; styles?: Styles;
  className?: string; style?: CSSProperties;
}
export function Prism({ scope: providedScope, source = '', done = true, stream, plugins, store: provided, persist, namespace, registry = defaultRegistry, components = empty, onAction, middleware, theme = 'auto', density = 'comfortable', animate = true, unstyled = false, locale, currency = 'USD', slots = empty, classNames = empty, styles = empty, className, style }: PrismProps) {
  const instance = useId(), scope = providedScope ?? instance;
  components = useStable(components); slots = useStable(slots, 1); classNames = useStable(classNames, 1);
  styles = useStable(styles, 2); theme = useStable(theme); middleware = useStable(middleware);
  const [owned] = useState(() => provided ?? createStore({ persist, namespace })), store = provided ?? owned;
  const [applied] = useState(() => new Set<string>()), motion = useMotion(animate);
  const handlers = useRef({ onAction, middleware }); handlers.current = { onAction, middleware };
  const emit = useCallback((action: Action) => {
    const { middleware = [], onAction } = handlers.current;
    const next = (index: number, action: Action): void => { if (index < middleware.length) middleware[index](action, action => next(index + 1, action)); else onAction?.(action); };
    next(0, action);
  }, []);
  const format = useMemo(() => createFormat(locale, currency), [locale, currency]);
  const current = useRef<{ parser: ReturnType<typeof createParser>; text: string; ended: boolean; plugins?: Plugin[] } | null>(null);
  if (!current.current || current.current.plugins !== plugins || !source.startsWith(current.current.text) || (current.current.ended && (source !== current.current.text || !done))) current.current = { parser: createParser({ plugins }), text: '', ended: false, plugins };
  const state = current.current;
  if (source.length > state.text.length) state.parser.push(source.slice(state.text.length));
  state.text = source;
  if (done && !state.ended) { state.parser.end(); state.ended = true; }
  const streamed = usePrismStream(stream, { plugins }), root = stream ? streamed.root : state.parser.root;
  const context = useMemo(() => ({ registry, components, store, emit, theme, unstyled, slots, classNames, styles, format, animate: motion, applied, scope }), [registry, components, store, emit, theme, unstyled, slots, classNames, styles, format, motion, applied, scope]);
  return <PrismContext.Provider value={context}><ThemeScope theme={theme} density={density} animate={motion} className={cx('prism-root', className)} style={style}>{root.children.map(node => <NodeView key={node.key} node={node} />)}</ThemeScope></PrismContext.Provider>;
}
