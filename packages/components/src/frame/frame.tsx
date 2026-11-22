import { createElement, useCallback, useContext, useSyncExternalStore, type CSSProperties, type ElementType, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { ComponentContext, cx, useEmit, usePart, usePrism, useSlot } from '@prism-ui/react';

export interface FrameOptions {
  component: string; title?: string; label?: string; state?: string; ask?: boolean; undo?: boolean;
}
export interface ComponentFrameProps extends FrameOptions {
  variant?: 'inline' | 'card';
  toolbar?: ReactNode; actions?: ReactNode; as?: ElementType; className?: string; style?: CSSProperties; children?: ReactNode;
}
export interface FrameSlotProps extends HTMLAttributes<HTMLElement> { as?: ElementType }
export type FramePart = 'root' | 'header' | 'title' | 'toolbar' | 'body' | 'footer' | 'ask' | 'undo';

function useFramePart(component: string, part: FramePart, state?: string) {
  const frame = usePart('frame', part), own = usePart(component, part, state);
  return { ...own, className: cx(component !== 'frame' && frame.className, own.className) || undefined, style: frame.style || own.style ? { ...frame.style, ...own.style } : undefined };
}
export function useFrame({ component, title, label, state, ask = true, undo = false }: FrameOptions) {
  const { store, animate, unstyled } = usePrism(), emit = useEmit();
  const { id } = useContext(ComponentContext)!;
  const subscribe = useCallback((fn: () => void) => store.subscribe('*', fn), [store]);
  const snapshot = useCallback(() => (store.canUndo(id) ? 1 : 0) | (store.canRedo(id) ? 2 : 0), [store, id]);
  const history = useSyncExternalStore(subscribe, snapshot, snapshot);
  const onAsk = useCallback(() => emit('ask'), [emit]);
  const onUndo = useCallback(() => store.undo(id), [store, id]);
  const onRedo = useCallback(() => store.redo(id), [store, id]);
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') (event.currentTarget.ownerDocument.activeElement as HTMLElement | null)?.blur?.();
    if (undo && !event.altKey && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault(); event.stopPropagation();
      if (event.shiftKey) store.redo(id); else store.undo(id);
    }
  }, [store, undo, id]);
  const parts = {
    root: useFramePart(component, 'root', state), header: useFramePart(component, 'header'), title: useFramePart(component, 'title'),
    toolbar: useFramePart(component, 'toolbar'), body: useFramePart(component, 'body'), footer: useFramePart(component, 'footer'),
    ask: useFramePart(component, 'ask'), undo: useFramePart(component, 'undo'),
  };
  return { parts, ask, undo, animate, unstyled, canUndo: !!(history & 1), canRedo: !!(history & 2), onAsk, onUndo, onRedo,
    rootProps: { ...parts.root, role: 'group', 'aria-label': label ?? title ?? component, tabIndex: -1, 'data-prism-enter': animate ? '' : undefined, onKeyDown } };
}
function Element({ as = 'div', ...props }: FrameSlotProps) { return createElement(as, props); }
function useFrameSlot(component: string, part: FramePart) { return useSlot(component, part, useSlot('frame', part, Element)); }
const icons = {
  ask: 'M13 7.5A5.5 5.5 0 0 1 7.5 13H3l1-2.5a5.5 5.5 0 1 1 9-3Z',
  undo: 'M5 3 2 6l3 3M2 6h7a3.5 3.5 0 0 1 0 7H6',
  check: 'm3.5 8 3 3 6-6',
};
export function FrameIcon({ name }: { name: keyof typeof icons }) {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d={icons[name]} /></svg>;
}
export function ComponentFrame({ toolbar, actions, as = 'section', variant = 'inline', className, style, children, ...options }: ComponentFrameProps) {
  const frame = useFrame(options), { parts } = frame;
  const Root = useFrameSlot(options.component, 'root'), Header = useFrameSlot(options.component, 'header'), Title = useFrameSlot(options.component, 'title');
  const Toolbar = useFrameSlot(options.component, 'toolbar'), Body = useFrameSlot(options.component, 'body'), Footer = useFrameSlot(options.component, 'footer');
  const iconClass = !frame.unstyled && 'prism-icon-btn';
  return <Root {...frame.rootProps} as={as} data-variant={variant} className={cx(parts.root.className, className) || undefined} style={{ ...parts.root.style, ...style }}>
    {(options.title !== undefined || toolbar != null || frame.ask || frame.undo) && <Header {...parts.header} as="header" data-utility-only={options.title === undefined && toolbar == null ? '' : undefined}>
      {options.title !== undefined && <Title {...parts.title} as="h3">{options.title}</Title>}
      {(toolbar != null || frame.ask || frame.undo) && <Toolbar {...parts.toolbar}>
        {toolbar}
        {frame.undo && <button {...parts.undo} className={cx(parts.undo.className, iconClass) || undefined} type="button" disabled={!frame.canUndo} onClick={frame.onUndo} aria-label="Undo" title="Undo" aria-keyshortcuts="Control+Z Meta+Z"><FrameIcon name="undo" /></button>}
        {frame.ask && <button {...parts.ask} className={cx(parts.ask.className, iconClass) || undefined} type="button" onClick={frame.onAsk} aria-label="Ask about this" title="Ask about this"><FrameIcon name="ask" /></button>}
      </Toolbar>}
    </Header>}
    <Body {...parts.body}>{children}</Body>
    {actions != null && <Footer {...parts.footer} as="footer">{actions}</Footer>}
  </Root>;
}
