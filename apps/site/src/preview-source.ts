import type { ComponentDef } from '@prism-ui/react';

export function previewSource(def: ComponentDef) {
  const first = def.examples?.[0] ?? '';
  if (def.name === 'num') return `Your monthly workspace budget is ${first}. Drag the amount to explore a different plan.`;
  if (def.name === 'calc') return `At $1,200 a month, your annual workspace cost is **${first}**. It updates when the budget changes.`;
  if (def.name === 'badge') return 'Release status\n\n:badge[Shipped]{tone=success} :badge[In review]{tone=info} :badge[Attention]{tone=warning}\n\nSmall signals that stay in the conversation.';
  if (def.name === 'grid') return ':::grid{cols=3 min=40 title="At a glance"}\n**Plan** · Team\n\n**Seats** · 12\n\n**Cost** · $216\n:::';
  if (def.name === 'mockup') return def.examples?.find(source => source.startsWith('```mockup:wire')) ?? first;
  if (def.name === 'step') return first.replace('Run fly auth login.', 'Run `fly auth login`, then choose your workspace.\n\nConfirm the account before deploying.');
  if (def.name === 'callout') return first.replace('Useful context.', 'Your changes are saved automatically.\n\nYou can return to this conversation whenever you’re ready.');
  return first;
}
