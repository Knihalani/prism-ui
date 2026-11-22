import React, { useId, useLayoutEffect, useState, type HTMLAttributes } from 'react';
import { useComponentState, useSent, useSettled, type PrismComponentProps } from '@prism-ui/react';
import { Callout, type CalloutProps } from '@prism-ui/components/callout';
import { Pill } from '@prism-ui/components/shared';

const advice = {
  tip: {
    label: 'Tip',
    title: '✦ Start with a question, not a dashboard.',
    body: 'Ask what the team needs to learn before choosing what to measure. Six good conversations will tell you more than six hundred anonymous clicks.',
  },
  note: {
    label: 'Note',
    title: '↳ Keep observations separate from interpretations.',
    body: 'Write down the words and the moment first. Decide what they mean together, after the conversation.',
  },
  warning: {
    label: 'Watch for',
    title: '! A quiet pilot is not necessarily a failed pilot.',
    body: 'Before you add reminders, ask what made the first contribution hard. More notifications rarely fix an unclear invitation.',
  },
} as const;
type Tone = keyof typeof advice;
const tones: Tone[] = ['tip', 'note', 'warning'];

export function AdviceExample(ctx: PrismComponentProps<CalloutProps>) {
  const [tone, setTone] = useState<Tone>('tip');
  const [expanded, setExpanded] = useState(false);
  const { send, sent, reset } = useSent();
  const detailsId = useId();
  const current = advice[tone];
  return <>
    <div className="example-tones" role="group" aria-label="Advice type">
      {tones.map(option => <button className="example-quiet" type="button" key={option} aria-pressed={tone === option}
        onClick={() => { if (tone !== option) { setTone(option); reset(); } }}>{advice[option].label}</button>)}
    </div>
    <Callout {...ctx} props={{ tone, title: current.title, icon: false }}>
      <p>{current.body}</p>
      <button className="example-quiet example-advice-more" type="button" aria-expanded={expanded} aria-controls={detailsId}
        onClick={() => setExpanded(open => !open)}>Why six people?</button>
      <p className="example-note" id={detailsId} hidden={!expanded}>
        Six conversations are enough to notice a recurring friction without turning a learning exercise into an operations project. You can always invite the seventh person.
      </p>
      <div className="example-action">
        <Pill sent={!!sent} receipt="Added to the plan" onClick={() => send('add-advice', { tone })}>Add to the plan <Forward /></Pill>
      </div>
    </Callout>
  </>;
}

export function ChecklistPanel({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const [active] = useComponentState('active', 0);
  const { send, sent, reset } = useSent();
  const settled = useSettled();
  useLayoutEffect(() => { reset(); }, [active, reset]);
  return <div {...props}>
    {children}
    <div className="example-action">
      <Pill disabled={!settled} sent={!!sent} receipt="Checklist added"
        onClick={() => send('use-checklist', active)}>Use this checklist <Forward /></Pill>
    </div>
  </div>;
}

export function CodeActions({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const [expanded, setExpanded] = useState(false);
  const explanationId = useId();
  return <>
    <div {...props}>
      {children}
      <button className="example-quiet" type="button" aria-expanded={expanded} aria-controls={explanationId}
        onClick={() => setExpanded(open => !open)}>Why an idempotency key?</button>
    </div>
    <p className="example-note" id={explanationId} hidden={!expanded}>
      Same cohort, same key. The team receives one thoughtful invitation even if the request is retried.
    </p>
  </>;
}

export function Forward() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M3 8h9m-4-4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
