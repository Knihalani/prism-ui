import { createElement, useCallback, useContext, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type ElementType, type HTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { ComponentContext, Icon, cx, useEmit, usePart, usePresentation, usePrism, useSlot, useStrings } from '@prism-ui/react';

export interface FrameOptions {
  component: string; title?: string; label?: string; state?: string; ask?: boolean; undo?: boolean;
}
export interface ComponentFrameProps extends FrameOptions {
  variant?: 'inline' | 'card';
  toolbar?: ReactNode; actions?: ReactNode; as?: ElementType; className?: string; style?: CSSProperties; children?: ReactNode;
  slotProps?: Record<string, unknown>;
}
export interface FrameSlotProps<Model = FrameModel> extends HTMLAttributes<HTMLElement> { as?: ElementType; ref?: Ref<HTMLElement>; type?: 'button'; disabled?: boolean; model?: Model; frame?: FrameModel; overflow?: unknown }
export type FramePart = 'root' | 'header' | 'title' | 'toolbar' | 'body' | 'footer' | 'ask' | 'undo' | 'overflow' | 'overflowTrigger' | 'overflowContent';

function useFramePart(component: string, part: FramePart, state?: string) {
  const frame = usePart('frame', part), own = usePart(component, part, state);
  return { ...own, className: cx(component !== 'frame' && frame.className, own.className) || undefined, style: frame.style || own.style ? { ...frame.style, ...own.style } : undefined };
}
export function useFrame({ component, title, label, state, ask = true, undo = false }: FrameOptions) {
  const { store, animate, unstyled } = usePrism(), emit = useEmit();
  const presentation = usePresentation(), strings = useStrings(component);
  const { id } = useContext(ComponentContext)!;
  const subscribe = useCallback((fn: () => void) => store.subscribe('*', fn), [store]);
  const snapshot = useCallback(() => (store.canUndo(id) ? 1 : 0) | (store.canRedo(id) ? 2 : 0), [store, id]);
  const history = useSyncExternalStore(subscribe, snapshot, snapshot);
  const onAsk = useCallback(() => emit('ask', undefined, strings.askMessage), [emit, strings.askMessage]);
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
    rootProps: { ...parts.root, ...presentation, 'data-state': state ?? presentation['data-state'],
      'data-presentation-state': state === undefined ? undefined : presentation['data-state'],
      role: 'group', 'aria-label': label ?? title ?? component, tabIndex: -1,
      'data-prism-enter': presentation['data-entering'], onKeyDown } };
}
export type FrameModel = ReturnType<typeof useFrame>;
function Element({ as = 'div', model, frame, overflow, ...props }: FrameSlotProps<unknown>) { return createElement(as, props); }
function useFrameSlot(component: string, part: FramePart) { return useSlot(component, part, useSlot('frame', part, Element)); }
export function FrameIcon({ name }: { name: 'ask' | 'undo' | 'check' }) { return <Icon name={name} />; }
export const frameStrings = { undoLabel: 'Undo', askLabel: 'Ask about this', moreLabel: 'More tools' };
export const frameParts = ['root', 'header', 'title', 'toolbar', 'body', 'footer', 'ask', 'undo', 'overflow', 'overflowTrigger', 'overflowContent'] as const;
export function ComponentFrame({ toolbar, actions, as = 'section', variant = 'inline', className, style, children, slotProps, ...options }: ComponentFrameProps) {
  const frame = useFrame(options), { parts } = frame;
  const Root = useFrameSlot(options.component, 'root'), Header = useFrameSlot(options.component, 'header'), Title = useFrameSlot(options.component, 'title');
  const Toolbar = useFrameSlot(options.component, 'toolbar'), Body = useFrameSlot(options.component, 'body'), Footer = useFrameSlot(options.component, 'footer');
  const Undo = useFrameSlot(options.component, 'undo'), Ask = useFrameSlot(options.component, 'ask');
  const strings = useStrings('frame', frameStrings);
  const modelProps = { model: frame, frame, ...slotProps };
  const iconClass = !frame.unstyled && 'prism-icon-btn';
  return <Root {...modelProps} {...frame.rootProps} as={as} data-variant={variant} className={cx(parts.root.className, className) || undefined} style={{ ...parts.root.style, ...style }}>
    {(options.title !== undefined || toolbar != null || frame.ask || frame.undo) && <Header {...modelProps} {...parts.header} as="header" data-utility-only={options.title === undefined && toolbar == null ? '' : undefined}>
      {options.title !== undefined && <Title {...modelProps} {...parts.title} as="h3">{options.title}</Title>}
      {(toolbar != null || frame.ask || frame.undo) && <Toolbar {...modelProps} {...parts.toolbar}>
        {toolbar}
        {frame.undo && <Undo {...modelProps} {...parts.undo} as="button" className={cx(parts.undo.className, iconClass) || undefined} type="button" disabled={!frame.canUndo} onClick={frame.onUndo} aria-label={strings.undoLabel} title={strings.undoLabel} aria-keyshortcuts="Control+Z Meta+Z"><FrameIcon name="undo" /></Undo>}
        {frame.ask && <Ask {...modelProps} {...parts.ask} as="button" className={cx(parts.ask.className, iconClass) || undefined} type="button" onClick={frame.onAsk} aria-label={strings.askLabel} title={strings.askLabel}><FrameIcon name="ask" /></Ask>}
      </Toolbar>}
    </Header>}
    <Body {...modelProps} {...parts.body}>{children}</Body>
    {actions != null && <Footer {...modelProps} {...parts.footer} as="footer">{actions}</Footer>}
  </Root>;
}

export function useFrameOverflow() {
  const [open, setOpen] = useState(false), trigger = useRef<HTMLElement>(null), id = useId();
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return { open, setOpen, trigger, id, close, onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
  } };
}
export interface FrameOverflowSlotProps<Model = unknown> extends HTMLAttributes<HTMLElement> { as?: ElementType; ref?: Ref<HTMLElement>; model?: Model; overflow?: ReturnType<typeof useFrameOverflow>; open?: boolean }
export function FrameOverflow({ component, model, children }: { component: string; model?: unknown; children: ReactNode }) {
  const overflow = useFrameOverflow(), strings = useStrings('frame', frameStrings);
  const Root = useFrameSlot(component, 'overflow'), Trigger = useFrameSlot(component, 'overflowTrigger'), Content = useFrameSlot(component, 'overflowContent');
  return <Root as="div" {...useFramePart(component, 'overflow')} model={model} overflow={overflow} onKeyDown={overflow.onKeyDown} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) overflow.setOpen(false); }}>
    <Trigger as="button" {...useFramePart(component, 'overflowTrigger')} model={model} overflow={overflow} ref={overflow.trigger} type="button" aria-label={strings.moreLabel} title={strings.moreLabel} aria-expanded={overflow.open} aria-controls={overflow.id} onClick={() => overflow.setOpen(!overflow.open)}><Icon name="more" strokeLinecap="round" strokeWidth={4} /></Trigger>
    <Content as="div" {...useFramePart(component, 'overflowContent')} model={model} overflow={overflow} id={overflow.id} hidden={!overflow.open}>{children}</Content>
  </Root>;
}
