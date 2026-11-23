import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ComponentType } from 'react';
import { ComponentContext, Icon, PrismPart, registerFeedbackSurface, usePrism, useStrings, type FeedbackSurfaceProps } from '@prism-ui/react';
import { FeedbackTarget } from './feedback-target';
import { createLoader } from './shared/load';
import './mockup/mockup.css';
import './feedback.css';

export { useFeedbackTarget } from './feedback-target';
export interface FeedbackEditorProps { open: boolean; close(): void; surface: NonNullable<import('./mockup/use-mockup').MockupOptions['surface']> }
const editor = createLoader<ComponentType<FeedbackEditorProps>>(() => import('./feedback-editor').then(module => module.FeedbackEditor));
export const FeedbackEditorLoader = createContext(editor);
export function preloadFeedback() { return editor.load(); }

export function InlineFeedback({ children, targetKey }: FeedbackSurfaceProps) {
  const loader = useContext(FeedbackEditorLoader), [Editor, setEditor] = useState(() => loader.value);
  const load = () => { void loader.load().then(value => setEditor(() => value)).catch(() => {}); };
  useEffect(() => {
    let active = true;
    void loader.load().then(value => { if (active) setEditor(() => value); }).catch(() => {});
    return () => { active = false; };
  }, [loader]);
  const component = useContext(ComponentContext)!, inline = usePrism().registry.get(component.name)?.inline;
  const [open, setOpen] = useState(false), [activated, setActivated] = useState(false), trigger = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null), fallback = useRef<HTMLDivElement>(null), viewport = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  viewport.current = target ?? fallback.current;
  const labels = useStrings('feedback', { open: 'Give feedback', close: 'Close feedback' });
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <PrismPart as="span" className="prism-inline-feedback" data-prism-reveal-host="" onPointerEnter={load} onFocusCapture={load} ref={root} style={{ '--prism-mockup-scale': 1, '--prism-mockup-inverse-scale': 1 } as CSSProperties} data-inline={inline || undefined} data-feedback-open={open || undefined}>
    <button ref={trigger} type="button" className="prism-inline-feedback__trigger" data-prism-reveal="" data-prism-press="" aria-label={open ? labels.close : labels.open} title={labels.open} aria-expanded={open} onKeyDown={event => { if (event.key === 'Escape') close(); }} onClick={() => { load(); setActivated(true); open ? close() : setOpen(true); }}><Icon name={open ? 'close' : 'ask'} /></button>
    <PrismPart as="span" className="prism-inline-feedback__target" ref={fallback}>
      <FeedbackTarget.Provider value={setTarget}>{children}</FeedbackTarget.Provider>
    </PrismPart>
    {activated && Editor && <Editor key={targetKey} open={open} close={close} surface={{ root, viewport }} />}
  </PrismPart>;
}
registerFeedbackSurface(InlineFeedback);
