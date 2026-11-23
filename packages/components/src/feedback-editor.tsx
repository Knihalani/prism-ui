import { useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ComponentContext, PrismPart, usePart, usePrism, useStrings, useTheme } from '@prism-ui/react';
import { MockupAnnotations, MockupComment } from './mockup/mockup';
import { MockupFooter, MockupPenTools } from './mockup/chrome';
import { useMockup, type MockupModel } from './mockup/use-mockup';
import type { FeedbackEditorProps } from './feedback';

export function FeedbackEditor({ open, close, surface }: FeedbackEditorProps) {
  const component = useContext(ComponentContext)!;
  const vm = useMockup({ kind: 'image', title: component.name }, usePrism(), { inline: true, surface });
  const input = usePart('mockup', 'input'), overall = usePart('mockup', 'overall');
  const labels = useStrings('feedback', { title: 'Graphic feedback' });
  useEffect(() => { if (!open) vm.cancel(false); }, [open]);
  return <PrismPart as="span" className="prism-inline-feedback__editor" hidden={!open} aria-label={labels.title} onKeyDown={event => { vm.onKeyDown(event); if (event.key === 'Escape') close(); }}>
      {open && !vm.submitted && surface.viewport.current && createPortal(<MockupAnnotations vm={vm} popover={false} />, surface.viewport.current)}
      <FeedbackPopover vm={vm} surface={surface} open={open} />
      {!vm.submitted && <><MockupPenTools vm={vm} model={vm} /><PrismPart slotProps={{ model: vm }} as="label" {...overall}>{vm.labels.overall}<PrismPart slotProps={{ model: vm }} as="textarea" {...input} value={vm.state.overall} onChange={event => vm.feedback.setOverall(event.target.value)} onBlur={vm.saveOverall} /></PrismPart></>}
      <MockupFooter model={vm} labels={vm.labels} locale={vm.locale} count={vm.state.items.length} submitted={vm.submitted} edit={() => vm.setSubmitted(false)} canUndo={vm.feedback.canUndo} canRedo={vm.feedback.canRedo} undo={() => { vm.close(); vm.feedback.undo(); }} redo={() => { vm.close(); vm.feedback.redo(); }} canSubmit={vm.canSubmit} submit={vm.submit} commitOverall={vm.saveOverall} />
      <span className="prism-inline-feedback__live" aria-live="polite">{vm.announcement}</span>
    </PrismPart>;
}
function FeedbackPopover({ vm, surface, open }: { vm: MockupModel; surface: NonNullable<import('./mockup/use-mockup').MockupOptions['surface']>; open: boolean }) {
  const theme = useTheme();
  const [portal, setPortal] = useState<Element>(document.body);
  useLayoutEffect(() => {
    const sync = () => { const full = document.fullscreenElement, target = surface.viewport.current; setPortal(full && target && full.contains(target) ? full : document.body); };
    sync(); document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [surface]);
  const [appearance, setAppearance] = useState<{ style: CSSProperties; name?: string; mode?: string }>({ style: {} });
  const layer = useRef<HTMLSpanElement>(null), [position, setPosition] = useState({ left: 12, top: 12, width: 256, transformOrigin: '0px 0px' });
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
      const bounds = surface.viewport.current?.getBoundingClientRect(), item = vm.state.items.find(item => item.id === vm.editing?.id);
      if (!item) return;
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const width = Math.min(320, Math.max(0, viewportWidth - 24)), height = layer.current?.getBoundingClientRect().height || 180;
      const left = Math.max(12, Math.min(viewportWidth - width - 12, (bounds?.left ?? 0) + (item?.x ?? 0) / 100 * (bounds?.width ?? 0)));
      const top = Math.max(12, Math.min(window.innerHeight - height - 12, (bounds?.top ?? 0) + (item?.y ?? 0) / 100 * (bounds?.height ?? 0) + 20));
      const transformOrigin = `${(bounds?.left ?? 0) + item.x / 100 * (bounds?.width ?? 0) - left}px ${(bounds?.top ?? 0) + item.y / 100 * (bounds?.height ?? 0) - top}px`;
      setPosition(old => old.left === left && old.top === top && old.width === width && old.transformOrigin === transformOrigin ? old : { left, top, width, transformOrigin });
    };
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(place);
    if (layer.current) observer?.observe(layer.current);
    if (surface.viewport.current) observer?.observe(surface.viewport.current);
    return () => { observer?.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [surface, vm.editing?.id, vm.state]);
  return createPortal(<span ref={layer} className="prism-root prism-inline-feedback__popover-layer" data-animate={usePrism().animate ? undefined : 'false'} data-prism-theme-name={appearance.name} data-prism-theme={appearance.mode} style={{ ...appearance.style, ...position, position: 'fixed', display: 'block', pointerEvents: 'none', zIndex: 1000, maxHeight: 'calc(100dvh - 24px)', overflow: 'visible' }}><MockupComment vm={vm} open={open} style={{ position: 'relative', display: 'block', left: 0, top: 0, width: '100%', transformOrigin: position.transformOrigin, maxHeight: 'calc(100dvh - 24px)', overflow: 'auto' }} /></span>, portal);
}
