import { type HTMLAttributes } from 'react';
import { useEmit, usePart, useSlot, type PrismComponentProps } from '@prism-ui/react';
import { useFrame } from '../frame';

export interface CardProps { id?: string; title?: string; subtitle?: string; image?: string; href?: string; action?: string; variant?: 'elevated' | 'outline' | 'ghost'; size?: 'sm' | 'md' | 'lg' }
type Context = Pick<PrismComponentProps, 'complete' | 'children'>;
function Header(props: HTMLAttributes<HTMLElement>) { return <header {...props} />; }
function Title(props: HTMLAttributes<HTMLHeadingElement>) { return <h3 {...props} />; }
function Body(props: HTMLAttributes<HTMLDivElement>) { return <div {...props} />; }
function Actions(props: HTMLAttributes<HTMLElement>) { return <footer {...props} />; }
export function useCard(props: CardProps, ctx: Context) {
  const emit = useEmit(), state = ctx.complete ? 'done' : 'streaming';
  const frame = useFrame({ component: 'card', title: props.title, state, ask: true, undo: false });
  const parts = { ...frame.parts, header: usePart('card', 'header', state), title: usePart('card', 'title', state), toolbar: usePart('card', 'toolbar', state), body: usePart('card', 'body', state), ask: usePart('card', 'ask', state), subtitle: usePart('card', 'subtitle', state), image: usePart('card', 'image', state), action: usePart('card', 'action', state), actions: usePart('card', 'actions', state), skeleton: usePart('card', 'skeleton', state), link: usePart('card', 'link', state) };
  return { ...frame, parts, variant: props.variant ?? 'outline', size: props.size ?? 'md', empty: !props.title && (!ctx.children || Array.isArray(ctx.children) && !ctx.children.length), onSelect: () => emit('select', { title: props.title, href: props.href }) };
}
export function Card({ props, children, ...ctx }: PrismComponentProps<CardProps>) {
  const model = useCard(props, { ...ctx, children }), { parts } = model;
  const HeaderSlot = useSlot('card', 'header', Header), TitleSlot = useSlot('card', 'title', Title), BodySlot = useSlot('card', 'body', Body), ActionsSlot = useSlot('card', 'actions', Actions);
  return <article {...model.rootProps} data-variant={model.variant} data-size={model.size} data-linked={props.href ? '' : undefined}>
    {props.image && <img {...parts.image} src={props.image} alt="" />}
    <HeaderSlot {...parts.header}><div {...parts.toolbar}>{props.title && <TitleSlot {...parts.title}>{props.href ? <a {...parts.link} href={props.href}>{props.title}</a> : props.title}</TitleSlot>}<button {...parts.ask} type="button" onClick={model.onAsk}>Ask about this</button></div>{props.subtitle && <p {...parts.subtitle}>{props.subtitle}</p>}</HeaderSlot>
    <BodySlot {...parts.body}>{model.empty ? <div {...parts.skeleton} aria-hidden="true" /> : children}</BodySlot>
    {props.action && <ActionsSlot {...parts.actions}><button {...parts.action} type="button" onClick={model.onSelect}>{props.action}</button></ActionsSlot>}
  </article>;
}
