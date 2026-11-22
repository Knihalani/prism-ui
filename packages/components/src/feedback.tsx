import { useContext, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ComponentContext, Icon, PrismPart, registerFeedbackSurface, usePart, usePrism, useStrings, type FeedbackSurfaceProps } from '@prism-ui/react';
import { MockupAnnotations } from './mockup/mockup';
import { MockupFooter, MockupPenTools } from './mockup/chrome';
import { useMockup } from './mockup/use-mockup';
import './mockup/mockup.css';
import './feedback.css';

export function InlineFeedback({ children, targetKey }: FeedbackSurfaceProps) {
  const component = useContext(ComponentContext)!, inline = usePrism().registry.get(component.name)?.inline;
  const [open, setOpen] = useState(false), [activated, setActivated] = useState(false), trigger = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null), viewport = useRef<HTMLDivElement>(null);
  const labels = useStrings('feedback', { open: 'Give feedback', close: 'Close feedback' });
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <PrismPart as="span" className="prism-inline-feedback" ref={root} style={{ '--prism-mockup-scale': 1, '--prism-mockup-inverse-scale': 1 } as CSSProperties} data-inline={inline || undefined} data-feedback-open={open || undefined}>
    <button ref={trigger} type="button" className="prism-inline-feedback__trigger" aria-label={open ? labels.close : labels.open} title={labels.open} aria-expanded={open} onKeyDown={event => { if (event.key === 'Escape') close(); }} onClick={() => { setActivated(true); open ? close() : setOpen(true); }}><Icon name={open ? 'close' : 'ask'} /></button>
    <PrismPart as="span" className="prism-inline-feedback__target" ref={viewport}>
      {children}
    </PrismPart>
    {activated && <FeedbackEditor key={targetKey} open={open} close={close} surface={{ root, viewport }} />}
  </PrismPart>;
}
function FeedbackEditor({ open, close, surface }: { open: boolean; close(): void; surface: NonNullable<import('./mockup/use-mockup').MockupOptions['surface']> }) {
  const component = useContext(ComponentContext)!;
  const vm = useMockup({ kind: 'image', title: component.name }, usePrism(), { inline: true, surface });
  const input = usePart('mockup', 'input'), overall = usePart('mockup', 'overall');
  const labels = useStrings('feedback', { title: 'Graphic feedback' });
  useEffect(() => { if (!open) vm.cancel(false); }, [open]);
  return <PrismPart as="span" className="prism-inline-feedback__editor" hidden={!open} aria-label={labels.title} onKeyDown={event => { vm.onKeyDown(event); if (event.key === 'Escape') close(); }}>
      {open && !vm.submitted && surface.viewport.current && createPortal(<MockupAnnotations vm={vm} />, surface.viewport.current)}
      {!vm.submitted && <><MockupPenTools vm={vm} /><PrismPart as="label" {...overall}>{vm.labels.overall}<PrismPart as="textarea" {...input} value={vm.state.overall} onChange={event => vm.feedback.setOverall(event.target.value)} /></PrismPart></>}
      <MockupFooter labels={vm.labels} locale={vm.locale} count={vm.state.items.length} submitted={vm.submitted} edit={() => vm.setSubmitted(false)} canUndo={vm.feedback.canUndo} canRedo={vm.feedback.canRedo} undo={() => { vm.close(); vm.feedback.undo(); }} redo={() => { vm.close(); vm.feedback.redo(); }} canSubmit={vm.canSubmit} submit={vm.submit} />
      <span className="prism-inline-feedback__live" aria-live="polite">{vm.announcement}</span>
    </PrismPart>;
}
registerFeedbackSurface(InlineFeedback);
