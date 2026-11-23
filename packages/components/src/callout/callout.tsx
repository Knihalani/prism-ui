import { componentStrings } from '../strings';
import { useStrings, Icon as ThemeIcon, PrismPart, cx, StreamSkeleton, useEmit, usePart, usePresentation, usePrism, type PrismComponentProps } from '@prism-ui/react';

export interface CalloutProps { id?: string; tone?: 'info' | 'success' | 'warning' | 'danger' | 'note' | 'tip'; title?: string; variant?: 'soft' | 'outline'; icon?: boolean }
type Context = Pick<PrismComponentProps, 'complete' | 'children'>;
export function useCallout(props: CalloutProps, ctx: Context) {
  const strings = useStrings('callout', componentStrings.callout, props);
  const { unstyled } = usePrism(), emit = useEmit(), presentation = usePresentation(), state = ctx.complete ? 'done' : 'streaming';
  const parts = { root: usePart('callout', 'root', state), header: usePart('callout', 'header', state), title: usePart('callout', 'title', state), icon: usePart('callout', 'icon', state), body: usePart('callout', 'body', state), ask: usePart('callout', 'ask', state), skeleton: usePart('callout', 'skeleton', state) };
  return { parts, strings, title: strings.title, icon: props.tone === 'success' || props.tone === 'tip' ? 'check' as const : props.tone === 'note' ? 'info' as const : props.tone ?? 'info', unstyled, tone: props.tone ?? 'info', variant: props.variant ?? 'soft', showIcon: props.icon ?? true, empty: !ctx.children || Array.isArray(ctx.children) && !ctx.children.length, onAsk: () => emit('ask'), rootProps: { ...parts.root, ...presentation, role: 'note', 'aria-label': strings.title ?? strings.label } };
}
export type CalloutModel = ReturnType<typeof useCallout>;
export interface CalloutSlotProps { callout: CalloutModel }
export function Callout({ props, children, ...ctx }: PrismComponentProps<CalloutProps>) {
  const model = useCallout(props, { ...ctx, children }), { parts, strings: themeStrings } = model;
  return <PrismPart slotProps={{ callout: model } satisfies CalloutSlotProps} as="aside" {...model.rootProps} className={cx(model.rootProps.className, !model.unstyled && 'prism-materialise') || undefined} data-tone={model.tone} data-variant={model.variant}>
    <PrismPart slotProps={{ callout: model } satisfies CalloutSlotProps} as="header" {...parts.header}>{model.showIcon && <PrismPart slotProps={{ callout: model } satisfies CalloutSlotProps} as={ThemeIcon} {...parts.icon} name={model.icon} />}{model.title && <PrismPart slotProps={{ callout: model } satisfies CalloutSlotProps} as="h3" {...parts.title} aria-level={2}>{model.title}</PrismPart>}<PrismPart slotProps={{ callout: model } satisfies CalloutSlotProps} as="button" {...parts.ask} className={cx(parts.ask.className, !model.unstyled && 'prism-icon-btn') || undefined} type="button" onClick={model.onAsk} aria-label={themeStrings.askAboutThis} title={themeStrings.askAboutThis}><ThemeIcon name="ask" /></PrismPart></PrismPart>
    <PrismPart slotProps={{ callout: model } satisfies CalloutSlotProps} as="div" {...parts.body}>{model.empty && !ctx.complete && !model.unstyled
      ? <PrismPart as={StreamSkeleton} slotProps={{ callout: model } satisfies CalloutSlotProps} {...parts.skeleton} data-prism-skeleton-line="" />
      : model.empty
        ? <PrismPart slotProps={{ callout: model } satisfies CalloutSlotProps} as="div" {...parts.skeleton} className={cx(parts.skeleton.className, !model.unstyled && 'prism-skeleton') || undefined} aria-hidden="true" />
        : children}</PrismPart>
  </PrismPart>;
}
