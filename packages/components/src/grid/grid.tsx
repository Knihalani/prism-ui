import { type CSSProperties, type HTMLAttributes } from 'react';
import { usePart, usePresentation, useSlot, type PrismComponentProps } from '@prism-ui/react';

export interface GridProps { id?: string; title?: string; meta?: string; cols?: number; gap?: 'sm' | 'md' | 'lg'; min?: number }
function Body(props: HTMLAttributes<HTMLDivElement>) { return <div {...props} />; }
function Title(props: HTMLAttributes<HTMLHeadingElement>) { return <h3 {...props} />; }
export function useGrid(props: GridProps, ctx: Pick<PrismComponentProps, 'complete'>) {
  const presentation = usePresentation(), state = ctx.complete ? 'done' : 'streaming', root = usePart('grid', 'root', state), body = usePart('grid', 'body', state);
  return { rootProps: { ...root, ...presentation, role: 'group', 'aria-label': props.title || 'Grid', 'data-size': props.gap ?? 'md', style: { ...root.style, '--prism-grid-cols': props.cols ?? 2, '--prism-grid-min': (props.min ?? 190) + 'px' } as CSSProperties }, body,
    header: usePart('grid', 'header', state), title: usePart('grid', 'title', state), meta: usePart('grid', 'meta', state) };
}
export function Grid({ props, complete, children }: PrismComponentProps<GridProps>) {
  const model = useGrid(props, { complete }), BodySlot = useSlot('grid', 'body', Body);
  const HeaderSlot = useSlot('grid', 'header', Body), TitleSlot = useSlot('grid', 'title', Title);
  return <div {...model.rootProps}>
    {(props.title || props.meta) && <HeaderSlot {...model.header}>
      {props.title && <TitleSlot {...model.title}>{props.title}</TitleSlot>}
      {props.meta && <span {...model.meta}>{props.meta}</span>}
    </HeaderSlot>}
    <BodySlot {...model.body}>{children}</BodySlot>
  </div>;
}
