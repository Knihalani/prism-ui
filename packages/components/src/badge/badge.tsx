import { type HTMLAttributes } from 'react';
import { PrismPart, cx, usePart, usePresentation, usePrism, useSlot, type PrismComponentProps } from '@prism-ui/react';

export interface BadgeProps { id?: string; tone?: 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger'; variant?: 'soft' | 'solid' | 'outline'; size?: 'sm' | 'md'; dot?: boolean }
function Body(props: HTMLAttributes<HTMLSpanElement>) { return <PrismPart as="span" {...props} />; }
export function useBadge(props: BadgeProps, ctx: Pick<PrismComponentProps, 'complete'>) {
  const { unstyled } = usePrism(), state = ctx.complete ? 'done' : 'streaming', root = usePart('badge', 'root', state), presentation = usePresentation();
  return { rootProps: { ...root, ...presentation, className: cx(root.className, !unstyled && 'prism-chip') || undefined, 'data-tone': props.tone ?? 'neutral', 'data-variant': props.variant ?? 'soft', 'data-size': props.size ?? 'sm' }, body: usePart('badge', 'body', state), dot: usePart('badge', 'dot', state) };
}
export function Badge({ props, complete, children }: PrismComponentProps<BadgeProps>) {
  const model = useBadge(props, { complete }), BodySlot = useSlot('badge', 'body', Body);
  return <PrismPart as="span" {...model.rootProps}>{props.dot && <PrismPart as="span" {...model.dot} aria-hidden="true" />}<BodySlot {...model.body}>{children}</BodySlot></PrismPart>;
}
