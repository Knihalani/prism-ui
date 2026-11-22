import { createElement, useCallback, useSyncExternalStore, type CSSProperties, type ElementType, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { cx, useEmit, usePart, usePrism, useSlot } from '@prism-ui/react';

export interface FrameOptions {
  component: string; title?: string; label?: string; state?: string; ask?: boolean; undo?: boolean;
}
export interface ComponentFrameProps extends FrameOptions {
  toolbar?: ReactNode; actions?: ReactNode; as?: ElementType; className?: string; style?: CSSProperties; children?: ReactNode;
}
export interface FrameSlotProps extends HTMLAttributes<HTMLElement> { as?: ElementType }
export type FramePart = 'root' | 'header' | 'title' | 'toolbar' | 'body' | 'footer' | 'ask' | 'undo';

function useFramePart(component: string, part: FramePart, state?: string) {
  const frame = usePart('frame', part), own = usePart(component, part, state);
  return { ...own, className: cx(component !== 'frame' && frame.className, own.className) || undefined, style: frame.style || own.style ? { ...frame.style, ...own.style } : undefined };
}
export function useFrame({ component, title, label, state, ask = true, undo = false }: FrameOptions) {
  const { store, animate } = usePrism(), emit = useEmit();
  const subscribe = useCallback((fn: () => void) => store.subscribe('*', fn), [store]);
  const snapshot = useCallback(() => (store.canUndo ? 1 : 0) | (store.canRedo ? 2 : 0), [store]);
  const history = useSyncExternalStore(subscribe, snapshot, snapshot);
  const onAsk = useCallback(() => emit('ask'), [emit]);
  const onUndo = useCallback(() => store.undo(), [store]);
  const onRedo = useCallback(() => store.redo(), [store]);
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') (event.currentTarget.ownerDocument.activeElement as HTMLElement | null)?.blur?.();
    if (undo && !event.altKey && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault(); event.stopPropagation();
      if (event.shiftKey) store.redo(); else store.undo();
    }
  }, [store, undo]);
  const parts = {
    root: useFramePart(component, 'root', state), header: useFramePart(component, 'header'), title: useFramePart(component, 'title'),
    toolbar: useFramePart(component, 'toolbar'), body: useFramePart(component, 'body'), footer: useFramePart(component, 'footer'),
    ask: useFramePart(component, 'ask'), undo: useFramePart(component, 'undo'),
  };
  return { parts, ask, undo, animate, canUndo: !!(history & 1), canRedo: !!(history & 2), onAsk, onUndo, onRedo,
    rootProps: { ...parts.root, role: 'group', 'aria-label': label ?? title ?? component, tabIndex: -1, 'data-prism-enter': animate ? '' : undefined, onKeyDown } };
}
function Element({ as = 'div', ...props }: FrameSlotProps) { return createElement(as, props); }
function useFrameSlot(component: string, part: FramePart) { return useSlot(component, part, useSlot('frame', part, Element)); }
function Icon({ undo = false }: { undo?: boolean }) {
  return <svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d={undo ? 'M5 3 2 6l3 3M2 6h7a4 4 0 0 1 0 8' : 'M3 2.5h10v8H7l-4 3v-11Z'} /></svg>;
}
export function ComponentFrame({ toolbar, actions, as = 'section', className, style, children, ...options }: ComponentFrameProps) {
  const frame = useFrame(options), { parts } = frame;
  const Root = useFrameSlot(options.component, 'root'), Header = useFrameSlot(options.component, 'header'), Title = useFrameSlot(options.component, 'title');
  const Toolbar = useFrameSlot(options.component, 'toolbar'), Body = useFrameSlot(options.component, 'body'), Footer = useFrameSlot(options.component, 'footer');
  return <Root {...frame.rootProps} as={as} className={cx(parts.root.className, className) || undefined} style={{ ...parts.root.style, ...style }}>
    {(options.title !== undefined || toolbar != null || frame.ask || frame.undo) && <Header {...parts.header} as="header">
      {options.title !== undefined && <Title {...parts.title} as="h3">{options.title}</Title>}
      {(toolbar != null || frame.ask || frame.undo) && <Toolbar {...parts.toolbar}>
        {toolbar}
        {frame.undo && <button {...parts.undo} type="button" disabled={!frame.canUndo} onClick={frame.onUndo} aria-keyshortcuts="Control+Z Meta+Z"><Icon undo />Undo</button>}
        {frame.ask && <button {...parts.ask} type="button" onClick={frame.onAsk}><Icon />Ask about this</button>}
      </Toolbar>}
    </Header>}
    <Body {...parts.body}>{children}</Body>
    {actions != null && <Footer {...parts.footer} as="footer">{actions}</Footer>}
  </Root>;
}
