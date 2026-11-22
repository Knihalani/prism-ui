import { componentStrings } from '../strings';
import { type ButtonHTMLAttributes, type HTMLAttributes } from 'react';
import { useStrings, Icon as ThemeIcon, PrismPart, cx, StreamSkeleton, useEmit, usePart, usePresentation, usePrism, useSlot, type PrismComponentProps } from '@prism-ui/react';
import { FrameIcon } from '../frame';

export interface CalloutProps { id?: string; tone?: 'info' | 'success' | 'warning' | 'danger' | 'note' | 'tip'; title?: string; variant?: 'soft' | 'outline'; icon?: boolean }
type Context = Pick<PrismComponentProps, 'complete' | 'children'>;
function Header(props: HTMLAttributes<HTMLElement>) { return <PrismPart as="header" {...props} />; }
function Title(props: HTMLAttributes<HTMLHeadingElement>) { return <PrismPart as="h3" {...props} />; }
function Body(props: HTMLAttributes<HTMLDivElement>) { return <PrismPart as="div" {...props} />; }
function Ask(props: ButtonHTMLAttributes<HTMLButtonElement>) { return <PrismPart as="button" {...props} />; }
function Icon({ tone = 'info', ...props }: React.SVGProps<SVGSVGElement> & { tone?: CalloutProps['tone'] }) {
  return <ThemeIcon {...props} name={tone === 'success' || tone === 'tip' ? 'check' : tone === 'note' ? 'info' : tone} />;
}
export function useCallout(props: CalloutProps, ctx: Context) {
  const { unstyled } = usePrism(), emit = useEmit(), presentation = usePresentation(), state = ctx.complete ? 'done' : 'streaming';
  const parts = { root: usePart('callout', 'root', state), header: usePart('callout', 'header', state), title: usePart('callout', 'title', state), icon: usePart('callout', 'icon', state), body: usePart('callout', 'body', state), ask: usePart('callout', 'ask', state), skeleton: usePart('callout', 'skeleton', state) };
  return { parts, unstyled, tone: props.tone ?? 'info', variant: props.variant ?? 'soft', showIcon: props.icon ?? true, empty: !ctx.children || Array.isArray(ctx.children) && !ctx.children.length, onAsk: () => emit('ask'), rootProps: { ...parts.root, ...presentation, role: 'note', 'aria-label': props.title ?? props.tone ?? 'info' } };
}
export function Callout({ props, children, ...ctx }: PrismComponentProps<CalloutProps>) {
  const themeStrings = useStrings('callout', componentStrings.callout);
  const model = useCallout(props, { ...ctx, children }), { parts } = model;
  const HeaderSlot = useSlot('callout', 'header', Header), TitleSlot = useSlot('callout', 'title', Title), IconSlot = useSlot('callout', 'icon', Icon), BodySlot = useSlot('callout', 'body', Body);
  const AskSlot = useSlot('callout', 'ask', Ask);
  return <PrismPart as="aside" {...model.rootProps} className={cx(model.rootProps.className, !model.unstyled && 'prism-materialise') || undefined} data-tone={model.tone} data-variant={model.variant}>
    <HeaderSlot {...parts.header}>{model.showIcon && <IconSlot {...parts.icon} tone={model.tone} />}{props.title && <TitleSlot {...parts.title}>{props.title}</TitleSlot>}<AskSlot {...parts.ask} className={cx(parts.ask.className, !model.unstyled && 'prism-icon-btn') || undefined} type="button" onClick={model.onAsk} aria-label={themeStrings.askAboutThis} title={themeStrings.askAboutThis}><FrameIcon name="ask" /></AskSlot></HeaderSlot>
    <BodySlot {...parts.body}>{model.empty && !ctx.complete && !model.unstyled
      ? <StreamSkeleton {...parts.skeleton} data-prism-skeleton-line="" />
      : model.empty
        ? <PrismPart as="div" {...parts.skeleton} className={cx(parts.skeleton.className, !model.unstyled && 'prism-skeleton') || undefined} aria-hidden="true" />
        : children}</BodySlot>
  </PrismPart>;
}
