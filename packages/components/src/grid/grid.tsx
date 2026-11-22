import { type CSSProperties, type HTMLAttributes } from 'react';
import { usePart, usePrism, useSlot, type PrismComponentProps } from '@prism-ui/react';

export interface GridProps { id?: string; cols?: number; gap?: 'sm' | 'md' | 'lg'; min?: number }
function Body(props: HTMLAttributes<HTMLDivElement>) { return <div {...props} />; }
export function useGrid(props: GridProps, ctx: Pick<PrismComponentProps, 'complete'>) {
  const { animate } = usePrism(), state = ctx.complete ? 'done' : 'streaming', root = usePart('grid', 'root', state), body = usePart('grid', 'body', state);
  return { rootProps: { ...root, role: 'group', 'aria-label': 'Grid', 'data-size': props.gap ?? 'md', 'data-prism-enter': animate ? '' : undefined, style: { ...root.style, '--prism-grid-cols': props.cols ?? 2, '--prism-grid-min': (props.min ?? 220) + 'px' } as CSSProperties }, body };
}
export function Grid({ props, complete, children }: PrismComponentProps<GridProps>) {
  const model = useGrid(props, { complete }), BodySlot = useSlot('grid', 'body', Body);
  return <div {...model.rootProps}><BodySlot {...model.body}>{children}</BodySlot></div>;
}
