import { type HTMLAttributes } from 'react';
import { usePart, usePrism, useSlot, type PrismComponentProps } from '@prism-ui/react';

export interface BadgeProps { id?: string; tone?: 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger'; variant?: 'soft' | 'solid' | 'outline'; size?: 'sm' | 'md'; dot?: boolean }
function Body(props: HTMLAttributes<HTMLSpanElement>) { return <span {...props} />; }
export function useBadge(props: BadgeProps, ctx: Pick<PrismComponentProps, 'complete'>) {
  const { animate } = usePrism(), state = ctx.complete ? 'done' : 'streaming';
  return { rootProps: { ...usePart('badge', 'root', state), 'data-tone': props.tone ?? 'neutral', 'data-variant': props.variant ?? 'soft', 'data-size': props.size ?? 'sm', 'data-prism-enter': animate ? '' : undefined }, body: usePart('badge', 'body', state), dot: usePart('badge', 'dot', state) };
}
export function Badge({ props, complete, children }: PrismComponentProps<BadgeProps>) {
  const model = useBadge(props, { complete }), BodySlot = useSlot('badge', 'body', Body);
  return <span {...model.rootProps}>{props.dot && <span {...model.dot} aria-hidden="true" />}<BodySlot {...model.body}>{children}</BodySlot></span>;
}
