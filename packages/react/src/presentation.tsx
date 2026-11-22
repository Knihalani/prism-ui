import { useCallback, useContext, useMemo, useSyncExternalStore, type HTMLAttributes } from 'react';
import { ComponentContext, PrismPart, usePrism, type Action } from './context';
import { useActionDispatch } from './hooks';

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
    'data-exiting': motion && exiting ? '' : undefined,
  } as const;
}

/** Optional explicit cursor for custom Markdown renderers. */
export function StreamCaret() {
  return <span className="prism-stream-caret" aria-hidden="true" />;
}

type StreamSkeletonProps = HTMLAttributes<HTMLElement> & { as?: 'div' | 'span' };
export function StreamSkeleton({ as: Element = 'div', ...props }: StreamSkeletonProps) {
  return <PrismPart as={Element} {...props} aria-hidden="true" data-state="streaming" data-prism-skeleton="" />;
}
