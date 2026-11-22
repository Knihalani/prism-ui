import { type HTMLAttributes } from 'react';
import { cx, useEmit, usePart, usePrism, useSlot, type PrismComponentProps } from '@prism-ui/react';
import { FrameIcon } from '../frame';

export interface CalloutProps { id?: string; tone?: 'info' | 'success' | 'warning' | 'danger' | 'note'; title?: string; variant?: 'soft' | 'outline'; icon?: boolean }
type Context = Pick<PrismComponentProps, 'complete' | 'children'>;
function Header(props: HTMLAttributes<HTMLElement>) { return <header {...props} />; }
function Title(props: HTMLAttributes<HTMLHeadingElement>) { return <h3 {...props} />; }
function Body(props: HTMLAttributes<HTMLDivElement>) { return <div {...props} />; }
const paths = { info: 'M12 11v6m0-10v1', success: 'm7 12 3 3 7-7', warning: 'M12 7v6m0 3v1', danger: 'm8 8 8 8m0-8-8 8', note: 'M8 8h8M8 12h8M8 16h5' };
function Icon({ tone = 'info', ...props }: React.SVGProps<SVGSVGElement> & { tone?: CalloutProps['tone'] }) { return <svg {...props} aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d={paths[tone]} /></svg>; }
export function useCallout(props: CalloutProps, ctx: Context) {
  const { animate, unstyled } = usePrism(), emit = useEmit(), state = ctx.complete ? 'done' : 'streaming';
  const parts = { root: usePart('callout', 'root', state), header: usePart('callout', 'header', state), title: usePart('callout', 'title', state), icon: usePart('callout', 'icon', state), body: usePart('callout', 'body', state), ask: usePart('callout', 'ask', state), skeleton: usePart('callout', 'skeleton', state) };
  return { parts, unstyled, tone: props.tone ?? 'info', variant: props.variant ?? 'soft', showIcon: props.icon ?? true, empty: !ctx.children || Array.isArray(ctx.children) && !ctx.children.length, onAsk: () => emit('ask'), rootProps: { ...parts.root, role: 'note', 'aria-label': props.title ?? props.tone ?? 'info', 'data-prism-enter': animate ? '' : undefined } };
}
export function Callout({ props, children, ...ctx }: PrismComponentProps<CalloutProps>) {
  const model = useCallout(props, { ...ctx, children }), { parts } = model;
  const HeaderSlot = useSlot('callout', 'header', Header), TitleSlot = useSlot('callout', 'title', Title), IconSlot = useSlot('callout', 'icon', Icon), BodySlot = useSlot('callout', 'body', Body);
  return <aside {...model.rootProps} data-tone={model.tone} data-variant={model.variant}>
    <HeaderSlot {...parts.header}>{model.showIcon && <IconSlot {...parts.icon} tone={model.tone} />}{props.title && <TitleSlot {...parts.title}>{props.title}</TitleSlot>}<button {...parts.ask} className={cx(parts.ask.className, !model.unstyled && 'prism-icon-btn') || undefined} type="button" onClick={model.onAsk} aria-label="Ask about this" title="Ask about this"><FrameIcon name="ask" /></button></HeaderSlot>
    <BodySlot {...parts.body}>{model.empty ? <div {...parts.skeleton} className={cx(parts.skeleton.className, !model.unstyled && 'prism-skeleton') || undefined} aria-hidden="true" /> : children}</BodySlot>
  </aside>;
}
