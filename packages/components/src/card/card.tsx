import { componentStrings } from '../strings';
import { useLayoutEffect, useRef, type HTMLAttributes } from 'react';
import { useStrings, PrismPart, cx, StreamSkeleton, usePart, useSent, useSlot, type PrismComponentProps } from '@prism-ui/react';
import { Badge } from '../badge/badge';
import { FrameIcon, useFrame } from '../frame';
import { CheckMark } from '../shared';

export interface CardProps {
  id?: string; title?: string; subtitle?: string; image?: string; href?: string; action?: string;
  badge?: string; actionVariant?: 'primary' | 'quiet';
  variant?: 'elevated' | 'outline' | 'ghost'; size?: 'sm' | 'md' | 'lg';
}
type Context = Pick<PrismComponentProps, 'complete' | 'children'>;
function Header(props: HTMLAttributes<HTMLElement>) { return <PrismPart as="header" {...props} />; }
function Title(props: HTMLAttributes<HTMLHeadingElement>) { return <PrismPart as="h3" {...props} />; }
function Body(props: HTMLAttributes<HTMLDivElement>) { return <PrismPart as="div" {...props} />; }
function Actions(props: HTMLAttributes<HTMLElement>) { return <PrismPart as="footer" {...props} />; }
function safeHref(value?: string) {
  if (!value?.trim()) return undefined;
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(value, 'https://prism.invalid/').protocol) ? value : undefined;
  } catch { return undefined; }
}
export function useCard(props: CardProps, ctx: Context) {
  const { sent, send, reset } = useSent(), state = ctx.complete ? 'done' : 'streaming';
  const frame = useFrame({ component: 'card', title: props.title, ask: true, undo: false });
  const previous = useRef({ action: props.action, title: props.title, href: props.href });
  useLayoutEffect(() => {
    const { action, title, href } = props;
    const last = previous.current;
    if (last.action !== action || last.title !== title || last.href !== href) {
      previous.current = { action, title, href };
      reset();
    }
  }, [props.action, props.title, props.href, reset]);
  const parts = { ...frame.parts, header: usePart('card', 'header', state), title: usePart('card', 'title', state), toolbar: usePart('card', 'toolbar', state), body: usePart('card', 'body', state), ask: usePart('card', 'ask', state), subtitle: usePart('card', 'subtitle', state), image: usePart('card', 'image', state), action: usePart('card', 'action', state), actions: usePart('card', 'actions', state), skeleton: usePart('card', 'skeleton', state), link: usePart('card', 'link', state) };
  const empty = !ctx.children || Array.isArray(ctx.children) && !ctx.children.length;
  return { ...frame, parts, sent, href: safeHref(props.href), variant: props.variant ?? 'outline', size: props.size ?? 'md', empty: empty && (!ctx.complete || !props.title), onSelect: () => send('select', { title: props.title, href: props.href }) };
}
export function Card({ props, children, ...ctx }: PrismComponentProps<CardProps>) {
  const themeStrings = useStrings('card', componentStrings.card);
  const model = useCard(props, { ...ctx, children }), { parts } = model;
  const sent = model.sent !== undefined;
  const HeaderSlot = useSlot('card', 'header', Header), TitleSlot = useSlot('card', 'title', Title), BodySlot = useSlot('card', 'body', Body), ActionsSlot = useSlot('card', 'actions', Actions);
  return <PrismPart as="article" {...model.rootProps} className={cx(model.rootProps.className, !model.unstyled && 'prism-materialise') || undefined} data-variant={model.variant} data-size={model.size} data-linked={model.href ? '' : undefined}>
    {props.image && <PrismPart as="img" {...parts.image} src={props.image} alt="" />}
    <HeaderSlot {...parts.header} data-utility-only={!props.title && !props.subtitle && !props.badge ? '' : undefined}>
      {props.badge && <Badge {...ctx} props={{ tone: 'success', dot: true }}>{props.badge}</Badge>}
      <PrismPart as="div" {...parts.toolbar}>
        {props.title && <TitleSlot {...parts.title}>{model.href ? <PrismPart as="a" {...parts.link} href={model.href}>{props.title}</PrismPart> : props.title}</TitleSlot>}
        <PrismPart as="button" {...parts.ask} className={cx(parts.ask.className, !model.unstyled && 'prism-icon-btn') || undefined} type="button" onClick={model.onAsk} aria-label={themeStrings.askAboutThis} title={themeStrings.askAboutThis}>
          <FrameIcon name="ask" />
        </PrismPart>
      </PrismPart>
      {props.subtitle && <PrismPart as="p" {...parts.subtitle}>{props.subtitle}</PrismPart>}
    </HeaderSlot>
    <BodySlot {...parts.body}>{model.empty && !ctx.complete && !model.unstyled
      ? <StreamSkeleton {...parts.skeleton} data-prism-skeleton-line="" />
      : model.empty
        ? <PrismPart as="div" {...parts.skeleton} className={cx(parts.skeleton.className, !model.unstyled && 'prism-skeleton') || undefined} aria-hidden="true" />
        : children}</BodySlot>
    {props.action && <ActionsSlot {...parts.actions}>
      <PrismPart as="button" {...parts.action} className={cx(parts.action.className, !model.unstyled && 'prism-pill') || undefined} type="button" data-variant={props.actionVariant ?? 'primary'} data-feedback="" data-sent={sent ? '' : undefined} onClick={model.onSelect}>
        <span aria-hidden={sent || undefined} hidden={model.unstyled && sent}>{props.action}</span>
        <span aria-hidden={!sent || undefined} hidden={model.unstyled && !sent}>{model.unstyled ? <FrameIcon name="check" /> : <CheckMark />} {themeStrings.sent}</span>
      </PrismPart>
    </ActionsSlot>}
  </PrismPart>;
}
