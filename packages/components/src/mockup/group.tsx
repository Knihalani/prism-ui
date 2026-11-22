import { useCallback, useContext, useEffect, useState, useId, useLayoutEffect, useMemo, useReducer, useRef, useSyncExternalStore, type KeyboardEvent, type RefObject } from 'react';
import { ComponentContext, useComponentState, useSent, usePresentation, usePart, usePrism } from '@prism-ui/react';
import type { Store } from '@prism-ui/state';
import { ComponentFrame } from '../frame';
import { toMessage, type FeedbackPayload } from './engine';
import { MockupView } from './mockup';
import { MockupToolbar, MockupPenTools, MockupSource, MockupFooter } from './chrome';
import { MockupIcon as Icon } from './icon';
import { mockupLabels, useMockup, type MockupOptions, type MockupProps, type MockupModel, type MockupDevice, type MockupControls } from './use-mockup';

interface Member { key: string; id: string; props: MockupProps; complete: boolean; context: NonNullable<React.ContextType<typeof ComponentContext>> }
function order(a: Member, b: Member) { const left = a.key.split('.').map(Number), right = b.key.split('.').map(Number); for (let i = 0; i < Math.min(left.length, right.length); i++) { if (left[i] !== right[i]) return left[i] - right[i]; } return left.length - right.length; }
function consecutive(a: Member, b: Member) { const left = a.key.split('.'), right = b.key.split('.'); return left.length === right.length && left.slice(0, -1).join('.') === right.slice(0, -1).join('.') && Number(right.at(-1)) === Number(left.at(-1)) + 1; }
function createGroup() {
  let members: Member[] = [];
  const listeners = new Set<() => void>();
  const publish = () => { for (const listener of listeners) listener(); };
  return { snapshot: () => members, subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    put(member: Member) { if (members.find(m => m.key === member.key) === member) return; members = [...members.filter(m => m.key !== member.key), member].sort(order); publish(); },
    remove(key: string) { members = members.filter(m => m.key !== key); publish(); },
  };
}
const groups = new WeakMap<Store, Map<string, ReturnType<typeof createGroup>>>();
function registry(store: Store, group: string) { let map = groups.get(store); if (!map) groups.set(store, map = new Map()); let entry = map.get(group); if (!entry) map.set(group, entry = createGroup()); return entry; }
function variant(member: Member, index: number) { return member.props.variant ?? String.fromCharCode(65 + index); }

export function GroupedMockup({ props, options }: { props: MockupProps; options?: MockupOptions }) {
  const context = useContext(ComponentContext)!, { store } = usePrism();
  const group = useMemo(() => registry(store, props.group!), [store, props.group]);
  const member = useMemo<Member>(() => ({ key: context.node.key, id: context.id, props, complete: context.node.complete !== false, context }), [context, props]);
  const snapshot = useSyncExternalStore(group.subscribe, group.snapshot, group.snapshot);
  useLayoutEffect(() => { group.put(member); }, [group, member]);
  useLayoutEffect(() => () => group.remove(member.key), [group, member.key]);
  const all = [...snapshot.filter(m => m.key !== member.key), member].sort(order), position = all.findIndex(m => m.key === member.key);
  let first = position, last = position;
  while (first > 0 && consecutive(all[first - 1], all[first])) first--;
  while (last + 1 < all.length && consecutive(all[last], all[last + 1])) last++;
  if (first !== position) return null;
  return <MockupGroupView members={all.slice(first, last + 1)} options={options} />;
}

