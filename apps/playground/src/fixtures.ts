import '@prism-ui/components';
import { defaultRegistry } from '@prism-ui/react';

const fence = (name: string, props: unknown) => '```ui:' + name + '\n' + JSON.stringify(props, null, 2) + '\n```';
export const kitchenSink = [
  '# A thoughtful launch, without the guesswork',
  'Here’s a working plan for **Studio North’s launch**. Compare the options, adjust the budget, and send your choices back. This isn’t a screenshot — everything below is live. :badge[Ready to explore]{tone=success}',
  ':::callout{title="The short version" tone=info}\nStart with a focused pilot. Keep the first release small, learn from real customers, then scale what works.\n:::',
  '## 01 / Find your starting point',
  fence('pick', { id: 'launch-plan', question: 'What matters most for this launch?', criteria: [{ id: 'value', label: 'Value' }, { id: 'speed', label: 'Speed' }, { id: 'flexibility', label: 'Flexibility' }], weights: { value: 2, speed: 1, flexibility: 1 }, options: [{ id: 'pilot', title: 'Focused pilot', subtitle: 'Small team. Clear signal.', tag: 'Recommended', scores: { value: .95, speed: .9, flexibility: .6 }, pros: ['Ship in two weeks', 'Learn before scaling'], cons: ['Limited initial reach'] }, { id: 'full', title: 'Full launch', subtitle: 'A bigger first impression.', scores: { value: .65, speed: .5, flexibility: .95 }, pros: ['Room to grow', 'Broader coverage'], cons: ['More upfront investment'] }] }),
  '## 02 / Make the numbers yours',
  'Your monthly workspace budget is :num[1200]{id=rent min=0 max=5000 step=50 format=currency}. That’s :calc[rent * 12]{format=currency} per year. Click the number to edit it, or use the arrow keys.',
  fence('estimate', { id: 'launch-budget', title: 'The pilot budget', items: [{ id: 'seats', label: 'Team seats', price: 24, qty: 5, min: 1, max: 25, unit: 'seat' }, { id: 'setup', label: 'Guided setup', price: 180, qty: 1, optional: true, enabled: true }], taxRate: .08 }),
  '## 03 / A clear path forward',
  fence('table', { id: 'milestones', columns: [{ key: 'phase', label: 'Milestone' }, { key: 'owner', label: 'Owner' }, { key: 'budget', label: 'Budget', type: 'currency' }], rows: [{ phase: 'Discovery & interviews', owner: 'Maya', budget: 350 }, { phase: 'Pilot release', owner: 'Alex', budget: 800 }, { phase: 'Review & next steps', owner: 'Sam', budget: 250 }], pageSize: 5 }),
  fence('summary', { id: 'launch-review', title: 'Your launch brief', points: [{ text: 'A focused pilot gets you to useful feedback faster.', source: { quote: 'Validate the smallest useful experience with five real customers.', title: 'Discovery notes', url: 'https://example.com/discovery' } }, { text: 'Keep scope intentional and measure what people actually use.' }], actions: [{ text: 'Invite the pilot team', owner: 'Maya Chen', due: '2027-01-15' }, { text: 'Schedule the feedback session', owner: 'Alex Rivera', due: '2027-01-22' }] }),
  '---\n**Over to you.** Choose a plan or adjust an estimate. Open **Actions** to see exactly what the agent receives, including the generated message.',
].join('\n\n');

export function examples() {
  return defaultRegistry.list().sort((a, b) => a.name.localeCompare(b.name)).map(def => {
    let source = def.examples?.join('\n\n') ?? (def.inline ? `:${def.name}[Example]{}` : def.syntax === 'container' ? `:::${def.name}\nExample content.\n:::` : fence(def.name, {}));
    if (def.name === 'tab') source = '::::tabs\n' + source + '\n::::';
    if (def.name === 'calc') source = '```ui:state\n{"set":{"rent":1200}}\n```\n\n' + source;
    return { id: def.name, title: def.name, description: def.docs ?? 'Registry component', source };
  });
}
