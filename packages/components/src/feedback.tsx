import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ComponentContext, Icon, PrismPart, registerFeedbackSurface, usePart, usePrism, useStrings, useTheme, type FeedbackSurfaceProps } from '@prism-ui/react';
import { MockupAnnotations, MockupComment } from './mockup/mockup';
import { MockupFooter, MockupPenTools } from './mockup/chrome';
import { useMockup } from './mockup/use-mockup';
import { MockupList } from './mockup/annotation-list';
import { placeComposer } from './mockup/placement';
import { useComposerViewport } from './mockup/viewport';
import type { MockupModel } from './mockup/use-mockup';
import './mockup/mockup.css';
import './feedback.css';

const FeedbackTarget = createContext<((target: HTMLDivElement | null) => void) | undefined>(undefined);
export function useFeedbackTarget() { return useContext(FeedbackTarget); }

export function InlineFeedback({ children, targetKey }: FeedbackSurfaceProps) {
  const prism = usePrism(), component = useContext(ComponentContext)!, inline = prism.registry.get(component.name)?.inline;
  const [open, setOpen] = useState(false), [activated, setActivated] = useState(false), trigger = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null), fallback = useRef<HTMLDivElement>(null), viewport = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  viewport.current = target ?? fallback.current;
  const labels = useStrings('feedback', { open: 'Give feedback', close: 'Close feedback' });
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <PrismPart as="span" className="prism-inline-feedback" data-prism-reveal-host="" data-prism-theme-name={prism.unstyled ? prism.resolvedTheme.name : undefined} data-animate={prism.unstyled || !prism.animate ? 'false' : undefined} ref={root} style={{ '--prism-mockup-scale': 1, '--prism-mockup-inverse-scale': 1 } as CSSProperties} data-inline={inline || undefined} data-feedback-open={open || undefined}>
    <button ref={trigger} type="button" className="prism-inline-feedback__trigger" data-prism-reveal="" data-prism-press="" aria-label={open ? labels.close : labels.open} title={labels.open} aria-expanded={open} onKeyDown={event => { if (event.key === 'Escape') close(); }} onClick={() => { setActivated(true); open ? close() : setOpen(true); }}><Icon name={open ? 'close' : 'ask'} /></button>
    <span className="prism-inline-feedback__viewport"><PrismPart as="span" className="prism-inline-feedback__target" ref={fallback}>
      <FeedbackTarget.Provider value={setTarget}>{children}</FeedbackTarget.Provider>
    </PrismPart></span>
    {activated && <FeedbackEditor key={targetKey} open={open} close={close} surface={{ root, viewport }} />}
  </PrismPart>;
}
function FeedbackEditor({ open, close, surface }: { open: boolean; close(): void; surface: NonNullable<import('./mockup/use-mockup').MockupOptions['surface']> }) {
  const component = useContext(ComponentContext)!;
  const vm = useMockup({ kind: 'image', title: component.name }, usePrism(), { inline: true, surface });
  const input = usePart('mockup', 'input'), overall = usePart('mockup', 'overall'), fields = usePart('mockup', 'feedbackFields');
  const labels = useStrings('feedback', { title: 'Graphic feedback' });
  useEffect(() => { if (!open) vm.cancel(false); }, [open]);
  return <PrismPart as="span" className="prism-inline-feedback__editor" hidden={!open} aria-label={labels.title} onKeyDown={event => { vm.onKeyDown(event); if (event.key === 'Escape' && !event.defaultPrevented) close(); }}>
      {open && surface.viewport.current && createPortal(<MockupAnnotations vm={vm} popover={false} />, surface.viewport.current)}
      <FeedbackPopover vm={vm} surface={surface} open={open} />
      <PrismPart as="span" {...fields} slotProps={{ model: vm }} data-submitted={vm.submitted || undefined} inert={vm.submitted || undefined} aria-hidden={vm.submitted || undefined}><MockupPenTools vm={vm} model={vm} /><MockupList vm={vm} /><PrismPart slotProps={{ model: vm }} as="label" {...overall}>{vm.labels.overall}<PrismPart slotProps={{ model: vm }} as="textarea" {...input} value={vm.state.overall} onChange={event => vm.feedback.setOverall(event.target.value)} onBlur={vm.saveOverall} /></PrismPart></PrismPart>
      <MockupFooter model={vm} labels={vm.labels} locale={vm.locale} count={vm.state.items.length} submitted={vm.submitted} edit={() => vm.setSubmitted(false)} canUndo={vm.feedback.canUndo} canRedo={vm.feedback.canRedo} undo={() => { vm.close(); vm.feedback.undo(); }} redo={() => { vm.close(); vm.feedback.redo(); }} canSubmit={vm.canSubmit} submit={vm.submit} commitOverall={vm.saveOverall} />
      <span className="prism-inline-feedback__live" aria-live="polite">{vm.announcement}</span>
    </PrismPart>;
}
function FeedbackPopover({ vm, surface, open }: { vm: MockupModel; surface: NonNullable<import('./mockup/use-mockup').MockupOptions['surface']>; open: boolean }) {
  const theme = useTheme(), prism = usePrism();
  const viewport = useComposerViewport();
  const [portal, setPortal] = useState<Element>(document.body);
  useLayoutEffect(() => {
    const sync = () => { const full = document.fullscreenElement, target = surface.viewport.current; setPortal(full && target && full.contains(target) ? full : document.body); };
    sync(); document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [surface]);
  const [appearance, setAppearance] = useState<{ style: CSSProperties; name?: string; mode?: string }>({ style: {} });
  const layer = useRef<HTMLSpanElement>(null), [position, setPosition] = useState({ left: 12, top: 12, width: 256, transformOrigin: '0px 0px', '--prism-mockup-caret-x': '24px', '--prism-mockup-caret-y': '0px', '--prism-mockup-caret-side': 'top' });
  useLayoutEffect(() => {
    const sync = () => {
      const source = surface.root.current; if (!source) return;
      const computed = getComputedStyle(source), tokens: Record<string, string> = {};
      for (let i = 0; i < computed.length; i++) { const key = computed[i]; if (key.startsWith('--prism-')) tokens[key] = computed.getPropertyValue(key); }
      const next = { style: { ...tokens, color: computed.color, fontFamily: computed.fontFamily } as CSSProperties, name: source.closest('[data-prism-theme-name]')?.getAttribute('data-prism-theme-name') ?? undefined, mode: source.closest('[data-prism-theme]')?.getAttribute('data-prism-theme') ?? undefined };
      setAppearance(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
    };
    sync(); window.addEventListener('transitionend', sync, true);
    const observer = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(sync);
    for (let node: HTMLElement | null = surface.root.current; node; node = node.parentElement) observer?.observe(node, { attributes: true, attributeFilter: ['class', 'style', 'data-prism-theme', 'data-prism-theme-name'] });
    return () => { observer?.disconnect(); window.removeEventListener('transitionend', sync, true); };
  }, [surface, theme]);
  useLayoutEffect(() => {
    const place = () => {
      const item = vm.state.items.find(item => item.id === vm.editing?.id);
      if (!item) return;
      const bounds = [surface.viewport.current?.getBoundingClientRect(), surface.root.current?.getBoundingClientRect()].find(rect => rect && rect.width > 0 && rect.height > 0) ?? viewport;
      const placement = placeComposer(bounds, { x: bounds.left + item.x / 100 * bounds.width, y: bounds.top + item.y / 100 * bounds.height }, viewport, layer.current?.getBoundingClientRect().height || 210, surface.root.current?.querySelector('[data-feedback-submit]')?.getBoundingClientRect());
      const position = { left: placement.left, top: placement.top, width: placement.width, transformOrigin: placement.transformOrigin, '--prism-mockup-caret-x': placement.caretX + 'px', '--prism-mockup-caret-y': placement.caretY + 'px', '--prism-mockup-caret-side': placement.side };
      setPosition(old => JSON.stringify(old) === JSON.stringify(position) ? old : position);
    };
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(place);
    if (layer.current) observer?.observe(layer.current);
    if (surface.viewport.current) observer?.observe(surface.viewport.current);
    if (surface.root.current) observer?.observe(surface.root.current);
    return () => { observer?.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [surface, vm.editing?.id, vm.state, viewport]);
  return createPortal(<span ref={layer} className="prism-root prism-inline-feedback__popover-layer" data-animate={prism.animate && !prism.unstyled ? undefined : 'false'} data-prism-theme-name={appearance.name} data-prism-theme={appearance.mode} style={{ ...appearance.style, ...position, padding: 0, margin: 0, border: 0, boxShadow: 'none', background: 'transparent', minWidth: 0, minHeight: 0, containerType: 'normal', position: 'fixed', display: 'block', pointerEvents: 'none', zIndex: 1000, maxHeight: Math.max(0, viewport.height - 24), overflow: 'visible' }}><MockupComment vm={vm} open={open} style={{ ...position, position: 'relative', display: 'block', left: 0, top: 0, width: '100%', transformOrigin: position.transformOrigin, maxHeight: Math.max(0, viewport.height - 24), overflow: 'auto' }} /></span>, portal);
}
registerFeedbackSurface(InlineFeedback);
