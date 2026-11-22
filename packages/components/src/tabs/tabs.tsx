import { componentStrings } from '../strings';
import { Children, createContext, useContext, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from 'react';
import { useStrings, PrismPart, cx, StreamSkeleton, useComponentState, useFlash, usePart, usePresentation, usePrism, type PrismComponentProps } from '@prism-ui/react';

export interface TabsProps { id?: string; title?: string; label?: string; variant?: 'underline' | 'pill'; size?: 'sm' | 'md'; fitted?: boolean }
export interface TabProps { id?: string; label?: string; badge?: string }
interface TabGroup { keys: string[]; active: number; tabId(key: string): string; panelId(key: string): string }
const TabsContext = createContext<TabGroup | null>(null);
function reference(value: unknown) {
  return value && typeof value === 'object' && Object.hasOwn(value, '$ref') && '$ref' in value && typeof value.$ref === 'string' ? value.$ref : undefined;
}
function LinkedTabText({ path, text, tabs }: { path: string; text: string; tabs: TabsModel }) {
  const flash = useFlash(path);
  return <PrismPart as="span" {...usePart('tabs', 'linkedText')} slotProps={{ tabs } satisfies TabsSlotProps} data-prism-flash={flash ? '' : undefined}>{text}</PrismPart>;
}
function useTabValues(node: PrismComponentProps['node']) {
  const { store } = usePrism();
  const watch = useMemo(() => {
    const values = (node.children ?? []).filter(child => child.type === 'component' && child.name === 'tab').flatMap(tab => [tab.props?.label, tab.props?.badge]);
    const paths = [...new Set(values.map(reference).filter((path): path is string => path !== undefined))];
    return {
      subscribe(fn: () => void) { const offs = paths.map(path => store.subscribe(path, fn)); return () => offs.forEach(off => off()); },
      snapshot() {
        return JSON.stringify(values.map(value => {
          const path = reference(value), resolved = path === undefined ? value : store.get(path);
          return typeof resolved === 'string' || typeof resolved === 'number' ? String(resolved) : null;
        }));
      },
    };
  }, [node, store]);
  return JSON.parse(useSyncExternalStore(watch.subscribe, watch.snapshot, watch.snapshot)) as (string | null)[];
}

export function useTabs(props: TabsProps, ctx: Pick<PrismComponentProps, 'node' | 'complete' | 'children'>) {
  const strings = useStrings('tabs', componentStrings.tabs, props);
  const presentation = usePresentation(), prefix = useId(), [stored, setActive] = useComponentState<number>('active', 0);
  const values = useTabValues(ctx.node);
  const tabs = (ctx.node.children ?? []).filter(node => node.type === 'component' && node.name === 'tab').map((tab, index) => ({
    ...tab, labelPath: reference(tab.props?.label), badgePath: reference(tab.props?.badge),
    props: { ...tab.props, label: values[index * 2], badge: values[index * 2 + 1] },
  }));
  const active = tabs.length ? Math.max(0, Math.min(tabs.length - 1, Number.isFinite(stored) ? Math.trunc(stored) : 0)) : -1;
  const state = ctx.complete ? 'done' : 'streaming';
  const parts = { root: usePart('tabs', 'root', state), list: usePart('tabs', 'list', state), tab: usePart('tabs', 'tab', state), label: usePart('tabs', 'label', state), badge: usePart('tabs', 'badge', state), body: usePart('tabs', 'body', state), indicator: usePart('tabs', 'indicator', state), skeleton: usePart('tabs', 'skeleton', state) };
  const listRef = useRef<HTMLDivElement>(null), [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const signature = JSON.stringify(tabs.map(tab => [tab.key, tab.props.label, tab.props.badge]));
  useLayoutEffect(() => { if (tabs.length && stored !== active) setActive(active); }, [tabs.length, stored, active, setActive]);
  useLayoutEffect(() => {
    const list = listRef.current;
    const measure = () => {
      const button = list?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]');
      const next = { left: button?.offsetLeft ?? 0, width: button?.offsetWidth ?? 0 };
      setIndicator(old => old.left === next.left && old.width === next.width ? old : next);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    if (list) { observer?.observe(list); Array.from(list.querySelectorAll('button')).forEach(button => observer?.observe(button)); }
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [active, signature, props.variant, props.size, props.fitted]);
  const select = (index: number, focus = false) => {
    if (!tabs.length) return;
    const next = (index + tabs.length) % tabs.length;
    setActive(next);
    if (focus) listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    switch (event.key) {
      case 'ArrowLeft': next = index - 1; break;
      case 'ArrowRight': next = index + 1; break;
      case 'Home': next = 0; break;
      case 'End': next = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault(); select(next, true);
  };
  const group: TabGroup = { keys: tabs.map(tab => tab.key), active, tabId: key => prefix + '-tab-' + key, panelId: key => prefix + '-panel-' + key };
  const rendered = Children.toArray(ctx.children).filter((_, index) => ctx.node.children?.[index]?.type === 'component' && ctx.node.children[index].name === 'tab');
  return { parts, strings, title: strings.title, label: strings.label ?? strings.title ?? strings.tablistLabel, tabs, active, group, rendered, listRef, select, onKeyDown, indicator,
    rootProps: { ...parts.root, ...presentation, 'data-variant': props.variant ?? 'underline', 'data-size': props.size ?? 'md', 'data-fitted': props.fitted ? '' : undefined },
    indicatorStyle: { ...parts.indicator.style, '--prism-tabs-indicator-left': indicator.left + 'px', '--prism-tabs-indicator-width': indicator.width + 'px' } as CSSProperties };
}
export type TabsModel = ReturnType<typeof useTabs>;
export interface TabsSlotProps { tabs: TabsModel; tab?: TabsModel['tabs'][number] }
export function Tabs({ props, ...ctx }: PrismComponentProps<TabsProps>) {
  const model = useTabs(props, ctx), { parts, group, strings: themeStrings } = model;
  const { unstyled } = usePrism();
  const title = usePart('tabs', 'title');
  return <TabsContext.Provider value={group}><PrismPart slotProps={{ tabs: model } satisfies TabsSlotProps} as="div" {...model.rootProps}>
    {model.title && <PrismPart slotProps={{ tabs: model } satisfies TabsSlotProps} as="h3" {...title}>{model.title}</PrismPart>}
    <PrismPart slotProps={{ tabs: model } satisfies TabsSlotProps} as="div" {...parts.list} ref={model.listRef} role="tablist" aria-label={model.label} data-measured={model.indicator.width > 0 ? '' : undefined}>
      {model.tabs.map((tab, index) => <PrismPart as="button" {...parts.tab} slotProps={{ tabs: model, tab } satisfies TabsSlotProps} type="button" role="tab" key={tab.key} id={group.tabId(tab.key)} aria-label={tab.props.label ? undefined : themeStrings.loadingTab} aria-controls={group.panelId(tab.key)} aria-selected={index === model.active} tabIndex={index === model.active ? 0 : -1} onClick={() => model.select(index)} onKeyDown={event => model.onKeyDown(event, index)}>
        <PrismPart slotProps={{ tabs: model } satisfies TabsSlotProps} as="span" {...parts.label}>{tab.props.label
          ? !unstyled && tab.labelPath !== undefined ? <LinkedTabText tabs={model} key={tab.labelPath} path={tab.labelPath} text={tab.props.label} /> : tab.props.label
          : unstyled || ctx.complete ? <PrismPart slotProps={{ tabs: model } satisfies TabsSlotProps} as="span" {...parts.skeleton} aria-hidden="true" /> : <StreamSkeleton {...parts.skeleton} as="span" data-prism-skeleton-line="" />}</PrismPart>
        {tab.props.badge != null && <PrismPart slotProps={{ tabs: model } satisfies TabsSlotProps} as="span" {...parts.badge} className={cx(parts.badge.className, !unstyled && 'prism-chip') || undefined}>
          {!unstyled && tab.badgePath !== undefined ? <LinkedTabText tabs={model} key={tab.badgePath} path={tab.badgePath} text={tab.props.badge} /> : tab.props.badge}
        </PrismPart>}
      </PrismPart>)}
      <PrismPart slotProps={{ tabs: model } satisfies TabsSlotProps} as="span" {...parts.indicator} style={model.indicatorStyle} aria-hidden="true" />
    </PrismPart>
    <PrismPart slotProps={{ tabs: model } satisfies TabsSlotProps} as="div" {...parts.body}>{model.rendered}</PrismPart>
  </PrismPart></TabsContext.Provider>;
}
export function useTab(props: TabProps, ctx: Pick<PrismComponentProps, 'node' | 'complete'>) {
  const group = useContext(TabsContext), presentation = usePresentation(), state = ctx.complete ? 'done' : 'streaming';
  const index = group?.keys.indexOf(ctx.node.key) ?? -1, grouped = !!group && index >= 0;
  return { grouped, title: usePart('tab', 'title', state), body: usePart('tab', 'body', state),
    rootProps: { ...usePart('tab', 'root', state), ...presentation, role: grouped ? 'tabpanel' : undefined, id: grouped ? group.panelId(ctx.node.key) : props.id, 'aria-labelledby': grouped ? group.tabId(ctx.node.key) : undefined, 'aria-label': grouped ? undefined : props.label, hidden: grouped ? group.active !== index : undefined, tabIndex: grouped ? 0 : undefined } };
}
export type TabModel = ReturnType<typeof useTab>;
export interface TabSlotProps { tab: TabModel }
export function Tab({ props, children, ...ctx }: PrismComponentProps<TabProps>) {
  const model = useTab(props, ctx);
  return <PrismPart slotProps={{ tab: model } satisfies TabSlotProps} as="section" {...model.rootProps}>{!model.grouped && props.label && <PrismPart slotProps={{ tab: model } satisfies TabSlotProps} as="h3" {...model.title}>{props.label}</PrismPart>}<PrismPart slotProps={{ tab: model } satisfies TabSlotProps} as="div" {...model.body}>{children}</PrismPart></PrismPart>;
}
