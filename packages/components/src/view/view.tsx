import { createContext, memo, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType, type KeyboardEvent, type ReactNode } from 'react';
import { parse, type Node } from '@prism-ui/core';
import { s, type Infer } from '@prism-ui/schema';
import { ComponentContext, StreamSkeleton, cx, defaultRenderers, defineComponent, registerComponent, usePart, usePrism, useSent, useSlot, type Format, type PrismComponentProps, type PrismContextValue } from '@prism-ui/react';
import { Chip, Checkbox as SharedCheckbox, Pill, Switch } from '../shared';
import { ComponentFrame } from '../frame';
import { ViewIcon, iconNames } from './icons';
import { bindPath, collect, evaluate, isOpen, listPath, resolve, resolvePath, run, snapshot, template, type Formatter, type Read, type ViewNode, type ViewScope, type ViewValue } from './tree';

export const viewSchema = s.object({
  id: s.string().describe('Stable id; view-local state lives under it').optional(),
  title: s.string().describe('Header title; omit with frame:"none" for a bare inline artifact').optional(),
  frame: s.enum(['card', 'inline', 'none']).describe('card (default, raised surface), inline (flows with the reply) or none (chrome-less artifact)').optional(),
  state: s.any().describe('Initial view-local state object; its keys become bindable paths. Put it first').optional(),
  children: s.array(s.any()).describe('Root nodes').optional(),
  actions: s.array(s.any()).describe('Footer nodes, usually the one primary button').optional(),
});
export type ViewProps = Infer<typeof viewSchema>;
export type { ViewNode, ViewScope, ViewValue } from './tree';

export interface PrimitiveProps {
  node: ViewNode; props: Record<string, any>; scope: ViewScope; path: string; depth: number; open: boolean;
  /** Absolute store path for `value: {$bind}` controls. */ bound?: string;
  set(value: unknown): void; act(spec: unknown, extra?: Record<string, unknown>): void; part(name: string, state?: string): { className?: string; style?: React.CSSProperties; 'data-part'?: string };
}
export interface ViewConfig {
  /** Extra or replacement primitives by type. */ primitives?: Record<string, ComponentType<PrimitiveProps>>;
  /** Allow agent-supplied `className` on nodes (off by default). */ allowClassName?: boolean;
  /** Maximum nesting depth (default 24). */ maxDepth?: number;
}
export const ViewConfigContext = createContext<ViewConfig>({});
interface ViewRuntime { id: string; streaming: boolean; format: Formatter; prism: PrismContextValue; config: ViewConfig; send(type: string, payload?: unknown, message?: string): void }
const ViewContext = createContext<ViewRuntime | null>(null);

export function viewFormatter(f: Format): Formatter {
  return (value, kind) => {
    if (value == null || typeof value === 'number' && !Number.isFinite(value)) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return '';
    const [k, arg] = (kind ?? '').split(':');
    const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() && !Number.isNaN(+value) ? +value : undefined;
    if (k === 'upper') return String(value).toUpperCase();
    if (k === 'lower') return String(value).toLowerCase();
    if (k === 'date' || k === 'time' || k === 'datetime') { const d = new Date(n ?? String(value)); return Number.isNaN(+d) ? String(value) : f.date(d, k === 'date' ? { dateStyle: 'medium' } : k === 'time' ? { timeStyle: 'short' } : { dateStyle: 'medium', timeStyle: 'short' }); }
    if (n === undefined) return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
    if (k === 'currency') return f.currency(n, arg || undefined);
    if (k === 'percent') return arg && /^\d$/.test(arg) ? f.number(n, { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: +arg }) : f.percent(n);
    if (k === 'compact') return f.compact(n);
    if (k === 'integer') return f.number(Math.round(n));
    if (k === 'fixed') return f.number(n, { minimumFractionDigits: +arg || 0, maximumFractionDigits: +arg || 0 });
    return f.number(n, { maximumFractionDigits: 2 });
  };
}

const TONES = new Set(['neutral', 'accent', 'success', 'warning', 'danger', 'info', 'muted']);
const SIZES = new Set(['xs', 'sm', 'md', 'lg', 'xl']);
const ALIGN = new Set(['start', 'center', 'end', 'stretch', 'baseline']);
const JUSTIFY = new Set(['start', 'center', 'end', 'between', 'around']);
const WIDTH = new Set(['auto', 'full', 'half', 'third', 'twoThirds', 'quarter', 'sm', 'md', 'lg']);
const pick = (v: unknown, set: Set<string>) => typeof v === 'string' && set.has(v) ? v : undefined;
const step = (v: unknown, max = 8) => typeof v === 'number' && Number.isFinite(v) ? String(Math.max(0, Math.min(max, Math.round(v)))) : undefined;
const word = (v: unknown) => typeof v === 'string' && /^[a-z][a-zA-Z]{0,15}$/.test(v) ? v : undefined;
const text = (v: unknown) => v == null ? '' : typeof v === 'object' ? '' : String(v);
const num = (v: unknown, d = 0) => typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(+v) ? +v : d;
/** Token props → data attributes; never inline CSS. */
export function tokens(p: Record<string, any>) {
  return {
    'data-tone': pick(p.tone, TONES), 'data-size': pick(p.size, SIZES), 'data-variant': word(p.variant), 'data-gap': step(p.gap), 'data-pad': step(p.pad),
    'data-align': pick(p.align, ALIGN), 'data-justify': pick(p.justify, JUSTIFY), 'data-width': pick(p.width, WIDTH), 'data-span': step(p.span, 6),
    'data-grow': p.grow ? '' : undefined, 'data-wrap': p.wrap ? '' : undefined,
  };
}
const flag = (raw: ViewValue, resolved: unknown, scope: ViewScope, read: Read) => raw === undefined ? false : typeof raw === 'string' ? !!evaluate(raw, scope, read) : !!resolved;

