import { componentStrings } from '../strings';
import { type CSSProperties } from 'react';
import { PrismPart, useStrings, usePart, usePresentation, type PrismComponentProps } from '@prism-ui/react';

export interface GridProps { id?: string; title?: string; meta?: string; cols?: number; gap?: 'sm' | 'md' | 'lg'; min?: number }
export function useGrid(props: GridProps, ctx: Pick<PrismComponentProps, 'complete'>) {
  const strings = useStrings('grid', componentStrings.grid, props);
  const presentation = usePresentation(), state = ctx.complete ? 'done' : 'streaming', root = usePart('grid', 'root', state), body = usePart('grid', 'body', state);
  return { titleLabel: strings.title, metaLabel: strings.meta, rootProps: { ...root, ...presentation, role: 'group', 'aria-label': strings.title || strings.label, 'data-size': props.gap ?? 'md', style: { ...root.style, '--prism-grid-cols': props.cols ?? 2, '--prism-grid-min': (props.min ?? 190) + 'px' } as CSSProperties }, body,
    header: usePart('grid', 'header', state), title: usePart('grid', 'title', state), meta: usePart('grid', 'meta', state) };
}
export type GridModel = ReturnType<typeof useGrid>;
export interface GridSlotProps { grid: GridModel }
export function Grid({ props, complete, children }: PrismComponentProps<GridProps>) {
  const model = useGrid(props, { complete });
  return <PrismPart slotProps={{ grid: model } satisfies GridSlotProps} as="div" {...model.rootProps}>
    {(model.titleLabel || model.metaLabel) && <PrismPart slotProps={{ grid: model } satisfies GridSlotProps} as="div" {...model.header}>
      {model.titleLabel && <PrismPart slotProps={{ grid: model } satisfies GridSlotProps} as="h3" {...model.title}>{model.titleLabel}</PrismPart>}
      {model.metaLabel && <PrismPart slotProps={{ grid: model } satisfies GridSlotProps} as="span" {...model.meta}>{model.metaLabel}</PrismPart>}
    </PrismPart>}
    <PrismPart slotProps={{ grid: model } satisfies GridSlotProps} as="div" {...model.body}>{children}</PrismPart>
  </PrismPart>;
}
