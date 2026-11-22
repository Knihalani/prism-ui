import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Icon, cx, useSent, useStrings } from '@prism-ui/react';
import { ReceiptLabels } from '@prism-ui/components/shared';

export const SentAction = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(function SentAction({ children, className, disabled, ...props }, ref) {
  const { sent } = useSent(), strings = useStrings('estimate');
  return <button {...props} ref={ref} disabled={disabled || !!sent} className={cx('prism-pill', className)} data-variant="primary" data-feedback="" data-sent={sent ? '' : undefined}><ReceiptLabels sent={!!sent} receipt={strings.sentLabel}>{strings.submit}<Icon name="send" /></ReceiptLabels></button>;
});

export const receiptMotion = `
  :scope .prism-estimate__submit[data-feedback] { display:inline-grid; }
  :scope .prism-estimate__submit.prism-pill[data-feedback][data-sent] { color:var(--prism-text); opacity:1; }
  :scope .prism-estimate__submit[data-feedback] .prism-check-mark path { animation:none; stroke-dasharray:20; stroke-dashoffset:20; transition:stroke-dashoffset var(--prism-motion-slow) var(--prism-motion-ease); }
  :scope .prism-estimate__submit[data-sent] .prism-check-mark path { stroke-dashoffset:0; }
`;