export interface MockupGroupPayload extends FeedbackPayload { variants: { variant: string; items: FeedbackPayload['items'] }[]; preferred?: string }
export function useMockupGroup(members: readonly Member[]) {
  const { format } = usePrism();
  const receipt = useSent(), [tab, writeTab] = useComponentState('groupTab', members[0].key), [selectedVariant, setSelectedVariant] = useComponentState('groupVariant', members[0].key), [overall, setOverall] = useComponentState('groupOverall', ''), [preferred, setPreferred] = useComponentState<string | undefined>('groupPreferred', undefined), [submitted, writeSubmitted] = useComponentState('groupSubmitted', false);
  function setSubmitted(value: boolean) { if (!value) receipt.reset(); writeSubmitted(value); }
  function setTab(key: string) { writeTab(key); if (key !== 'compare') setSelectedVariant(key); }
  const models = useRef(new Map<string, RefObject<MockupModel>>()), [, refresh] = useReducer(n => n + 1, 0);
  const register = useCallback((key: string, model: RefObject<MockupModel>) => { models.current.set(key, model); refresh(); const off = model.current!.feedback.subscribe(refresh); return () => { off(); models.current.delete(key); }; }, []);
  const active = members.find(m => m.key === (tab === 'compare' ? selectedVariant : tab)) ?? members[0], compare = tab === 'compare', labels = { ...mockupLabels, ...members[0].props.labels };
  const payloads = () => members.map((member, index) => ({ member, payload: { ...(models.current.get(member.key)?.current?.feedback.toPayload() ?? { overall: '', items: [] }), mockup: member.props.title ?? labels.title, variant: variant(member, index) } }));
  const count = [...models.current.values()].reduce((n, model) => { const vm = model.current; return n + (vm?.feedback.getState().items.filter(item => item.kind === 'drawing' || (vm.editing?.id === item.id ? vm.comment : item.comment).trim()).length ?? 0); }, 0);
  const canSubmit = !!overall.trim() || [...models.current.values()].some(model => model.current && (model.current.feedback.canSubmit || (model.current.editing && model.current.comment.trim()))) || preferred !== undefined;
  function submit() {
    if (!canSubmit) return;
    for (const model of models.current.values()) model.current?.save();
    const entries = payloads();
    const selected = entries.find(entry => entry.member.key === active.key)!.payload;
    const payload: MockupGroupPayload = { ...selected, overall, variants: entries.filter(entry => entry.payload.items.length).map(({ payload }) => ({ variant: payload.variant, items: payload.items })), ...(preferred === undefined ? {} : { preferred }) };
    const messages = entries.filter(entry => entry.payload.items.length || entry.member.key === active.key).map(({ member, payload }) => toMessage({ ...payload, overall: member.key === active.key ? overall : '' }));
    if (preferred !== undefined) messages.push(`Preferred: ${preferred}`);
    receipt.send('feedback', payload, messages.join('\n\n')); setSubmitted(true);
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) { const keys = [...members.map(m => m.key), 'compare']; let next: number | undefined; if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % keys.length; if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + keys.length - 1) % keys.length; if (event.key === 'Home') next = 0; if (event.key === 'End') next = keys.length - 1; if (next === undefined) return; event.preventDefault(); setTab(keys[next]); (event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus(); }
  return { tab, setTab, active, compare, labels, overall, setOverall, preferred, setPreferred, submitted, setSubmitted, register, canSubmit, count, submit, navigate, refresh, locale: format.locale, model: models.current.get(active.key)?.current };
}
function GroupMember({ member, label, visible, submitted, register, refresh, controls, options }: { member: Member; label: string; visible: boolean; submitted: boolean; register: ReturnType<typeof useMockupGroup>['register']; refresh(): void; controls: MockupControls; options?: MockupOptions }) {
  const vm = useMockup({ ...member.props, variant: label }, usePrism(), { ...options, enabled: visible, controls });
  const model = useRef(vm); model.current = vm;
  useLayoutEffect(() => register(member.key, model), [register, member.key]);
  useLayoutEffect(refresh, [refresh, vm.comment, vm.editing?.id]);
  return <MockupView vm={{ ...vm, submitted }} feedback={false} embedded />;
}
function MockupGroupView({ members, options }: { members: Member[]; options?: MockupOptions }) {
  const presentation = usePresentation();
  const vm = useMockupGroup(members), id = useId(), rootRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useComponentState<MockupDevice>('groupDevice', members[0].props.device ?? 'desktop'), [zoom, setZoom] = useComponentState('groupZoom', 1);
  const [pen, setPen] = useState(false), [color, setColor] = useState('var(--prism-accent)'), [showSource, setShowSource] = useState(false), [expanded, setExpanded] = useState(false);
  const controls = { device, setDevice, zoom, setZoom, pen, setPen, color, setColor };
  useEffect(() => { const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { setExpanded(false); setPen(false); } }; document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape); }, []);
  useEffect(() => {
    const root = rootRef.current;
    if (!vm.compare || !root || typeof ResizeObserver === 'undefined') return;
    const spacers = root.querySelectorAll<HTMLElement>('.prism-mockup__spacer');
    const resize = () => root.style.setProperty('--mockup-compare-height', Math.max(0, ...Array.from(spacers, node => node.getBoundingClientRect().height)) + 'px');
    const observer = new ResizeObserver(resize);
    spacers.forEach(node => observer.observe(node)); resize();
    return () => { observer.disconnect(); root.style.removeProperty('--mockup-compare-height'); };
  }, [vm.compare, members.length]);
  async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (rootRef.current?.requestFullscreen) await rootRef.current.requestFullscreen(); else setExpanded(value => !value); } catch { setExpanded(value => !value); } }
  const source = vm.active.props.source ?? '', chrome = { ...controls, labels: vm.labels, framed: members.some(member => ['html', 'wire'].includes(member.props.kind ?? 'html')), fullscreen, showSource, setShowSource };
  const root = usePart('mockup', 'group'), tabs = usePart('mockup', 'tabs'), tab = usePart('mockup', 'tab'), columns = usePart('mockup', 'columns'), column = usePart('mockup', 'column'), dot = usePart('mockup', 'streamDot'), input = usePart('mockup', 'input'), button = usePart('mockup', 'button'), sharedTools = usePart('mockup', 'sharedTools');
  const selected = vm.compare ? 'compare' : vm.active.key;
  return <div {...root} {...presentation} ref={rootRef} data-expanded={expanded || undefined} data-state={vm.submitted ? 'sent' : presentation['data-state']}>
    <ComponentFrame component="mockup" title={members[0].props.title ?? vm.labels.title} ask undo={false} toolbar={<div {...tabs} role="tablist" aria-label={vm.labels.variants}>{[...members.map((m, i) => ({ key: m.key, label: variant(m, i), complete: m.complete })), { key: 'compare', label: vm.labels.compare, complete: true }].map((entry, index) => <button key={entry.key} {...tab} id={`${id}-tab-${entry.key}`} role="tab" aria-label={entry.label} aria-description={!entry.complete ? vm.labels.streaming : undefined} aria-selected={selected === entry.key} aria-controls={`${id}-panel-${entry.key}`} tabIndex={selected === entry.key ? 0 : -1} onClick={() => vm.setTab(entry.key)} onKeyDown={event => vm.navigate(event, index)}>{entry.label}{!entry.complete && <span {...dot} aria-label={vm.labels.streaming} />}</button>)}</div>}>
      <div {...sharedTools}>{!vm.submitted && <MockupPenTools vm={chrome} />}<MockupToolbar vm={chrome} /></div>
      {showSource && <MockupSource vm={{ labels: vm.labels, source, copy: async () => { try { await navigator.clipboard?.writeText(source); } catch {} } }} />}
      <div {...columns} data-compare={vm.compare || undefined} role={vm.compare ? 'tabpanel' : undefined} id={vm.compare ? `${id}-panel-compare` : undefined} aria-labelledby={vm.compare ? `${id}-tab-compare` : undefined}>
        {members.map((member, index) => { const label = variant(member, index), visible = vm.compare || vm.active.key === member.key; return <div key={member.key} {...column} hidden={!visible} role={!vm.compare ? 'tabpanel' : undefined} id={`${id}-panel-${member.key}`} aria-labelledby={!vm.compare ? `${id}-tab-${member.key}` : undefined}>
          {vm.compare && <div><strong>{label}</strong>{!vm.submitted && <button {...button} aria-pressed={vm.preferred === label} onClick={() => vm.setPreferred(vm.preferred === label ? undefined : label)}>{vm.preferred === label && <Icon name="check" />}{vm.labels.prefer} {label}</button>}</div>}
          <ComponentContext.Provider value={member.context}><GroupMember key={member.id} member={member} label={label} visible={visible} submitted={vm.submitted} register={vm.register} refresh={vm.refresh} controls={controls} options={options} /></ComponentContext.Provider>
        </div>; })}
      </div>
      <label><span className="prism-mockup__sr">{vm.labels.overall}</span><textarea {...input} rows={2} placeholder="Add overall feedback…" readOnly={vm.submitted} value={vm.overall} onChange={event => vm.setOverall(event.target.value)} /></label>
      <MockupFooter labels={vm.labels} locale={vm.locale} count={vm.count} submitted={vm.submitted} edit={() => vm.setSubmitted(false)} canUndo={!!vm.model?.feedback.canUndo} canRedo={!!vm.model?.feedback.canRedo} undo={() => { vm.model?.close(); vm.model?.feedback.undo(); }} redo={() => { vm.model?.close(); vm.model?.feedback.redo(); }} canSubmit={vm.canSubmit} submit={vm.submit} />
    </ComponentFrame>
  </div>;
}
