import { Children, createContext, useContext, useId, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent } from 'react';
import { useComponentState, usePart, usePrism, useSlot, type PrismComponentProps } from '@prism-ui/react';

export interface TabsProps { id?: string; label?: string; variant?: 'underline' | 'pill'; size?: 'sm' | 'md'; fitted?: boolean }
export interface TabProps { id?: string; label?: string; badge?: string }
interface TabGroup { keys: string[]; active: number; tabId(key: string): string; panelId(key: string): string }
const TabsContext = createContext<TabGroup | null>(null);
function Body(props: HTMLAttributes<HTMLDivElement>) { return <div {...props} />; }
function Title(props: HTMLAttributes<HTMLElement>) { return <h3 {...props} />; }
function Label(props: HTMLAttributes<HTMLSpanElement>) { return <span {...props} />; }

export function useTabs(props: TabsProps, ctx: Pick<PrismComponentProps, 'node' | 'complete' | 'children'>) {
  const { animate } = usePrism(), prefix = useId(), [stored, setActive] = useComponentState<number>('active', 0);
  const tabs = (ctx.node.children ?? []).filter(node => node.type === 'component' && node.name === 'tab');
  const active = tabs.length ? Math.max(0, Math.min(tabs.length - 1, Number.isFinite(stored) ? Math.trunc(stored) : 0)) : -1;
  const state = ctx.complete ? 'done' : 'streaming';
  const parts = { root: usePart('tabs', 'root', state), list: usePart('tabs', 'list', state), tab: usePart('tabs', 'tab', state), label: usePart('tabs', 'label', state), badge: usePart('tabs', 'badge', state), body: usePart('tabs', 'body', state), indicator: usePart('tabs', 'indicator', state), skeleton: usePart('tabs', 'skeleton', state) };
  const listRef = useRef<HTMLDivElement>(null), [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const signature = tabs.map(tab => tab.key + ':' + String(tab.props?.label ?? '')).join('|');
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
  return { parts, tabs, active, group, rendered, listRef, select, onKeyDown, indicator,
    rootProps: { ...parts.root, 'data-state': state, 'data-variant': props.variant ?? 'underline', 'data-size': props.size ?? 'md', 'data-fitted': props.fitted ? '' : undefined, 'data-prism-enter': animate ? '' : undefined },
    indicatorStyle: { ...parts.indicator.style, '--prism-tabs-indicator-left': indicator.left + 'px', '--prism-tabs-indicator-width': indicator.width + 'px' } as CSSProperties };
}
export function Tabs({ props, ...ctx }: PrismComponentProps<TabsProps>) {
  const model = useTabs(props, ctx), { parts, group } = model;
  const BodySlot = useSlot('tabs', 'body', Body), LabelSlot = useSlot('tabs', 'label', Label);
  return <TabsContext.Provider value={group}><div {...model.rootProps}>
    <div {...parts.list} ref={model.listRef} role="tablist" aria-label={props.label ?? 'Tabs'} data-measured={model.indicator.width > 0 ? '' : undefined}>
      {model.tabs.map((tab, index) => <button {...parts.tab} type="button" role="tab" key={tab.key} id={group.tabId(tab.key)} aria-controls={group.panelId(tab.key)} aria-selected={index === model.active} tabIndex={index === model.active ? 0 : -1} onClick={() => model.select(index)} onKeyDown={event => model.onKeyDown(event, index)}>
        <LabelSlot {...parts.label}>{typeof tab.props?.label === 'string' && tab.props.label ? tab.props.label : <span {...parts.skeleton} aria-label="Loading tab" />}</LabelSlot>
        {tab.props?.badge != null && <span {...parts.badge}>{String(tab.props.badge)}</span>}
      </button>)}
      <span {...parts.indicator} style={model.indicatorStyle} aria-hidden="true" />
    </div>
    <BodySlot {...parts.body}>{model.rendered}</BodySlot>
  </div></TabsContext.Provider>;
}
export function useTab(props: TabProps, ctx: Pick<PrismComponentProps, 'node' | 'complete'>) {
  const group = useContext(TabsContext), { animate } = usePrism(), state = ctx.complete ? 'done' : 'streaming';
  const index = group?.keys.indexOf(ctx.node.key) ?? -1, grouped = !!group && index >= 0;
  return { grouped, title: usePart('tab', 'title', state), body: usePart('tab', 'body', state),
    rootProps: { ...usePart('tab', 'root', state), role: grouped ? 'tabpanel' : undefined, id: grouped ? group.panelId(ctx.node.key) : props.id, 'aria-labelledby': grouped ? group.tabId(ctx.node.key) : undefined, 'aria-label': grouped ? undefined : props.label, hidden: grouped ? group.active !== index : undefined, tabIndex: grouped ? 0 : undefined, 'data-prism-enter': animate ? '' : undefined } };
}
export function Tab({ props, children, ...ctx }: PrismComponentProps<TabProps>) {
  const model = useTab(props, ctx), BodySlot = useSlot('tab', 'body', Body), TitleSlot = useSlot('tab', 'title', Title);
  return <section {...model.rootProps}>{!model.grouped && props.label && <TitleSlot {...model.title}>{props.label}</TitleSlot>}<BodySlot {...model.body}>{children}</BodySlot></section>;
}
