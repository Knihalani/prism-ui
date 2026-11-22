import { host } from '@prism-ui/react';
import { instrument, objects, print, refraction } from '@prism-ui/themes';

export const previewThemes = [
  { theme: host, description: 'Native to the host', caption: 'Inherits the host font and ink. No theme tokens supplied.' },
  { theme: refraction, description: 'The original material', caption: 'Opt-in paper, serif display type and soft edges.' },
  { theme: instrument, description: 'Structure, not just skin', caption: 'Estimate has structural slots and a segmented display. Remaining coverage comes next.' },
  { theme: print, description: 'Swiss / financial paper', caption: 'Strict rules, tabular totals and weighted decisions. Structural Print slots, not a color reskin.' },
  { theme: objects, description: 'Placeholder · tactile objects', caption: 'Token placeholder only. The receipt and sticky-note redesign comes in a later step.' },
];

export function previewOptions(search: string) {
  const params = new URLSearchParams(search);
  const theme = params.get('theme') ?? 'all';
  const rawWidth = Number(params.get('width'));
  return {
    theme: previewThemes.some(item => item.theme.name === theme) ? theme : 'all',
    mode: params.get('mode') === 'dark' ? 'dark' as const : 'light' as const,
    width: Number.isFinite(rawWidth) && rawWidth > 0 ? Math.max(280, Math.min(1200, Math.round(rawWidth))) : undefined,
  };
}

const fence = (name: string, value: unknown) => '```ui:' + name + '\n' + JSON.stringify(value) + '\n```';
export const previewSource = [
  '# Six people. One week.',
  'Make the first conversations count. Here is a small research pilot: the budget, a choice of approach, and a working invitation to review.',
  '| Milestone | Plan |\n| --- | --- |\n| Recruit | Six small teams |\n| Learn | One week of conversations |',
  '```js wrap\nconst pilot = { teams: 6, weeks: 1 };\nconsole.log("Start small. Learn quickly.", pilot);\n```',
  fence('estimate', {
    id: 'pilot', title: 'Pilot estimate', currency: 'USD', submit: 'Send estimate',
    items: [
      { id: 'seats', label: 'Pilot seats', description: 'A week with real teams.', price: 36, qty: 6, min: 1, max: 20, unit: 'seat' },
      { id: 'thanks', label: 'Thank-yous', description: 'For six honest conversations.', price: 12, qty: 6, min: 0, max: 20, unit: 'person' },
      { id: 'notes', label: 'Shared notes', description: 'One home for every insight.', price: 36, qty: 1, optional: true, enabled: true },
    ],
  }),
  fence('pick', {
    id: 'approach', question: 'What matters to you?', weights: { learning: 2, cost: 3, speed: 2 },
    criteria: [{ id: 'learning', label: 'Learning' }, { id: 'cost', label: 'Cost' }, { id: 'speed', label: 'Speed' }],
    options: [
      { id: 'concierge', title: 'Concierge', subtitle: 'A few teams. Real conversations.', scores: { learning: .9, cost: .5, speed: .8 } },
      { id: 'self', title: 'Self-serve', subtitle: 'More reach. Less hand-holding.', scores: { learning: .6, cost: .9, speed: .6 } },
      { id: 'paired', title: 'Paired', subtitle: 'A guide, then room to explore.', scores: { learning: .8, cost: .6, speed: .7 } },
    ],
  }),
  fence('mockup', {
    id: 'invite', title: 'Pilot invitation', kind: 'html', device: 'mobile', height: 260,
    source: '<!doctype html><html><head><style>body{margin:0;padding:28px;font:16px/1.5 system-ui;background:#faf8f2;color:#24352d}small{letter-spacing:.12em}h1{font-size:30px;line-height:1.1;margin:16px 0}p{max-width:36ch}button{font:inherit;border:0;border-radius:6px;background:#24352d;color:white;padding:10px 16px}</style></head><body><small>FIELDNOTES / EARLY ACCESS</small><h1>Good questions.<br>Better beginnings.</h1><p>Join six teams shaping a calmer way to work.</p><button>Join the pilot →</button></body></html>',
  }),
  fence('view', {
    id: 'pilot-settings', title: 'Set up the pilot', frame: 'inline',
    state: { name: 'Fieldnotes pilot', email: 'research@example.com', cadence: 'weekly', reminders: true },
    children: [
      { type: 'input', label: 'Project name', value: { $bind: 'name' } },
      { type: 'input', label: 'Contact email', inputType: 'email', value: { $bind: 'email' } },
      { type: 'segmented', label: 'Check-in cadence', value: { $bind: 'cadence' }, options: [{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'end', label: 'At the end' }] },
      { type: 'toggle', label: 'Send reminders', description: 'A quiet nudge before each conversation.', value: { $bind: 'reminders' } },
    ],
    actions: [{ type: 'button', label: 'Save pilot plan', variant: 'primary', onClick: { action: 'save', payload: { name: { $ref: 'name' }, cadence: { $ref: 'cadence' } } } }],
  }),
].join('\n\n');
