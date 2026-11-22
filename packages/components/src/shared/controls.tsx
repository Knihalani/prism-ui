import { forwardRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { PrismPart, Icon, cx } from '@prism-ui/react';

type ButtonProps = ComponentPropsWithoutRef<'button'>;
type InputProps = ComponentPropsWithoutRef<'input'>;
type SpanProps = ComponentPropsWithoutRef<'span'>;

export function CheckMark({ draw, className, ...props }: ComponentPropsWithoutRef<'svg'> & { draw?: boolean }) {
  return <Icon width="14" height="14" {...props} name="check" className={cx('prism-check-mark', className)} data-draw={draw ? '' : undefined} />;
}

export interface PillProps extends ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  sent?: boolean;
  receipt?: ReactNode;
}

/** Keep the ready and receipt labels in the same layout slot to avoid shifting adjacent controls. */
export const Pill = forwardRef<HTMLButtonElement, PillProps>(function Pill(
  { variant = 'primary', sent = false, receipt, disabled, className, children, ...props }, ref,
) {
  return <PrismPart as="button" ref={ref} type="button" {...props} className={cx('prism-pill', className)}
    disabled={disabled || sent} data-variant={variant} data-sent={sent ? '' : undefined}
    data-feedback={receipt != null ? '' : undefined}>
    {receipt == null ? children : <>
      <span aria-hidden={sent}>{children}</span>
      <span aria-hidden={!sent}><CheckMark />{receipt}</span>
    </>}
  </PrismPart>;
});

export interface ChipProps extends ButtonProps { pressed?: boolean }
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip({ pressed, className, ...props }, ref) {
  return <PrismPart as="button" ref={ref} type="button" aria-pressed={pressed} {...props} className={cx('prism-chip', className)} />;
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps>(function IconButton({ className, ...props }, ref) {
  return <PrismPart as="button" ref={ref} type="button" {...props} className={cx('prism-icon-btn', className)} />;
});

export const Checkbox = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(function Checkbox({ className, ...props }, ref) {
  return <PrismPart as="input" ref={ref} {...props} type="checkbox" className={cx('prism-check', className)} />;
});

export interface SwitchProps extends ButtonProps { checked: boolean }
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch({ checked, className, ...props }, ref) {
  return <PrismPart as="button" ref={ref} type="button" {...props} role="switch" aria-checked={checked} className={cx('prism-switch', className)} />;
});

export interface StepperProps extends SpanProps {
  value: ReactNode;
  decrease: ButtonProps & { 'aria-label': string };
  increase: ButtonProps & { 'aria-label': string };
}
export function Stepper({ value, decrease, increase, className, ...props }: StepperProps) {
  return <PrismPart as="span" {...props} className={cx('prism-stepper', className)}>
    <PrismPart as="button" type="button" {...decrease}>{decrease.children ?? <Icon name="minus" />}</PrismPart>
    <output>{value}</output>
    <PrismPart as="button" type="button" {...increase}>{increase.children ?? <Icon name="plus" />}</PrismPart>
  </PrismPart>;
}

export interface InlineValueProps extends ButtonProps { dragging?: boolean }
/** Wire the owning component's scrub and text-edit handlers to this trigger. */
export const InlineValue = forwardRef<HTMLButtonElement, InlineValueProps>(function InlineValue({ dragging, className, ...props }, ref) {
  return <PrismPart as="button" ref={ref} type="button" {...props} className={cx('prism-inline-value', className)}
    data-dragging={dragging ? '' : undefined} />;
});

export function KbdHint({ className, ...props }: ComponentPropsWithoutRef<'kbd'>) {
  return <PrismPart as="kbd" {...props} className={cx('prism-kbd', className)} />;
}

export interface OdometerProps extends SpanProps {
  value: number;
  format?: (value: number) => string;
  animate?: boolean;
}

const isDigit = (character: string) => /\p{Decimal_Number}/u.test(character);
export function Odometer({ value, format = String, animate = true, className, ...props }: OdometerProps) {
  const text = format(value);
  const [roll, setRoll] = useState({ text, value, previous: '', direction: 'up', revision: 0 });
  if (roll.text !== text || !Object.is(roll.value, value)) {
    setRoll({ text, value, previous: roll.text, direction: value < roll.value ? 'down' : 'up', revision: roll.revision + 1 });
  }
  const previous = Array.from(roll.previous).filter(isDigit);
  if (!animate || previous.length === 0) {
    return <PrismPart as="span" {...props} className={cx('prism-odometer', className)}>{text}</PrismPart>;
  }
  const next = Array.from(text);
  let remaining = next.filter(isDigit).length;
  return <PrismPart as="span" {...props} className={cx('prism-odometer', className)}>
    <span className="prism-odometer__label">{text}</span>
    <span aria-hidden="true">{next.map((character, index) => {
      if (!isDigit(character)) return character;
      const before = previous[previous.length - remaining--];
      const changed = before != null && before !== character;
      return <span className="prism-odometer__digit" key={index} data-roll={changed ? roll.direction : undefined}>
        <span key={changed ? roll.revision : undefined}>{character}</span>
        {changed && <span key={`from-${roll.revision}`} className="prism-odometer__previous">{before}</span>}
      </span>;
    })}</span>
  </PrismPart>;
}
