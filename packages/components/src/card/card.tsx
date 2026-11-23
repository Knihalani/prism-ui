import { componentStrings, formatComponentMessage } from '../strings';
import { useLayoutEffect, useRef } from 'react';
import { useStrings, Icon, PrismPart, cx, StreamSkeleton, usePart, useSent, useSentAnnouncement, type PrismComponentProps } from '@prism-ui/react';
import { Badge } from '../badge/badge';
import { useFrame } from '../frame';
import { CheckMark } from '../shared/controls';

export interface CardProps {
  id?: string; title?: string; subtitle?: string; image?: string; href?: string; action?: string;
  badge?: string; actionVariant?: 'primary' | 'quiet';
  variant?: 'elevated' | 'outline' | 'ghost'; size?: 'sm' | 'md' | 'lg';
}
type Context = Pick<PrismComponentProps, 'complete' | 'children'>;
function safeHref(value?: string) {
  if (!value?.trim()) return undefined;
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(value, 'https://prism.invalid/').protocol) ? value : undefined;
  } catch { return undefined; }
}
export function useCard(props: CardProps, ctx: Context) {
  const strings = useStrings('card', componentStrings.card, props);
  const { sent, send, reset } = useSent(), state = ctx.complete ? 'done' : 'streaming';
  const frame = useFrame({ component: 'card', title: strings.title, ask: true, undo: false });
  const previous = useRef({ action: props.action, title: props.title, href: props.href });
  useLayoutEffect(() => {
    const { action, title, href } = props;
    const last = previous.current;
    if (last.action !== action || last.title !== title || last.href !== href) {
      previous.current = { action, title, href };
      reset();
    }
  }, [props.action, props.title, props.href, reset]);
  const parts = { ...frame.parts, header: usePart('card', 'header', state), title: usePart('card', 'title', state), toolbar: usePart('card', 'toolbar', state), body: usePart('card', 'body', state), ask: usePart('card', 'ask', state), subtitle: usePart('card', 'subtitle', state), image: usePart('card', 'image', state), action: usePart('card', 'action', state), actions: usePart('card', 'actions', state), skeleton: usePart('card', 'skeleton', state), link: usePart('card', 'link', state), linkIcon: usePart('card', 'linkIcon', state), actionLabel: usePart('card', 'actionLabel', state), receipt: usePart('card', 'receipt', state) };
  const empty = !ctx.children || Array.isArray(ctx.children) && !ctx.children.length;
  return { ...frame, parts, sent, strings, title: strings.title, subtitle: strings.subtitle, action: strings.action, badge: strings.badge, href: safeHref(props.href), variant: props.variant ?? 'outline', size: props.size ?? 'md', empty: empty && (!ctx.complete || !props.title), onSelect: () => send('select', { title: props.title, href: props.href }, formatComponentMessage(strings.selectMessage, { payload: JSON.stringify({ title: props.title, href: props.href }) })) };
}
export type CardModel = ReturnType<typeof useCard>;
export interface CardSlotProps { card: CardModel }
export function Card({ props, children, ...ctx }: PrismComponentProps<CardProps>) {
  const model = useCard(props, { ...ctx, children }), { parts, strings: themeStrings } = model;
  const sent = model.sent !== undefined;
  const announcement = useSentAnnouncement(sent, themeStrings.sent);
  return <PrismPart slotProps={{ card: model } satisfies CardSlotProps} as="article" {...model.rootProps} role="article" className={cx(model.rootProps.className, !model.unstyled && 'prism-materialise') || undefined} data-variant={model.variant} data-size={model.size} data-linked={model.href ? '' : undefined}>
    {announcement}{props.image && <PrismPart slotProps={{ card: model } satisfies CardSlotProps} as="img" {...parts.image} src={props.image} alt="" />}
    <PrismPart slotProps={{ card: model } satisfies CardSlotProps} as="header" {...parts.header} data-utility-only={!model.title && !model.subtitle && !model.badge ? '' : undefined}>
      {model.badge && <Badge {...ctx} props={{ tone: 'success', dot: true }}>{model.badge}</Badge>}
      <PrismPart slotProps={{ card: model } satisfies CardSlotProps} as="div" {...parts.toolbar}>
        {model.title && <PrismPart slotProps={{ card: model } satisfies CardSlotProps} as="h3" {...parts.title}>{model.href ? <PrismPart slotProps={{ card: model } satisfies CardSlotProps} as="a" {...parts.link} href={model.href}>{model.title}<PrismPart as={Icon} {...parts.linkIcon} slotProps={{ card: model } satisfies CardSlotProps} name="external" /></PrismPart> : model.title}</PrismPart>}
        <PrismPart slotProps={{ card: model } satisfies CardSlotProps} as="button" {...parts.ask} className={cx(parts.ask.className, !model.unstyled && 'prism-icon-btn') || undefined} type="button" onClick={model.onAsk} aria-label={themeStrings.askAboutThis} title={themeStrings.askAboutThis}>
          <Icon name="ask" />
        </PrismPart>
      </PrismPart>
      {model.subtitle && <PrismPart slotProps={{ card: model } satisfies CardSlotProps} as="p" {...parts.subtitle}>{model.subtitle}</PrismPart>}
    </PrismPart>
    <PrismPart slotProps={{ card: model } satisfies CardSlotProps} as="div" {...parts.body}>{model.empty && !ctx.complete && !model.unstyled
      ? <PrismPart as={StreamSkeleton} slotProps={{ card: model } satisfies CardSlotProps} {...parts.skeleton} data-prism-skeleton-line="" />
      : model.empty
        ? <PrismPart slotProps={{ card: model } satisfies CardSlotProps} as="div" {...parts.skeleton} className={cx(parts.skeleton.className, !model.unstyled && 'prism-skeleton') || undefined} aria-hidden="true" />
        : children}</PrismPart>
    {model.action && <PrismPart slotProps={{ card: model } satisfies CardSlotProps} as="footer" {...parts.actions}>
      <PrismPart slotProps={{ card: model } satisfies CardSlotProps} as="button" {...parts.action} className={cx(parts.action.className, !model.unstyled && 'prism-pill') || undefined} type="button" data-variant={props.actionVariant ?? 'primary'} data-feedback="" data-sent={sent ? '' : undefined} disabled={sent} onClick={model.onSelect}>
        <PrismPart slotProps={{ card: model } satisfies CardSlotProps} as="span" {...parts.actionLabel} aria-hidden={sent || undefined} hidden={model.unstyled && sent}>{model.action}</PrismPart>
        <PrismPart slotProps={{ card: model } satisfies CardSlotProps} as="span" {...parts.receipt} aria-hidden={!sent || undefined} hidden={model.unstyled && !sent}><CheckMark /> {themeStrings.sent}</PrismPart>
      </PrismPart>
    </PrismPart>}
  </PrismPart>;
}
