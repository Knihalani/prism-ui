import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Node } from '@prism-ui/core';
import type { Registry } from './registry';
import type { Store } from '@prism-ui/state';
import { usePrism, type PrismContextValue } from './context';

const hidden: CSSProperties = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: 0 };
const AnnouncementContext = createContext<((text: string) => void) | null>(null);
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

export function createAnnouncementQueue(publish: (text: string) => void) {
  let pending: string[] = [], timer: ReturnType<typeof setTimeout> | undefined;
  function flush() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (pending.length) { const text = pending.join('\n'); pending = []; publish(text); }
  }
  return {
    push(text: string) { text = normalize(text); if (!text) return; pending.push(text); timer ??= setTimeout(flush, 700); },
    flush,
    clear() { if (timer !== undefined) clearTimeout(timer); timer = undefined; pending = []; },
  };
}

function resolve(value: unknown, store: Store): any {
  if (!value || typeof value !== 'object') return value;
  if ('$ref' in value && typeof value.$ref === 'string') return store.get(value.$ref);
  if (Array.isArray(value)) return value.map(item => resolve(item, store));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item, store)]));
}

export function blockAnnouncement(node: Node, registry: Registry, context: Pick<PrismContextValue, 'store' | 'format'>): string {
  if (node.type === 'component' && node.name === 'state') return '';
  const name = node.type === 'component' ? node.name! : node.type;
  const def = registry.get(name);
  if (def || node.type === 'component') {
    const raw = resolve(node.props ?? {}, context.store);
    const props = def?.schema?.coerce(raw).value ?? raw;
    if (def?.announcement) {
      try { return normalize(def.announcement(props, node, context)); } catch { /* Fall back to the component's label. */ }
    }
    const label = props.title ?? props.label ?? props.question ?? props.name ?? def?.strings?.title ?? name;
    const value = props.value ?? props.summary ?? props.description ?? props.insight ?? props.subtitle;
    const detail = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    const count = ['items', 'options', 'data', 'fields', 'points'].find(key => Array.isArray(props[key]));
    return normalize([typeof label === 'string' ? label : name, detail, count ? `${props[count].length} ${count}` : ''].filter(Boolean).join('. '));
  }
  if (node.type === 'image') return node.value ?? node.title ?? '';
  if (node.children) return node.children.map(child => blockAnnouncement(child, registry, context)).join(['paragraph', 'heading', 'strong', 'emphasis', 'link'].includes(node.type) ? '' : ' ');
  return node.value ?? '';
}

export function AnnouncementBoundary({ nodes, done, identity, enabled, registry, store, children }: {
  nodes: Node[]; done: boolean; identity: unknown; enabled: boolean; registry: Registry; store: Store; children: ReactNode;
}) {
  const { format } = usePrism();
  const [message, setMessage] = useState({ text: '', revision: 0 });
  const queue = useMemo(() => createAnnouncementQueue(text => setMessage(previous => ({ text, revision: previous.revision + 1 }))), []);
  const active = useRef(enabled); active.current = enabled;
  const announce = useMemo(() => (text: string) => { if (active.current) queue.push(text); }, [queue]);
  const session = useRef({ identity, eligible: !done, seen: new Set<string>() });
  useEffect(() => {
    if (session.current.identity !== identity) {
      queue.clear(); session.current = { identity, eligible: !done, seen: new Set() };
      setMessage(previous => ({ text: '', revision: previous.revision + 1 }));
    }
    const current = session.current;
    if (!enabled) queue.clear();
    for (const node of nodes) {
      if (!Object.isFrozen(node) || current.seen.has(node.key)) continue;
      current.seen.add(node.key);
      if (enabled && current.eligible) queue.push(blockAnnouncement(node, registry, { store, format }));
    }
    if (done) queue.flush();
  });
  useEffect(() => () => { queue.clear(); session.current.seen.clear(); }, [queue]);
  return <AnnouncementContext.Provider value={announce}>
    {children}
    {enabled && <span data-prism-announcer="" role="status" aria-live="polite" aria-atomic="true" style={hidden}><span key={message.revision}>{message.text}</span></span>}
  </AnnouncementContext.Provider>;
}

/** Announce changed final values after they settle, never initial or streaming values. */
export function useValueAnnouncement(value: string, complete: boolean) {
  const announce = useContext(AnnouncementContext), previous = useRef<{ value: string; complete: boolean } | null>(null);
  useEffect(() => {
    if (!previous.current) {
      let active = true;
      queueMicrotask(() => { if (active) previous.current = { value, complete }; });
      return () => { active = false; };
    }
    if (!complete || !previous.current.complete) {
      previous.current = { value, complete };
      return;
    }
    if (value === previous.current.value) return;
    const timer = setTimeout(() => {
      previous.current = { value, complete };
      announce?.(value);
    }, 700);
    return () => clearTimeout(timer);
  }, [value, complete, announce]);
}

/** Announce a receipt only on a transition, never when mounting saved sent state. */
export function useSentAnnouncement(sent: boolean, label: string) {
  const announce = useContext(AnnouncementContext), previous = useRef(sent);
  useEffect(() => {
    if (sent && !previous.current) announce?.(label);
    previous.current = sent;
  }, [sent, label, announce]);
  return null;
}