const mdCache = new Map<string, Node[]>();
function markdown(source: string, block: boolean): Node[] {
  const key = (block ? 'b' : 'i') + source; let hit = mdCache.get(key);
  if (!hit) {
    const nodes = parse(source).children ?? [];
    hit = !block && nodes.length === 1 && nodes[0].type === 'paragraph' ? nodes[0].children ?? [] : nodes;
    if (mdCache.size > 500) mdCache.clear(); mdCache.set(key, hit);
  }
  return hit;
}
function MdNodes({ nodes }: { nodes: Node[] }) {
  const { components } = usePrism();
  return <>{nodes.map((node, i) => {
    if (node.type === 'component') return <InlineDirective key={i} node={node} />;
    const View = (components[node.type] ?? (defaultRenderers as Record<string, ComponentType<{ node: Node; children?: ReactNode }>>)[node.type]);
    const children = node.children ? <MdNodes nodes={node.children} /> : undefined;
    return View ? <View key={i} node={node}>{children}</View> : <span key={i}>{children ?? node.value}</span>;
  })}</>;
}
/** Inline markdown fast path: plain strings skip the parser entirely. */
export function Markdown({ text: source, block = false }: { text: string; block?: boolean }) {
  if (!block && !/[*_`[\]:~\\<!|#>]/.test(source)) return <>{source}</>;
  return <MdNodes nodes={markdown(source, block)} />;
}
function InlineDirective({ node }: { node: Node }) {
  const view = useContext(ViewContext)!;
  return <Embed name={node.name ?? ''} props={(node.props ?? {}) as Record<string, any>} path={'md-' + (node.key ?? node.name)} open={false} body={node.children} inline={view.id}>{node.children ? <MdNodes nodes={node.children} /> : null}</Embed>;
}

/** Headless per-node hook: subscribes to exactly the store paths a node reads and resolves its props. */
export function useViewNode(node: ViewNode, scope: ViewScope) {
  const view = useContext(ViewContext)!;
  const { store } = view.prism;
  const paths = useMemo(() => [...collect(node, scope, new Set())], [node, scope]);
  const subscribe = useCallback((fn: () => void) => { const offs = paths.map(path => store.subscribe(path, fn)); return () => offs.forEach(off => off()); }, [store, paths]);
  const last = useRef<unknown[]>([]);
  const read = useCallback(() => {
    const next = paths.map(path => store.get(path)), prev = last.current;
    return next.length === prev.length && next.every((v, i) => Object.is(v, prev[i])) ? prev : last.current = next;
  }, [store, paths]);
  const values = useSyncExternalStore(subscribe, read, read);
  return useMemo(() => {
    const get: Read = path => store.get(path);
    const props = resolve(node, scope, get, view.format) as Record<string, any>;
    const visible = node.when === undefined || flag(node.when, props.when, scope, get);
    return { props, visible, get };
  }, [node, scope, values, store, view.format]);
}

function useActions(scope: ViewScope) {
  const view = useContext(ViewContext)!;
  const { store } = view.prism;
  return useCallback((spec: unknown, extra?: Record<string, unknown>) => {
    if (isOpen(spec)) return;
    let action: ReturnType<typeof run>;
    const writer = {
      get: (path: string) => store.get(path), set: (path: string, value: unknown) => store.set(path, value),
      remove(path: string) {
        const dot = path.lastIndexOf('.'), parent = path.slice(0, dot), index = Number(path.slice(dot + 1)), list = store.get(parent);
        if (dot > 0 && Array.isArray(list) && Number.isInteger(index)) store.set(parent, list.filter((_, i) => i !== index)); else store.set(path, undefined);
      },
    };
    store.batch(() => { action = run(spec, scope, writer, view.format, extra); });
    if (action) view.send(action.type, action.payload, action.message);
  }, [store, scope, view]);
}

const PRIMITIVES = new Set(['stack', 'row', 'column', 'grid', 'box', 'card', 'text', 'markdown', 'heading', 'stat', 'badge', 'image', 'icon', 'divider', 'spacer', 'button', 'input', 'select', 'segmented', 'toggle', 'slider', 'checkbox', 'list', 'table', 'progress', 'avatar', 'tabs']);
const NEEDS: Record<string, string> = { text: 'text', markdown: 'text', heading: 'text', badge: 'text', button: 'label', stat: 'value', image: 'src', icon: 'name', avatar: 'name', progress: 'value' };

export function ViewSkeleton({ type }: { type?: string }) {
  const part = usePart('view', 'skeleton');
  return <StreamSkeleton {...part} data-type={type ?? 'node'}><span data-prism-skeleton-line="" /></StreamSkeleton>;
}

const NodeView = memo(function NodeView({ node, scope, path, depth }: { node: ViewNode; scope: ViewScope; path: string; depth: number }) {
  const view = useContext(ViewContext)!;
  const { props, visible } = useViewNode(node, scope);
  const act = useActions(scope);
  const bound = bindPath(node.value, scope);
  const open = view.streaming && isOpen(node);
  const set = useCallback((value: unknown) => { if (bound) view.prism.store.set(bound, value); if (node.onChange) act(node.onChange, { value }); }, [bound, view, node.onChange, act]);
  const part = usePart('view', 'node');
  const partFor = useCallback((name: string, state?: string) => ({ ...partOf(view.prism, name, state) }), [view.prism]);
  if (depth > (view.config.maxDepth ?? 24) || !visible) return null;
  const type = typeof node.type === 'string' ? node.type : undefined;
  const custom = type ? view.config.primitives?.[type] : undefined;
  const known = !!type && (custom || PRIMITIVES.has(type) || view.prism.registry.get(type));
  if (open && (!known || (NEEDS[type!] && props[NEEDS[type!]] === undefined))) return <ViewSkeleton type={type} />;
  if (!known) return null;
  const extra = view.config.allowClassName && typeof node.className === 'string' ? node.className : undefined;
  const p: PrimitiveProps = { node, props, scope, path, depth, open, bound, set, act, part: partFor };
  const View = custom ?? (PRIMITIVES.has(type!) ? views[type!] : undefined);
  if (!View) return <Embed name={type!} props={props} path={path} open={open} raw={node} scope={scope} depth={depth} />;
  return extra ? <div className={cx(part.className, extra)} style={{ display: 'contents' }}><View {...p} /></div> : <View {...p} />;
});
function partOf(prism: PrismContextValue, name: string, state?: string) {
  return { className: cx(!prism.unstyled && `prism-view__${name}`, prism.classNames.view?.[name]) || undefined, style: prism.styles.view?.[name], 'data-prism': 'view', 'data-part': name, 'data-state': state } as Record<string, any>;
}

function Nodes({ nodes, scope, path, depth }: { nodes: unknown; scope: ViewScope; path: string; depth: number }) {
  if (!Array.isArray(nodes)) return nodes && typeof nodes === 'object' ? <NodeView node={nodes as ViewNode} scope={scope} path={path + '-0'} depth={depth + 1} /> : null;
  return <>{nodes.map((child, i) => typeof child === 'string'
    ? <NodeView key={i} node={{ type: 'text', text: child }} scope={scope} path={`${path}-${i}`} depth={depth + 1} />
    : child && typeof child === 'object' && !Array.isArray(child) ? <NodeView key={typeof (child as ViewNode).id === 'string' ? 'k' + (child as ViewNode).id : i} node={child as ViewNode} scope={scope} path={`${path}-${i}`} depth={depth + 1} /> : null)}</>;
}
const kids = (p: PrimitiveProps) => <Nodes nodes={p.node.children} scope={p.scope} path={p.path} depth={p.depth} />;
const Icon = ({ name, p, cls = 'icon' }: { name: unknown; p: PrimitiveProps; cls?: string }) => typeof name === 'string' && name ? <ViewIcon name={name} {...p.part(cls)} /> : null;
const press = (fn: () => void) => (event: KeyboardEvent) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); fn(); } };

function Stack(p: PrimitiveProps) {
  const dir = p.node.type === 'row' || p.props.direction === 'row' ? 'row' : 'column';
  return <div {...p.part('stack')} {...tokens(p.props)} data-direction={dir} data-gap={step(p.props.gap) ?? '3'}>{kids(p)}</div>;
}
function Grid(p: PrimitiveProps) {
  const cols = p.props.cols === 'auto' ? 'auto' : step(p.props.cols ?? 2, 6);
  return <div {...p.part('grid')} {...tokens(p.props)} data-cols={cols} data-gap={step(p.props.gap) ?? '3'}>{kids(p)}</div>;
}
function Box(p: PrimitiveProps) {
  const view = useContext(ViewContext)!;
  const { props, node } = p, card = node.type === 'card';
  const selected = node.selected === undefined ? undefined : flag(node.selected, props.selected, p.scope, path => view.prism.store.get(path));
  const interactive = !!node.onClick;
  const onClick = () => p.act(node.onClick);
  const head = props.title || props.subtitle || props.icon || props.badge;
  return <div {...p.part(card ? 'card' : 'box')} {...tokens(props)} data-pad={step(props.pad) ?? (card ? '4' : undefined)} data-selected={selected ? '' : undefined} data-interactive={interactive ? '' : undefined}
    role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} aria-pressed={interactive && selected !== undefined ? selected : undefined}
    onClick={interactive ? onClick : undefined} onKeyDown={interactive ? press(onClick) : undefined}>
    {head ? <div {...p.part('cardHeader')}>
      {props.icon && <span {...p.part('cardIcon')}><ViewIcon name={text(props.icon)} /></span>}
      <div {...p.part('cardHeading')}>{(props.title || props.badge) && <div {...p.part('cardTitle')}>{props.title && <span><Markdown text={text(props.title)} /></span>}{props.badge && <span {...p.part('badge')} data-tone={pick(props.badgeTone, TONES) ?? 'accent'}>{text(props.badge)}</span>}</div>}{props.subtitle && <div {...p.part('cardSubtitle')}><Markdown text={text(props.subtitle)} /></div>}</div>
      {interactive && selected !== undefined && <span {...p.part('check')} aria-hidden="true">{selected && <ViewIcon name="check" />}</span>}
    </div> : null}
    {kids(p)}
  </div>;
}
function TextView(p: PrimitiveProps) {
  const block = p.node.type === 'markdown';
  const Tag = block ? 'div' : 'p';
  return <Tag {...p.part(block ? 'markdown' : 'text')} {...tokens(p.props)} data-weight={pick(p.props.weight, new Set(['regular', 'medium', 'semibold', 'bold']))} data-text-align={pick(p.props.textAlign ?? p.props.align, new Set(['start', 'center', 'end']))} data-mono={p.props.mono ? '' : undefined} data-streaming={p.open ? '' : undefined}>
    <Markdown text={text(p.props.text ?? p.props.value)} block={block} />
  </Tag>;
}
function Heading(p: PrimitiveProps) {
  const level = Math.max(1, Math.min(4, num(p.props.level, 3)));
  const Tag = (['h2', 'h3', 'h4', 'h5'] as const)[level - 1];
  return <div {...p.part('headingGroup')} {...tokens(p.props)}><Tag {...p.part('heading')} data-level={level}><Icon name={p.props.icon} p={p} /><Markdown text={text(p.props.text)} /></Tag>{p.props.subtitle && <p {...p.part('subtitle')}><Markdown text={text(p.props.subtitle)} /></p>}</div>;
}
function Stat(p: PrimitiveProps) {
  const view = useContext(ViewContext)!;
  const { props } = p;
  const value = typeof props.value === 'number' || props.format ? view.format(props.value, props.format) : text(props.value);
  const delta = props.delta;
  const d = typeof delta === 'number' ? delta : undefined;
  const trend = pick(props.trend, new Set(['up', 'down', 'flat'])) ?? (d === undefined ? undefined : d > 0 ? 'up' : d < 0 ? 'down' : 'flat');
  const good = trend === 'flat' || trend === undefined ? undefined : (trend === 'up') !== !!props.invert;
  const deltaText = d === undefined ? text(delta) : (d > 0 ? '+' : '') + view.format(d, props.deltaFormat ?? 'percent:1');
  return <div {...p.part('stat')} {...tokens(props)}>
    <div {...p.part('statLabel')}><Icon name={props.icon} p={p} />{text(props.label)}</div>
    <div {...p.part('statValue')} aria-live="polite">{value}{props.unit && <span {...p.part('statUnit')}>{text(props.unit)}</span>}</div>
    {(deltaText || props.hint) && <div {...p.part('statMeta')}>
      {deltaText && <span {...p.part('statDelta')} data-trend={trend} data-good={good === undefined ? undefined : String(good)}>{trend && trend !== 'flat' && <ViewIcon name={trend === 'up' ? 'trending-up' : 'trending-down'} />}{deltaText}</span>}
      {props.hint && <span {...p.part('statHint')}>{text(props.hint)}</span>}
    </div>}
  </div>;
}
function Badge(p: PrimitiveProps) { return <span {...p.part('badge')} {...tokens(p.props)} data-tone={pick(p.props.tone, TONES) ?? 'neutral'}><Icon name={p.props.icon} p={p} />{text(p.props.text)}</span>; }
function ImageView(p: PrimitiveProps) {
  const [loaded, setLoaded] = useState(false);
  const src = text(p.props.src), safe = /^(?:https?:\/\/|data:image\/(?:png|jpe?g|gif|webp|avif);)/i.test(src);
  const ratio = /^(\d+(?:\.\d+)?)[:/](\d+(?:\.\d+)?)$/.exec(text(p.props.ratio));
  return <figure {...p.part('image')} {...tokens(p.props)} data-loaded={loaded ? '' : undefined} data-fit={pick(p.props.fit, new Set(['cover', 'contain']))} style={ratio ? { aspectRatio: `${+ratio[1]} / ${+ratio[2]}` } : undefined}>
    {safe && <img src={src} alt={text(p.props.alt)} loading="lazy" decoding="async" onLoad={() => setLoaded(true)} />}
    {p.props.caption && <figcaption>{text(p.props.caption)}</figcaption>}
  </figure>;
}
function IconView(p: PrimitiveProps) { return <span {...p.part('iconBox')} {...tokens(p.props)} data-tone={pick(p.props.tone, TONES)}><ViewIcon name={text(p.props.name)} label={p.props.label ? text(p.props.label) : undefined} /></span>; }
function Divider(p: PrimitiveProps) { return p.props.label ? <div {...p.part('divider')} role="separator" data-labelled=""><span>{text(p.props.label)}</span></div> : <hr {...p.part('divider')} />; }
function Spacer(p: PrimitiveProps) { return <div {...p.part('spacer')} data-size={pick(p.props.size, SIZES)} aria-hidden="true" />; }
function Button(p: PrimitiveProps) {
  const view = useContext(ViewContext)!;
  const get: Read = path => view.prism.store.get(path);
  const disabled = flag(p.node.disabled, p.props.disabled, p.scope, get) || isOpen(p.node.onClick) || (p.open && p.node.onClick === undefined);
  return <Pill {...p.part('button')} {...tokens(p.props)} variant={p.props.variant === 'primary' || p.props.variant === 'danger' ? 'primary' : p.props.variant === 'ghost' || p.props.variant === 'link' ? 'ghost' : 'secondary'} data-style={pick(p.props.variant, new Set(['primary', 'secondary', 'ghost', 'outline', 'danger', 'link'])) ?? 'secondary'} data-full={p.props.full ? '' : undefined}
    disabled={disabled} aria-label={p.props.ariaLabel ? text(p.props.ariaLabel) : undefined} onClick={() => p.act(p.node.onClick)}>
    <Icon name={p.props.icon} p={p} />{p.props.label !== undefined && <span>{text(p.props.label)}</span>}<Icon name={p.props.iconRight} p={p} />
  </Pill>;
}
function Field({ p, children, id, inline }: { p: PrimitiveProps; children: ReactNode; id: string; inline?: boolean }) {
  return <div {...p.part('field')} {...tokens(p.props)} data-inline={inline ? '' : undefined}>
    {(p.props.label || p.props.description) && <div {...p.part('fieldText')}>{p.props.label && <label {...p.part('label')} htmlFor={id}>{text(p.props.label)}</label>}{p.props.description && <span {...p.part('description')} id={id + '-d'}>{text(p.props.description)}</span>}</div>}
    {children}
    {p.props.hint && <span {...p.part('hint')}>{text(p.props.hint)}</span>}
  </div>;
}
function Input(p: PrimitiveProps) {
  const id = useId(), { props } = p;
  const kind = pick(props.inputType ?? props.kind, new Set(['text', 'number', 'email', 'date', 'time', 'search', 'url', 'tel', 'password'])) ?? 'text';
  const value = props.value ?? '';
  const change = (raw: string) => p.set(kind === 'number' ? (raw === '' ? null : num(raw, 0)) : raw);
  const submit = (event: KeyboardEvent) => { if (event.key === 'Enter' && !event.shiftKey && p.node.onSubmit) { event.preventDefault(); p.act(p.node.onSubmit, { value }); } };
  const common = { id, ...p.part('control'), value: typeof value === 'object' ? '' : String(value), placeholder: props.placeholder ? text(props.placeholder) : undefined, 'aria-describedby': props.description ? id + '-d' : undefined, onKeyDown: submit, readOnly: !p.bound && !p.node.onChange };
  return <Field p={p} id={id}>
    <div {...p.part('controlWrap')}>
      {props.prefix && <span {...p.part('affix')}>{text(props.prefix)}</span>}
      {props.multiline ? <textarea {...common} rows={num(props.rows, 3)} onChange={e => change(e.target.value)} />
        : <input {...common} type={kind} min={props.min} max={props.max} step={props.step} inputMode={kind === 'number' ? 'decimal' : undefined} onChange={e => change(e.target.value)} />}
      {props.suffix && <span {...p.part('affix')}>{text(props.suffix)}</span>}
    </div>
  </Field>;
}
type Option = { value: string | number | boolean; label: string; icon?: string; hint?: string };
const options = (raw: unknown): Option[] => Array.isArray(raw) ? raw.flatMap(o => o && typeof o === 'object' ? (o as any).value === undefined ? [] : [{ value: (o as any).value, label: text((o as any).label ?? (o as any).value), icon: (o as any).icon, hint: (o as any).hint }] : o == null ? [] : [{ value: o as any, label: String(o) }]) : [];
function Select(p: PrimitiveProps) {
  if (p.node.type === 'segmented' || p.props.variant === 'segmented') return <Segmented {...p} />;
  const id = useId(), opts = options(p.props.options);
  const index = opts.findIndex(o => o.value === p.props.value);
  return <Field p={p} id={id}><div {...p.part('controlWrap')} data-select="">
    <select id={id} {...p.part('control')} value={index < 0 ? '' : String(index)} onChange={e => p.set(opts[+e.target.value]?.value)}>
      {index < 0 && <option value="" disabled>{text(p.props.placeholder) || 'Select…'}</option>}
      {opts.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
    </select><ViewIcon name="chevron-down" {...p.part('chevron')} />
  </div></Field>;
}
function Segmented(p: PrimitiveProps) {
  const id = useId(), opts = options(p.props.options), ref = useRef<HTMLDivElement>(null);
  const current = opts.findIndex(o => o.value === p.props.value);
  const move = (event: KeyboardEvent) => {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!delta || !opts.length) return; event.preventDefault();
    const next = (Math.max(0, current) + delta + opts.length) % opts.length; p.set(opts[next].value);
    (ref.current?.children[next] as HTMLElement | undefined)?.focus();
  };
  return <Field p={p} id={id}><div {...p.part('segmented')} ref={ref} role="radiogroup" id={id} aria-label={p.props.label ? text(p.props.label) : undefined} onKeyDown={move}>
    {opts.map((o, i) => <Chip key={i} role="radio" {...p.part('segment')} aria-checked={i === current} tabIndex={i === Math.max(0, current) ? 0 : -1} onClick={() => p.set(o.value)}>
      {o.icon && <ViewIcon name={o.icon} />}<span>{o.label}</span>{o.hint && <span {...p.part('segmentHint')}>{o.hint}</span>}
    </Chip>)}
  </div></Field>;
}
function Toggle(p: PrimitiveProps) {
  const id = useId(), on = !!p.props.value;
  return <Field p={p} id={id} inline><Switch id={id} {...p.part('switch')} checked={on} data-state={on ? 'on' : 'off'} aria-describedby={p.props.description ? id + '-d' : undefined} onClick={() => p.set(!on)}><span {...p.part('thumb')} /></Switch></Field>;
}
function Checkbox(p: PrimitiveProps) {
  const id = useId(), on = !!p.props.value;
  return <label {...p.part('checkbox')} {...tokens(p.props)} data-checked={on ? '' : undefined} data-strike={p.props.strike ? '' : undefined} htmlFor={id}>
    <SharedCheckbox id={id} {...p.part('checkInput')} checked={on} onChange={e => p.set(e.target.checked)} />
    <span {...p.part('checkBox')} aria-hidden="true"><ViewIcon name="check" /></span>
    <span {...p.part('checkText')}><span {...p.part('checkLabel')}><Markdown text={text(p.props.label)} /></span>{p.props.description && <span {...p.part('description')}>{text(p.props.description)}</span>}</span>
  </label>;
}
function Slider(p: PrimitiveProps) {
  const view = useContext(ViewContext)!, id = useId(), { props } = p;
  const min = num(props.min, 0), max = num(props.max, 100), value = num(props.value, min);
  const pct = max > min ? ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100 : 0;
  return <Field p={p} id={id}><div {...p.part('sliderRow')}>
    <input id={id} type="range" {...p.part('slider')} min={min} max={max} step={num(props.step, 1)} value={value} style={{ '--prism-view-fill': pct + '%' } as React.CSSProperties} aria-valuetext={view.format(value, props.format)} onChange={e => p.set(+e.target.value)} />
    <output {...p.part('sliderValue')} htmlFor={id}>{view.format(value, props.format)}{props.unit ? (/^[%°]/.test(text(props.unit)) ? '' : ' ') + text(props.unit) : ''}</output>
  </div></Field>;
}
function Progress(p: PrimitiveProps) {
  const view = useContext(ViewContext)!, value = num(p.props.value), max = num(p.props.max, value <= 1 ? 1 : 100);
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return <div {...p.part('progress')} {...tokens(p.props)} data-tone={pick(p.props.tone, TONES) ?? 'accent'}>
    {(p.props.label || p.props.showValue !== false) && <div {...p.part('progressText')}><span>{text(p.props.label)}</span>{p.props.showValue !== false && <span {...p.part('progressValue')}>{p.props.format ? `${view.format(value, p.props.format)} / ${view.format(max, p.props.format)}` : view.format(ratio, 'percent')}</span>}</div>}
    <div {...p.part('track')} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={text(p.props.label) || undefined}><div {...p.part('fill')} style={{ transform: `scaleX(${ratio})` }} /></div>
  </div>;
}
function Avatar(p: PrimitiveProps) {
  const name = text(p.props.name), src = text(p.props.src);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 6, 0);
  return <span {...p.part('avatar')} {...tokens(p.props)} data-hue={hue} title={name} role="img" aria-label={name}>{/^https:\/\//.test(src) ? <img src={src} alt="" loading="lazy" /> : initials}</span>;
}
function ListItem({ p, item, index, base }: { p: PrimitiveProps; item: unknown; index: number; base: string }) {
  const scope = useMemo(() => ({ ...p.scope, item: `${base}.${index}`, index }), [p.scope, base, index]);
  return <li {...p.part('listItem')} data-index={index}><NodeView node={p.node.item as ViewNode} scope={scope} path={`${p.path}-i${index}`} depth={p.depth} />{void item}</li>;
}
function List(p: PrimitiveProps) {
  const view = useContext(ViewContext)!;
  const base = listPath(p.node.each, p.scope), items: unknown[] = Array.isArray(p.props.each) ? p.props.each : [];
  const get: Read = path => view.prism.store.get(path);
  const shown = items.map((item, index) => ({ item, index })).filter(({ index }) => typeof p.node.filter !== 'string' || !!evaluate(p.node.filter, { ...p.scope, item: `${base}.${index}`, index }, get)).slice(0, num(p.props.limit, Infinity) || Infinity);
  const Tag = p.props.ordered ? 'ol' : 'ul';
  if (!base || !p.node.item || typeof p.node.item !== 'object') return <div {...p.part('stack')} data-direction="column" data-gap={step(p.props.gap) ?? '2'}>{kids(p)}</div>;
  return <div {...p.part('list')} {...tokens(p.props)}>
    {shown.length ? <Tag {...p.part('items')} data-divided={p.props.divided ? '' : undefined} data-gap={step(p.props.gap) ?? (p.props.divided ? '0' : '2')}>
      {shown.map(({ item, index }) => <ListItem key={item && typeof item === 'object' && 'id' in item ? 'k' + String((item as any).id) : index} p={p} item={item} index={index} base={base} />)}
    </Tag> : !p.open && <div {...p.part('empty')}>{text(p.props.empty) || 'Nothing here yet'}</div>}
  </div>;
}
function Table(p: PrimitiveProps) {
  const view = useContext(ViewContext)!;
  const rows: Record<string, unknown>[] = Array.isArray(p.props.rows) ? p.props.rows.filter((r: unknown) => r && typeof r === 'object') : [];
  const cols = ((Array.isArray(p.props.columns) ? p.props.columns : Object.keys(rows[0] ?? {}))
    .map((c: any) => typeof c === 'string' ? { key: c, label: c } : c && typeof c === 'object' && typeof c.key === 'string' ? { key: c.key, label: text(c.label ?? c.key), align: c.align, format: c.format } : null)as any[]).filter(Boolean) as { key: string; label: string; align?: string; format?: string }[];
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => sort ? [...rows].sort((a, b) => { const x = a[sort.key] as any, y = b[sort.key] as any; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''))) * sort.dir; }) : rows, [rows, sort]);
  const cell = (v: unknown, c: typeof cols[number]) => typeof v === 'boolean' ? <ViewIcon name={v ? 'check' : 'minus'} {...p.part('tableBool')} data-on={String(v)} /> : c.format || typeof v === 'number' ? view.format(v, c.format) : <Markdown text={text(v)} />;
  return <div {...p.part('tableWrap')} {...tokens(p.props)}><table {...p.part('table')}>
    <thead><tr>{cols.map(c => <th key={c.key} scope="col" data-align={pick(c.align, ALIGN)} aria-sort={sort?.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
      {p.props.sortable === false ? c.label : <button type="button" {...p.part('sort')} onClick={() => setSort(s => s?.key === c.key ? (s.dir > 0 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 })}>{c.label}{sort?.key === c.key && <ViewIcon name={sort.dir > 0 ? 'arrow-up' : 'arrow-down'} />}</button>}
    </th>)}</tr></thead>
    <tbody>{sorted.map((r, i) => <tr key={typeof r.id === 'string' || typeof r.id === 'number' ? r.id : i} data-highlight={r.highlight ? '' : undefined}>{cols.map(c => <td key={c.key} data-align={pick(c.align, ALIGN)}>{cell(r[c.key], c)}</td>)}</tr>)}</tbody>
  </table></div>;
}
function Tabs(p: PrimitiveProps) {
  const view = useContext(ViewContext)!, base = useId(), ref = useRef<HTMLDivElement>(null);
  const tabs = (Array.isArray(p.node.tabs) ? p.node.tabs : []).filter((t): t is ViewNode => !!t && typeof t === 'object' && !Array.isArray(t));
  const [local, setLocal] = useState(0);
  const bound = p.bound !== undefined, value = p.props.value;
  const current = Math.max(0, Math.min(tabs.length - 1, bound ? (typeof value === 'number' ? value : tabs.findIndex(t => t.value === value || t.label === value)) : local));
  const select = (i: number) => bound ? p.set(tabs[i]?.value ?? i) : setLocal(i);
  const get: Read = path => view.prism.store.get(path);
  const move = (event: KeyboardEvent) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : delta ? (current + delta + tabs.length) % tabs.length : -1;
    if (next < 0) return; event.preventDefault(); select(next); (ref.current?.children[next] as HTMLElement | undefined)?.focus();
  };
  const tab = tabs[current];
  return <div {...p.part('tabs')} {...tokens(p.props)}>
    <div {...p.part('tabList')} role="tablist" ref={ref} onKeyDown={move}>
      {tabs.map((t, i) => <button key={i} type="button" role="tab" id={`${base}-t${i}`} aria-controls={`${base}-p${i}`} aria-selected={i === current} tabIndex={i === current ? 0 : -1} {...p.part('tab')} onClick={() => select(i)}>
        {typeof t.icon === 'string' && <ViewIcon name={t.icon} />}{template(text(t.label), p.scope, get, view.format)}{t.badge !== undefined && <span {...p.part('tabBadge')}>{template(text(t.badge), p.scope, get, view.format)}</span>}
      </button>)}
    </div>
    {tab && <div {...p.part('tabPanel')} role="tabpanel" id={`${base}-p${current}`} aria-labelledby={`${base}-t${current}`} key={current}><Nodes nodes={tab.children} scope={p.scope} path={`${p.path}-t${current}`} depth={p.depth} /></div>}
  </div>;
}

const views: Record<string, ComponentType<PrimitiveProps>> = {
  stack: Stack, row: Stack, column: Stack, grid: Grid, box: Box, card: Box, text: TextView, markdown: TextView, heading: Heading, stat: Stat, badge: Badge, image: ImageView,
  icon: IconView, divider: Divider, spacer: Spacer, button: Button, input: Input, select: Select, segmented: Segmented, toggle: Toggle, checkbox: Checkbox, slider: Slider,
  list: List, table: Table, progress: Progress, avatar: Avatar, tabs: Tabs,
};

/** Renders any registered directive inside a view, with its own id namespace and component context. */
function Embed({ name, props, path, open, raw, scope, depth, body, children, inline }: { inline?: string; name: string; props: Record<string, any>; path: string; open: boolean; raw?: ViewNode; scope?: ViewScope; depth?: number; body?: Node[]; children?: ReactNode }) {
  const view = useContext(ViewContext)!;
  const prism = view.prism, def = prism.registry.get(name);
  const { type: _t, when: _w, children: rawChildren, kind, ...own } = props;
  const rest: Record<string, any> = kind === undefined ? own : { ...own, [(def?.schema as { shape?: object } | undefined)?.shape && 'kind' in (def!.schema as { shape: object }).shape ? 'kind' : 'type']: kind };
  const result = useMemo(() => def?.schema ? def.schema.coerce(rest) as { value: Record<string, unknown>; issues: any[]; partial: boolean } : { value: rest, issues: [], partial: false }, [def, props]);
  const id = typeof rest.id === 'string' && rest.id ? rest.id : `${view.id}:${path}`;
  const complete = !open && !view.streaming;
  const childNodes = useMemo(() => body ?? (typeof rest.body === 'string' ? parse(rest.body).children : undefined), [body, rest.body]);
  const node = useMemo<Node>(() => ({ type: 'component', name, key: `${view.id}:${path}`, props: rest as any, children: childNodes, complete } as Node), [name, view.id, path, result, childNodes, complete]);
  const value = useMemo(() => ({ name, id, props: result.value, node, def, settled: complete }), [name, id, result, node, def, complete]);
  if (!def || name === 'state') return null;
  if (open && (def.skeleton || result.partial)) { const Skeleton = def.skeleton; return Skeleton ? <ComponentContext.Provider value={value}><Skeleton node={node} props={result.value} id={id} complete={false} partial issues={result.issues} children={null} /></ComponentContext.Provider> : <ViewSkeleton type={name} />; }
  const View = (!complete && result.partial && def.fallback) || prism.components[name] || def.component;
  const inner = children ?? (childNodes ? <MdNodes nodes={childNodes} /> : Array.isArray(rawChildren) && raw && scope ? <Nodes nodes={raw.children} scope={scope} path={path} depth={depth ?? 0} /> : null);
  const Wrap = inline ? 'span' : 'div';
  return <Wrap {...partOf(prism, 'embed')} data-name={name}><ComponentContext.Provider value={value}><View node={node} props={result.value} id={id} complete={complete} partial={result.partial} issues={result.issues}>{inner}</View></ComponentContext.Provider></Wrap>;
}

/** Headless hook for the whole view: streaming snapshot, scope, initial state and send. */
export function useView(props: ViewProps, ctx: PrismContextValue, { id, complete }: { id: string; complete: boolean }) {
  const component = useContext(ComponentContext);
  const raw = (component?.node.props ?? props) as Record<string, ViewValue>;
  const streaming = !complete;
  const tree = useMemo(() => snapshot(raw, streaming), [raw, streaming, component?.node]);
  const stateObj = tree.state && typeof tree.state === 'object' && !Array.isArray(tree.state) ? tree.state as Record<string, ViewValue> : undefined;
  const stateReady = !!stateObj && !isOpen(stateObj);
  const localKeys = stateObj ? Object.keys(stateObj).filter(k => !isOpen(stateObj) || k !== Object.keys(stateObj).at(-1)).join('\n') : '';
  const scope = useMemo<ViewScope>(() => ({ view: id, locals: new Set(localKeys ? localKeys.split('\n') : []) }), [id, localKeys]);
  const store = ctx.store;
  useLayoutEffect(() => {
    if (!stateReady || !stateObj) return;
    const init = () => store.batch(() => { for (const key of Object.keys(stateObj)) if (store.get(`${id}.${key}`) === undefined) store.set(`${id}.${key}`, stateObj[key]); }, { history: false });
    if (store.hydrated === false) void store.ready?.then(init); else init();
  }, [store, id, stateReady, stateObj]);
  const { send, sent } = useSent();
  const format = useMemo(() => viewFormatter(ctx.format), [ctx.format]);
  const config = useContext(ViewConfigContext);
  const live = useRef({ prism: ctx, send }); live.current.prism = ctx; live.current.send = send;
  const runtime = useMemo<ViewRuntime>(() => ({ id, streaming, format, config, get prism() { return live.current.prism; }, send: (type, payload, message) => live.current.send(type, payload, message) }), [id, streaming, format, config, ctx.store, ctx.registry]);
  const root = typeof tree.type === 'string' ? (({ id: _i, title: _t, state: _s, frame: _f, actions: _a, ...node }) => node)(tree as any) : tree.children;
  return { runtime, scope, root, actions: tree.actions, title: typeof tree.title === 'string' ? template(tree.title, scope, p => store.get(p), format) : undefined, frame: tree.frame === 'none' || tree.frame === 'inline' ? tree.frame : 'card', sent, streaming };
}

function DefaultBody(props: React.HTMLAttributes<HTMLDivElement>) { return <div {...props} />; }
export function View({ props, id, complete }: PrismComponentProps<ViewProps>) {
  const ctx = usePrism();
  const view = useView(props, ctx, { id, complete });
  const Body = useSlot('view', 'body', DefaultBody);
  const body = <ViewContext.Provider value={view.runtime}><Body {...partOf(ctx, 'content')} data-streaming={view.streaming ? '' : undefined}><Nodes nodes={view.root} scope={view.scope} path="n" depth={0} /></Body></ViewContext.Provider>;
  const actions = Array.isArray(view.actions) && view.actions.length ? <ViewContext.Provider value={view.runtime}><div {...partOf(ctx, 'actions')}><Nodes nodes={view.actions} scope={view.scope} path="a" depth={0} /></div></ViewContext.Provider> : undefined;
  return <ComponentFrame component="view" title={view.title} label={view.title ?? 'Interactive view'} state={view.sent ? 'sent' : view.streaming ? 'streaming' : 'ready'} undo actions={actions} variant={view.frame === 'card' ? 'card' : 'inline'} className={view.frame === 'none' ? 'prism-view--bare' : undefined}>{body}</ComponentFrame>;
}
export { iconNames };

const DOCS = `Freeform view: a safe declarative JSON UI tree, the escape hatch for any inline artifact (dashboards, forms, pickers, calculators, checklists, comparisons). No code runs: only these nodes, bindings and handlers. Streams node by node, so emit "state" first, then children top to bottom.
TOP LEVEL: {"id","title"?,"frame"?:"card"|"inline"|"none","state"?:{initial view-local values},"children":[nodes],"actions"?:[footer nodes, usually ONE primary button]}. A single node object (with "type") also works as the whole view.
NODE: {"type", ...props, "when"?: expr, "children"?: [nodes or strings]}. Strings in children are text nodes.
LAYOUT: stack {direction:"row"|"column", gap 0-8, align start|center|end|stretch|baseline, justify start|center|end|between|around, wrap}; row/column (stack shorthands); grid {cols 1-6|"auto", gap} collapses on narrow screens; card {title, subtitle, icon, badge, selected: expr, onClick} (selectable cards become accessible buttons); box {variant:"soft"|"outline"|"plain", pad 0-8}; divider {label?}; spacer.
CONTENT: text {text (inline markdown), tone, size xs|sm|md|lg|xl, weight regular|medium|semibold|bold, textAlign, mono}; markdown {text (block markdown)}; heading {text, level 1-4, subtitle, icon}; stat {label, value, format, unit, delta (number, + is up), deltaFormat, invert (down is good), hint, icon}; badge {text, tone, icon}; image {src https only, alt, ratio "16:9", fit, caption}; icon {name, tone, size}; avatar {name, src, size}; progress {value 0-1 (or with max), max, label, tone, format, showValue}; table {columns:[{key,label,align,format}] | ["key"], rows:[{...}] or {"$ref"}, sortable (default true)}; booleans render as check marks, strings as markdown.
CONTROLS (bind "value" with {"$bind":"path"}): input {label, placeholder, inputType text|number|email|date|time|search|url|tel, multiline, rows, prefix, suffix, hint, onSubmit (Enter)}; select {label, options, placeholder}; segmented {label, options} (radio group, arrow keys); toggle {label, description}; checkbox {label, description, strike}; slider {label, min, max, step, format, unit}; tabs {tabs:[{label, value?, badge?, icon?, children:[nodes]}], value?: {"$bind"}}; button {label, icon, iconRight, variant primary|secondary|ghost|outline|danger|link, size, full, disabled: expr, ariaLabel, onClick}. options: ["A","B"] or [{value, label, hint?, icon?}] (values may be strings, numbers or booleans).
LISTS: list {each:"path" (store array), item: node template, filter?: expr, limit?, divided?, ordered?, empty: "text"}. Inside item use "$item.field" paths and "$index"; $bind:"$item.done" edits that element in place.
BINDINGS: {"$bind":"path"} two-way; {"$ref":"path"} read; {"$calc":"expr"} number from the formula engine. Strings interpolate "{{ expr | format }}", e.g. "{{ seats * 12 | currency }}". Formats: number, integer, fixed:2, currency, currency:EUR, percent, percent:1 (max decimals), compact, date, time, datetime, upper, lower.
PATHS: keys declared in "state" are view-local ("seats"); "$view.x" is explicitly local; any other path ("rent", "$global.x") is the shared store, so a view can read and drive other components (e.g. a ui:num with id "rent").
EXPRESSIONS: + - * / % ^, == != < <= > >= && || ! ?:, 'string' literals, true/false, functions min max sum avg round floor ceil abs if pct; "items.*.done" maps an array; "items.length". "when" hides the node when falsy.
HANDLERS (onClick, onSubmit, onChange; one object or a list run in order): {"set":{"path":value|binding}}, {"toggle":"path"}, {"push":{"path":value}} (objects get an id), {"remove":"$item"|"path"}, {"action":"type","payload":{...bindings},"message"?:"text"} sends a structured action to the agent. All writes are one undo step.
EMBED: any registered directive by name as a node, e.g. {"type":"chart","kind":"bar","data":{"$ref":"series"}} (pass a directive's own "type" prop as "kind"); "body" is markdown children for callout/card. Primitive names win: use "dataTable" for the full data table.
STYLE: tokens only (tone neutral|accent|success|warning|danger|info|muted, size, variant, gap, pad, width auto|full|half|third|twoThirds|quarter|sm|md|lg, span 1-6 in grids, grow). No CSS, no HTML, no scripts.`;

export const view = defineComponent({
  name: 'view',
  schema: viewSchema,
  syntax: 'fence',
  component: View,
  docs: DOCS,
  examples: [
    '```ui:view\n{"id":"split","title":"Split the bill","state":{"total":120,"people":3,"tip":0.15},"children":[{"type":"grid","cols":2,"children":[{"type":"input","label":"Bill","inputType":"number","prefix":"$","value":{"$bind":"total"}},{"type":"slider","label":"People","min":1,"max":12,"value":{"$bind":"people"}}]},{"type":"segmented","label":"Tip","value":{"$bind":"tip"},"options":[{"value":0.1,"label":"10%"},{"value":0.15,"label":"15%"},{"value":0.2,"label":"20%"}]},{"type":"stat","label":"Each pays","value":{"$calc":"total * (1 + tip) / people"},"format":"currency"}],"actions":[{"type":"button","label":"Request payment","variant":"primary","onClick":{"action":"request","payload":{"each":{"$calc":"total * (1 + tip) / people"}}}}]}\n```',
  ],
  message: action => action.type === 'ask' ? 'Tell me more about this view…' : `User ${action.type} in view: ${JSON.stringify(action.payload ?? {}).slice(0, 200)}`,
});
registerComponent(view);
