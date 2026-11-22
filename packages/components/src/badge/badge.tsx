import { PrismPart, cx, usePart, usePresentation, usePrism, type PrismComponentProps } from '@prism-ui/react';

export interface BadgeProps { id?: string; tone?: 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger'; variant?: 'soft' | 'solid' | 'outline'; size?: 'sm' | 'md'; dot?: boolean }
export function useBadge(props: BadgeProps, ctx: Pick<PrismComponentProps, 'complete'>) {
  const { unstyled } = usePrism(), state = ctx.complete ? 'done' : 'streaming', root = usePart('badge', 'root', state), presentation = usePresentation();
  return { rootProps: { ...root, ...presentation, className: cx(root.className, !unstyled && 'prism-chip') || undefined, 'data-tone': props.tone ?? 'neutral', 'data-variant': props.variant ?? 'soft', 'data-size': props.size ?? 'sm' }, body: usePart('badge', 'body', state), dot: usePart('badge', 'dot', state) };
}
export type BadgeModel = ReturnType<typeof useBadge>;
export interface BadgeSlotProps { badge: BadgeModel }
export function Badge({ props, complete, children }: PrismComponentProps<BadgeProps>) {
  const model = useBadge(props, { complete });
  return <PrismPart slotProps={{ badge: model } satisfies BadgeSlotProps} as="span" {...model.rootProps}>{props.dot && <PrismPart slotProps={{ badge: model } satisfies BadgeSlotProps} as="span" {...model.dot} aria-hidden="true" />}<PrismPart slotProps={{ badge: model } satisfies BadgeSlotProps} as="span" {...model.body}>{children}</PrismPart></PrismPart>;
}
