import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Dialog({ title, onClose, children, className = '' }: { title: string; onClose(): void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current!;
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]'));
    (root.querySelector<HTMLElement>('[data-autofocus]') ?? focusable()[0])?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const items = focusable(), first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    root.addEventListener('keydown', keydown);
    return () => { root.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [onClose]);
  return <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div ref={ref} className={'dialog ' + className} role="dialog" aria-modal="true" aria-label={title}>
    <button className="icon-btn dialog-close" title="Close" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
    {children}
  </div></div>;
}
