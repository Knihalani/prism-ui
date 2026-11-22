import type { Action } from '@prism-ui/react';
import type { Reply, Turn } from '../types';

export interface ScenarioContext { scope: string; ownerScope: string; history: Turn[] }
export interface Scenario {
  id: string; title: string; prompt: string; keywords: string[]; components: string[];
  opening(scope: string): string;
  onAction(action: Action, ctx: ScenarioContext): Reply | undefined;
  onMessage?(text: string, ctx: ScenarioContext): Reply | undefined;
}
const ui = (name: string, props: object) => '```ui:' + name + '\n' + JSON.stringify(props) + '\n```';
const record = (value: unknown): Record<string, any> => value && typeof value === 'object' ? value as Record<string, any> : {};
const safe = (value: unknown) => String(value ?? '').replace(/[\n\r`<>]/g, ' ').slice(0, 300);
const table = (scope: string, rows: object[]) => ui('table', { id: scope + '-specs', columns: [{ key: 'item', label: 'Detail' }, { key: 'value', label: 'Recommendation' }], rows });
const estimate = (scope: string, title: string, price: number, qty: number) => ui('estimate', { id: scope + '-budget', title, items: [{ id: 'seats', label: 'People', price, qty, min: 1, max: 30 }, { id: 'buffer', label: 'Contingency', price: 200, qty: 1, optional: true, enabled: false }] });
const runbook = (scope: string) => `::::runbook{id=${scope}-fix title="Safe recovery"}\n:::step{id=${scope}-env title="Restore the secret"}\nCheck DATABASE_URL in the deployment environment. Restore the last known working value; never paste it here.\n:::\n:::step{id=${scope}-verify title="Verify then promote"}\nRedeploy a canary, check health and migration logs, then promote. Roll back if errors rise.\n:::\n::::\n\nWhen both steps are done, tell me “done” and we’ll close the incident.`;
const chart = (scope: string) => ui('chart', { id: scope + '-signals', title: 'Interview signals · illustrative sample', type: 'bar', x: 'theme', insight: 'Fragmented updates are the strongest signal, not a measured population trend.', series: [{ key: 'count', label: 'Mentions' }], data: [{ theme: 'Updates', count: 8 }, { theme: 'Search', count: 5 }, { theme: 'Reporting', count: 3 }] });
const html = (direction: string, feedback = '') => `<main style="padding:48px;background:${direction === 'B' ? '#182c29;color:#fff' : '#f3f1e8;color:#183c32'};font:18px system-ui"><small>FIELDNOTES / A CALMER WORKDAY</small><h1>${direction === 'B' ? 'Your next good idea starts here.' : 'Less busywork. More good work.'}</h1><p>A shared home for decisions, notes and the next step.</p>${feedback ? '<p>Built around your feedback: ' + feedback.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '</p>' : ''}<button style="padding:16px 24px">Start your free pilot</button></main>`;
const fallback = (title: string, action: Action): Reply | undefined => action.type === 'copy' ? undefined : { text: `I’ve noted that update to ${title}. Tell me what you’d like to refine next; nothing has been booked or sent externally.` };

export const scenarios: Scenario[] = [
  {
    id: 'laptop', title: 'Your next laptop', prompt: 'Help me pick a laptop', keywords: ['laptop', 'notebook', 'macbook', 'computer buy'], components: ['pick'],
    opening: scope => 'For a daily driver, I’d prioritize battery life and headroom over a flashy spec sheet. These are illustrative configurations; check current prices before buying. Adjust the weights to make the trade-offs yours.\n\n' + ui('pick', { id: scope + '-laptops', question: 'Which trade-off fits your work?', criteria: [{ id: 'battery', label: 'Battery' }, { id: 'power', label: 'Performance' }, { id: 'value', label: 'Value' }], weights: { battery: 2, power: 1, value: 2 }, options: [{ id: 'air', title: 'MacBook Air', subtitle: 'Portable · around $1,200', scores: { battery: .95, power: .75, value: .8 }, pros: ['Quiet', 'All-day battery'], cons: ['Limited ports'] }, { id: 'thinkpad', title: 'ThinkPad T14', subtitle: 'Flexible · around $1,400', scores: { battery: .7, power: .85, value: .8 }, pros: ['More ports', 'Linux friendly'], cons: ['Heavier'] }] }),
    onAction(action, ctx) {
      if (action.type !== 'choose') return fallback('your laptop shortlist', action);
      const choice = record(action.payload).option === 'thinkpad' ? 'ThinkPad T14' : 'MacBook Air';
      return { text: `${choice} it is. Your adjusted priorities are ${Object.keys(record(record(action.payload).weights)).map(safe).join(', ') || 'balanced everyday use'}. I’d buy enough memory now rather than pay for storage you won’t use.\n\n` + table(ctx.scope, [{ item: 'Model', value: choice }, { item: 'Memory / storage', value: '16 GB / 512 GB' }, { item: 'Before checkout', value: 'Check return window and display compatibility' }]) };
    },
    onMessage: text => /budget|\$|memory|gaming/i.test(text) ? { text: `For “${safe(text)}”, I’d revisit the value and performance weights. For gaming, neither shortlist option is ideal; tell me your games and maximum spend before we choose a dedicated GPU.` } : undefined,
  },
  {
    id: 'kyoto', title: 'Four days in Kyoto', prompt: 'Plan a 4-day Kyoto trip', keywords: ['kyoto', 'japan trip', 'four day trip', '4-day trip'], components: ['tabs', 'ask'],
    opening: scope => 'Four days is enough to enjoy Kyoto without racing across town. Keep each day in one area, with an early start for the busiest sights.\n\n::::tabs{label="Kyoto by day"}\n' + ['Higashiyama · Kiyomizu-dera and quiet lanes', 'Arashiyama · river walk and bamboo grove', 'Fushimi · shrine trails and a sake district stroll', 'Northern Kyoto · gardens and a slow café afternoon'].map((day, i) => `:::tab{label="Day ${i + 1}"}\n${day}. Leave the afternoon flexible.\n:::`).join('\n') + '\n::::\n\n' + ui('ask', { id: scope + '-preferences', title: 'Make it your trip', submit: 'Tailor my itinerary', fields: [{ id: 'dates', type: 'date', label: 'Arrival date', required: true }, { id: 'pace', type: 'select', label: 'Pace', options: ['Relaxed', 'Active'], value: 'Relaxed' }, { id: 'budget', type: 'number', label: 'Daily budget (USD)', value: 150, min: 30 }] }),
    onAction(action, ctx) {
      if (action.type !== 'submit') return fallback('Kyoto', action);
      const values = record(record(action.payload).values), budget = Number(values.budget) || 150;
      return { text: `Starting ${safe(values.dates) || 'on your chosen date'}, I’ll keep the pace ${safe(values.pace) || 'relaxed'}. ${values.pace === 'Active' ? 'Add the full Fushimi trail on day three.' : 'Use taxis for the longest transfers and keep one major sight per morning.'} At $${budget} per day, allow about $${budget * 4} per person, excluding flights. This is a planning estimate, not a booking.\n\n` + estimate(ctx.scope, 'Four-day Kyoto allowance', budget * 4, 1) };
    },
  },
  {
    id: 'deploy', title: 'Recover the deploy', prompt: 'Debug my failing deploy', keywords: ['deploy', 'deployment', 'failing build', 'production broken'], components: ['code', 'troubleshoot'],
    opening: scope => 'Let’s isolate the failure before changing production. Here’s a representative log — replace it with your redacted error if yours differs.\n\n```text {title="deploy.log"}\nError: DATABASE_URL is not configured\nHealth check failed; canary not promoted\n```\n\n' + ui('troubleshoot', { id: scope + '-diagnosis', title: 'Deployment triage', start: 'env', steps: { env: { text: 'Is DATABASE_URL configured in the target environment?', yes: 'health', no: '$escalate' }, health: { text: 'Does the previous release still pass its health check?', yes: '$fixed', no: '$escalate' } } }),
    onAction(action, ctx) {
      if (action.type === 'troubleshoot') return { text: `${record(action.payload).resolved ? 'The previous release is healthy; keep traffic there while you verify.' : 'Thanks — keep the canary out of rotation and restore configuration first.'}\n\n` + runbook(ctx.scope) };
      if (action.type === 'stuck') return { text: `For “${safe(record(action.payload).title)}”, check the deployment target and secret name, not just your local environment. If you lack access, ask the on-call owner. Share the redacted error, never the secret.` };
      return fallback('the recovery', action);
    },
    onMessage: (text, ctx) => /done|finished|healthy|fixed/i.test(text) ? { text: 'Good recovery. Watch error rate and latency for ten minutes, record the configuration change, and add a preflight check for required secrets. Close the incident only once the canary is stable.' } : /error|log|no|yes/i.test(text) ? { text: `Given “${safe(text)}”, let’s verify configuration before promotion.\n\n` + runbook(ctx.scope) } : undefined,
  },
  {
    id: 'landing', title: 'A landing page direction', prompt: 'Mock up a landing page', keywords: ['landing page', 'mock up', 'mockup', 'website design'], components: ['mockup'],
    opening: scope => 'Two directions for Fieldnotes: A is calm and editorial; B is bold and product-led. Compare them, prefer one, or leave feedback directly on the canvas.\n\n' + ['A', 'B'].map(v => '```mockup:html {id=' + scope + '-' + v + ' group=' + scope + '-directions variant=' + v + ' title="Fieldnotes landing"}\n' + html(v) + '\n```').join('\n\n'),
    onAction(action, ctx) {
      if (action.type !== 'feedback' && action.type !== 'choose' && action.type !== 'prefer') return fallback('the landing page', action);
      const p = record(action.payload), direction = (p.preferred ?? p.variant) === 'B' ? 'B' : 'A';
      const comments = [...(Array.isArray(p.items) ? p.items : []), ...(Array.isArray(p.variants) ? p.variants.flatMap((v: any) => v.items ?? []) : [])];
      const feedback = safe(p.overall || comments.map((item: any) => item.comment).filter(Boolean).join('; ') || 'A clearer primary call to action');
      return { text: `I’ve taken direction ${direction} forward with a clearer primary action. Your brief: “${feedback}”. Here’s an editable HTML handoff; it’s a local prototype, not a published site.\n\n` + '```artifact:html {id=' + ctx.scope + '-handoff title="Revised Fieldnotes landing"}\n' + html(direction, feedback) + '\n```' };
    },
  },
  {
    id: 'offsite', title: 'Six-person offsite', prompt: 'Budget a 6-person team offsite', keywords: ['offsite', 'team retreat', 'six person', '6-person'], components: ['num', 'calc', 'estimate'],
    opening: scope => `Let’s start with a one-day offsite for six, with no flights or overnight stay. The live allowance helps you explore a ceiling; the estimate below is the version to send back.\n\nPeople: :num[6]{id=${scope}.people min=1 max=30 step=1}. Per-person ceiling: :num[250]{id=${scope}.allowance min=100 max=1000 step=25 format=currency}. Planning ceiling: :calc[${scope}.people * ${scope}.allowance]{format=currency}.\n\n` + estimate(scope, 'Team offsite · working budget', 220, 6) + '\n\nSend your edited estimate and I’ll add the optional $200 contingency so it stays visible before approval.',
    onAction(action, ctx) {
      if (action.component !== 'estimate' || !['use', 'send'].includes(action.type)) return fallback('the offsite', action);
      const p = record(action.payload), items = Array.isArray(p.items) ? p.items : [], seats = items.find((item: any) => item.id === 'seats');
      return { text: `Your working version is $${safe(p.total ?? 'not specified')} for ${safe(seats?.qty ?? 6)} people. I’ve enabled the contingency in the original estimate; review the new total before approval. Next: confirm accessibility needs, request a venue hold, and get a written cancellation policy. No reservation has been made.`, patch: { set: { [action.id + '.items.buffer.enabled']: true } } };
    },
  },
  {
    id: 'research', title: 'Customer research brief', prompt: 'Summarize our customer research', keywords: ['customer research', 'interviews', 'research', 'customer insights'], components: ['summary', 'chart'],
    opening: scope => 'Here’s an illustrative synthesis, not a claim about research you haven’t shared. The strongest theme is fragmented updates; validate it against your interview notes before prioritizing.\n\n' + ui('summary', { id: scope + '-findings', title: 'What customers need', points: [{ text: 'Updates are scattered across too many tools.', source: { title: 'Illustrative interview 01', quote: 'I check three places before I know what changed.' } }, { text: 'Start with a digest, not a new dashboard.', source: { title: 'Illustrative interview 02', quote: 'Just tell me what needs my attention today.' } }], actions: [{ text: 'Validate the digest concept with five customers', owner: 'Maya', due: 'Next week' }] }) + '\n\n' + chart(scope),
    onAction(action, ctx) {
      const p = record(action.payload);
      if (action.type === 'ask') return { text: `On “${safe(p.text || 'the research brief')}”: this is a qualitative signal from illustrative interviews. Check negative cases and sample composition before calling it a trend.\n\n` + chart(ctx.scope) };
      if (action.type === 'send') return { text: `I’ve captured ${Array.isArray(p.actions) ? p.actions.length : 0} action item(s) here. Confirm owners and dates with your team; nothing was sent externally.` };
      if (action.type === 'select' || action.type === 'pivot') return { text: `For ${safe(p.label || p.x || p.series || 'that chart selection')}, compare the interview quotes, not just the count. Mentions can overlap and do not establish willingness to pay.` };
      return fallback('the research', action);
    },
  },
];
