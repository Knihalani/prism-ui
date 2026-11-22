import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type HTMLAttributes } from 'react';
import { ComponentContext, PrismPart, usePrism, type Action } from './context';
import { useActionDispatch } from './hooks';
import { motionDuration, useReducedMotion } from './motion';

export type PresentationState = 'streaming' | 'ready' | 'sent';

export type Receipt = ReturnType<typeof createReceipt>;
export function createReceipt() {
  let action: Action | undefined;
  let version = 0;
  const listeners = new Set<() => void>();
  function update(next: Action | undefined) {
    if (action === next) return;
    action = next;
    listeners.forEach(listener => listener());
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    snapshot: () => action,
    begin() {
      const request = ++version;
      return (action: Action) => { if (request === version) update(action); };
    },
    reset() { version++; update(undefined); },
  };
}
const emptyReceipt = createReceipt();
const serverSnapshot = () => undefined;

export function useSettled(): boolean {
  const component = useContext(ComponentContext);
  return component?.settled ?? (component?.node.complete !== false);
}

/** Opt a primary action into a local receipt after the application's handler runs. */
export function useSent() {
  const component = useContext(ComponentContext);
  const local = useMemo(createReceipt, [component?.id]);
  const receipt = component?.receipt ?? local;
  const dispatch = useActionDispatch();
  const sent = useSyncExternalStore(receipt.subscribe, receipt.snapshot, serverSnapshot);
  const send = useCallback((type: string, payload?: unknown, message?: string) => {
    dispatch(type, payload, message, receipt.begin());
  }, [dispatch, receipt]);
  return { sent, send, reset: receipt.reset };
}

/** Spread on a component's existing root. No wrapper or per-item effects are required. */
export function usePresentation({ exiting = false } = {}) {
  const { animate, unstyled } = usePrism();
  const receipt = useContext(ComponentContext)?.receipt ?? emptyReceipt;
  const settled = useSettled();
  const sent = useSyncExternalStore(receipt.subscribe, receipt.snapshot, serverSnapshot);
  const state: PresentationState = !settled ? 'streaming' : sent ? 'sent' : 'ready';
  const motion = animate && !unstyled;
  return {
    'data-state': state,
    'data-entering': motion && !exiting ? '' : undefined,
    'data-prism-enter': motion && !exiting ? '' : undefined,
    'data-exiting': motion && exiting ? '' : undefined,
  } as const;
}

/** Optional explicit cursor for custom Markdown renderers. */
export function StreamCaret() {
  return <span className="prism-stream-caret" aria-hidden="true" />;
}

type StreamSkeletonProps = HTMLAttributes<HTMLElement> & { as?: 'div' | 'span' | 'li'; slotProps?: Record<string, unknown> };
export function StreamSkeleton({ as: Element = 'div', ...props }: StreamSkeletonProps) {
  const ref = useRef<HTMLElement>(null), reduced = useReducedMotion();
  const instant = useRef(reduced); instant.current = reduced;
  useLayoutEffect(() => () => {
    const element = ref.current, parent = element?.parentElement;
    if (instant.current || !element || !parent?.closest('.prism-root[data-prism-presentation]')) return;
    const rect = element.getBoundingClientRect(), computed = getComputedStyle(element);
    const duration = motionDuration(computed.getPropertyValue('--prism-motion-fast'), 160);
    if (!duration || !rect.width || !rect.height) return;
    const ghost = element.cloneNode(true) as HTMLElement;
    ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(child => child.removeAttribute('id'));
    ghost.inert = true; ghost.setAttribute('data-prism-skeleton-exit', '');
    Object.assign(ghost.style, { position: 'absolute', width: `${rect.width}px`, height: `${rect.height}px`, margin: '0', opacity: computed.opacity, pointerEvents: 'none' });
    queueMicrotask(() => {
      if (element.isConnected || !parent.isConnected) return;
      parent.append(ghost);
      const container = ghost.offsetParent as HTMLElement | null;
      const initial = !container || container === document.body && getComputedStyle(container).position === 'static';
      const bounds = !initial ? container!.getBoundingClientRect() : { left: -window.scrollX, top: -window.scrollY };
      ghost.style.left = `${rect.left - bounds.left + (initial ? 0 : container!.scrollLeft - container!.clientLeft)}px`;
      ghost.style.top = `${rect.top - bounds.top + (initial ? 0 : container!.scrollTop - container!.clientTop)}px`;
      ghost.getBoundingClientRect(); ghost.style.opacity = '0';
      setTimeout(() => ghost.remove(), duration);
    });
  }, []);
  return <PrismPart as={Element} {...props} ref={ref} aria-hidden="true" data-state="streaming" data-prism-skeleton="" />;
}
