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
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const naturalList = (items: string[]) => new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(items);
const positive = (value: unknown, fallback: number) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
const table = (scope: string, rows: object[]) => ui('table', { id: scope + '-specs', columns: [{ key: 'item', label: 'Detail' }, { key: 'value', label: 'Recommendation' }], rows });
const criteria = [{ id: 'battery', label: 'battery life' }, { id: 'performance', label: 'performance' }, { id: 'portability', label: 'portability' }, { id: 'value', label: 'value' }];
const laptops = [
  { id: 'air', title: 'MacBook Air 15″ M-series', subtitle: 'Roomy screen, silent all day · about $1,499', price: 1499, ram: '16 GB unified memory', skip: 'Extra GPU cores; everyday work won’t feel the difference', scores: { battery: .95, performance: .85, portability: .8, value: .85 }, pros: ['Long battery life', 'Quiet, fanless design'], cons: ['Only two USB-C ports', 'Memory cannot be upgraded'] },
  { id: 'thinkpad', title: 'ThinkPad X1 Carbon', subtitle: 'Ultralight Windows workhorse · about $1,899', price: 1899, ram: '32 GB RAM', skip: 'The OLED display if battery life matters more than contrast', scores: { battery: .8, performance: .8, portability: .98, value: .65 }, pros: ['Excellent keyboard', 'Light chassis with useful ports'], cons: ['Premium price', 'Memory is soldered'] },
  { id: 'framework', title: 'Framework Laptop 13', subtitle: 'Repairable, upgradeable, yours · about $1,399', price: 1399, ram: '32 GB replaceable RAM', skip: 'Extra expansion cards until you know which ports you need', scores: { battery: .7, performance: .9, portability: .85, value: .95 }, pros: ['Replaceable parts', 'Strong Linux support'], cons: ['Shorter battery life', 'Less polished speakers'] },
];
type Diagnosis = 'environment' | 'migration' | 'health' | 'unknown' | 'healthy';
function diagnose(path: unknown): Diagnosis {
  const answers = Array.isArray(path) ? path : [];
  if (answers.some(entry => entry.step === 'env' && entry.answer === 'no')) return 'environment';
  if (answers.some(entry => entry.step === 'migration' && entry.answer === 'no')) return 'migration';
  if (answers.some(entry => entry.step === 'health' && entry.answer === 'no')) return 'health';
  if (answers.some(entry => entry.step === 'traffic' && entry.answer === 'yes')) return 'healthy';
  return 'unknown';
}
const recovery: Record<Diagnosis, { intro: string; steps: [string, string, string][] }> = {
  environment: { intro: 'The missing database connection setting explains the startup failure. Keep traffic on the previous release while you restore the canary’s configuration.', steps: [
    ['Check the secret reference', 'Compare the canary’s secret reference with the last healthy release. Restore it through your secret manager; don’t copy credentials into logs.', 'kubectl describe deployment web-canary'],
    ['Start a fresh canary', 'Roll out the same image with the corrected secret reference. Watch startup without running a database migration twice.', 'kubectl rollout restart deployment/web-canary\nkubectl rollout status deployment/web-canary --timeout=120s'],
    ['Verify readiness', 'Confirm database connectivity and a passing readiness probe before moving traffic.', 'kubectl get pods -l app=web-canary\nkubectl logs deployment/web-canary --tail=50'],
  ] },
  migration: { intro: 'Configuration is present, but the migration failed. Leave traffic on the healthy release; a blind redeploy could repeat a partial schema change.', steps: [
    ['Find the first SQL error', 'Inspect the migration job and note the last successful migration. These commands assume a job named web-migrate.', 'kubectl logs job/web-migrate --tail=100\nkubectl describe job/web-migrate'],
    ['Prepare a forward repair', 'Take a database snapshot. Review the failed SQL against the current schema and test an idempotent repair in staging before a DBA applies it.', 'kubectl get job web-migrate -o yaml'],
    ['Verify schema compatibility', 'Confirm the migration completed and both application versions can read the schema before promoting a new canary.', 'kubectl wait --for=condition=complete job/web-migrate --timeout=180s'],
  ] },
  health: { intro: 'The migration passed; the readiness timeout is the blocker. I’d check the probe target and startup time before increasing its timeout.', steps: [
    ['Inspect readiness failures', 'Check the probe path, port and response. A 404 suggests a path mismatch; connection refused points to the listener or startup.', 'kubectl describe pods -l app=web-canary\nkubectl logs deployment/web-canary --tail=100'],
    ['Check the probe locally', 'Forward the canary port and request its readiness endpoint. Replace 3000 and /healthz with the service’s actual configuration.', 'kubectl port-forward deployment/web-canary 3000:3000\n# In another terminal:\ncurl -i http://localhost:3000/healthz'],
    ['Retest the canary', 'Correct the probe or startup configuration. Extend the startup allowance only if the app is healthy but genuinely needs more time.', 'kubectl rollout status deployment/web-canary --timeout=180s'],
  ] },
  healthy: { intro: 'The canary is ready and serving requests. There’s no reason to change configuration now; verify the rollout rather than introduce a second variable.', steps: [
    ['Check the rollout', 'Compare error rate and latency with the previous release before increasing traffic.', 'kubectl rollout status deployment/web-canary --timeout=120s'],
    ['Watch the first requests', 'Keep the previous release available until a ten-minute observation window stays clean.', 'kubectl logs deployment/web-canary --since=10m --tail=100'],
  ] },
  unknown: { intro: 'The checks haven’t isolated a single cause yet. Keep the canary out of rotation and collect the first startup error, rather than chase the final timeout.', steps: [
    ['Capture the first failure', 'Redact credentials before sharing logs. These examples assume Kubernetes and a web-canary deployment; use the equivalent release in your environment.', 'kubectl logs deployment/web-canary --tail=100\nkubectl get events --sort-by=.lastTimestamp'],
    ['Compare with the healthy release', 'Check image, secret references and probe settings. Change one variable at a time, then test readiness again.', 'kubectl describe deployment web-canary'],
  ] },
};
function runbook(scope: string, cause: Diagnosis) {
  return '::::runbook{id=' + scope + '-fix title="Canary recovery · Kubernetes example"}\n' + recovery[cause].steps.map(([title, prose, command], index) => `:::step{id=${scope}-step-${index} title="${title}"}\n${prose}\n\n\`\`\`bash\n${command}\n\`\`\`\n:::`).join('\n') + '\n::::';
}
const chart = (scope: string) => ui('chart', { id: scope + '-signals', title: 'What came up in interviews · sample data', type: 'bar', x: 'theme', insight: 'Scattered updates came up most often. The counts overlap; they are not market-size estimates.', series: [{ key: 'count', label: 'Mentions' }], data: [{ theme: 'Updates', count: 8 }, { theme: 'Search', count: 5 }, { theme: 'Reporting', count: 3 }] });
const html = (direction: string, feedback = '') => `<main style="padding:48px;background:${direction === 'B' ? '#182c29;color:#fff' : '#f3f1e8;color:#183c32'};font:18px system-ui"><small>FIELDNOTES / A CALMER WORKDAY</small><h1>${direction === 'B' ? 'Your next good idea starts here.' : 'Less busywork. More good work.'}</h1><p>A shared home for decisions, notes and the next step.</p>${feedback ? '<p>Built around your feedback: ' + feedback.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '</p>' : ''}<button style="padding:16px 24px">Start your free pilot</button></main>`;
const fallback = (title: string, action: Action): Reply | undefined => action.type === 'copy' ? undefined : { text: `For ${title}, I’d keep the next step small and reversible. What’s the one thing you’d most like to improve?` };

export const scenarios: Scenario[] = [
  {
    id: 'laptop', title: 'Your next laptop', prompt: 'Help me pick a laptop', keywords: ['laptop', 'notebook', 'macbook', 'computer buy'], components: ['pick'],
    opening: scope => 'I’d start with these three: a quiet all-rounder, an ultralight work machine, and a laptop you can repair for years. For writing, calls and everyday development, battery life and a comfortable screen usually matter more than peak benchmarks. Prices are approximate US configurations, before tax.\n\n' + ui('pick', { id: scope + '-laptops', question: 'A laptop for the way you work', criteria: criteria.map(c => ({ ...c, label: c.label[0].toUpperCase() + c.label.slice(1) })), weights: { battery: 2, performance: 1, portability: 1, value: 2 }, options: laptops.map(({ price, ram, skip, ...option }) => option) }),
    onAction(action, ctx) {
      if (action.type !== 'choose') return fallback('your laptop shortlist', action);
      const p = record(action.payload), choice = laptops.find(item => item.id === p.option);
      if (!choice) return { text: 'I couldn’t identify that model. Which laptop caught your eye, and what matters most in your day-to-day work?' };
      const weights = record(p.weights), ranked = criteria.map(item => ({ ...item, weight: Number(weights[item.id] ?? (item.id === 'performance' ? weights.power : undefined)) || 0 })).filter(item => item.weight > 0).sort((a, b) => b.weight - a.weight);
      const top = ranked.filter(item => item.weight === ranked[0]?.weight).slice(0, 2);
      const priorities = top.length ? naturalList(top.map(item => item.label)) : 'everyday comfort and useful lifespan';
      const strengths = choice.id === 'air' ? 'its efficient chip and silent design make long stretches away from a desk easy' : choice.id === 'thinkpad' ? 'its light chassis and excellent keyboard make it an easy travel companion' : 'replaceable memory, storage and ports let it grow with your work';
      const weaker = top.filter(item => choice.scores[item.id as keyof typeof choice.scores] < .85);
      const tradeoff = weaker.length ? ` It does trade away some ${naturalList(weaker.map(item => item.label))}; that’s the compromise I’d double-check before buying.` : '';
      return { text: `The ${choice.title} is a thoughtful choice. With ${priorities} at the top of your list, ${strengths}.${tradeoff}\n\n` + table(ctx.scope, [{ item: 'Memory', value: choice.ram }, { item: 'Storage', value: '512 GB SSD' }, { item: 'Target price', value: `About ${money(choice.price)} before tax` }, { item: 'What to skip', value: choice.skip }]) + '\n\nI’d put any remaining budget toward a good external display, not a spec bump you won’t notice.' };
    },
    onMessage: text => /budget|\$|memory|gaming/i.test(text) ? { text: /gaming/i.test(text) ? 'For regular gaming, I’d look beyond these three: a dedicated GPU matters more than a thin chassis. Which games do you play, and what’s your ceiling?' : 'I’d protect the memory budget first: 16 GB is a comfortable starting point, or 32 GB for containers and heavier projects. What’s your maximum spend, and do you need Windows, macOS or Linux?' } : undefined,
  },
  {
    id: 'kyoto', title: 'Four days in Kyoto', prompt: 'Plan a 4-day Kyoto trip', keywords: ['kyoto', 'japan trip', 'four day trip', '4-day trip'], components: ['tabs', 'ask'],
    opening: scope => 'Four days gives you room for Kyoto’s famous sights and the quieter moments between them. I’d stay near Sanjo or Kyoto Station and explore one area a day, rather than spend the trip crossing town.\n\n::::tabs{label="Kyoto by day"}\n' + ['Start early at Kiyomizu-dera, wander Sannenzaka before the crowds, then follow the lanes north toward Gion. Keep dinner close to the river.', 'Take an early train to Arashiyama. Walk the bamboo grove, visit a garden, and leave time for lunch beside the river.', 'Visit Fushimi Inari before breakfast. Walk as far up the trail as feels good, then spend the afternoon in the sake district.', 'Choose a northern garden such as Daitoku-ji, browse a small ceramics shop, and finish with a long café stop.'].map((day, i) => `:::tab{label="Day ${i + 1}"}\n${day}\n:::`).join('\n') + '\n::::\n\n' + ui('ask', { id: scope + '-preferences', title: 'A few details for your trip', submit: 'Tailor my itinerary', fields: [{ id: 'dates', type: 'date', label: 'Arrival date', required: true }, { id: 'pace', type: 'select', label: 'Pace', options: ['Relaxed', 'Active'], value: 'Relaxed' }, { id: 'budget', type: 'number', label: 'Daily budget (USD)', value: 150, min: 30 }] }),
    onAction(action, ctx) {
      if (action.type !== 'submit') return fallback('Kyoto', action);
      const values = record(record(action.payload).values), budget = positive(values.budget, 150), active = values.pace === 'Active';
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(values.dates)) ? new Date(values.dates + 'T12:00:00Z') : undefined;
      const arrival = date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date) : 'your arrival day';
      return { text: `For ${arrival}, I’d keep the first afternoon light after the journey. ${active ? 'Your active pace leaves room for the full Fushimi Inari climb on day three and a riverside cycle on day two.' : 'At your relaxed pace, one main sight each morning is plenty; save the afternoons for gardens, cafés and unplanned stops.'} Your ${money(budget)} daily budget gives you ${money(budget * 4)} for four days, including a modest room, meals and local travel, but not flights. Seasonal hotel prices are the biggest variable.\n\n` + ui('estimate', { id: ctx.scope + '-budget', title: 'Kyoto · per-person allowance', items: [{ id: 'days', label: 'Room, meals & local travel · per day', price: budget, qty: 4, min: 4, max: 4 }] }) };
    },
  },
  {
    id: 'deploy', title: 'Recover the deploy', prompt: 'Debug my failing deploy', keywords: ['deploy', 'deployment', 'failing build', 'production broken'], components: ['code', 'troubleshoot'],
    opening: scope => 'Let’s keep the last healthy release serving traffic and work backward from the first error. In this example the canary never becomes ready; the log suggests configuration, but the checks below also cover a failed migration or a slow startup.\n\n```text {title="canary startup · example log"}\n08:42:11 web-canary starting\n08:42:12 Error: DATABASE_URL is not configured\n08:42:42 Readiness probe timed out; promotion paused\n```\n\n' + ui('troubleshoot', { id: scope + '-diagnosis', title: 'Find the rollout blocker', start: 'env', steps: {
      env: { title: 'Environment', text: 'Is DATABASE_URL present in the canary’s runtime environment?', hint: 'Check the secret reference, not the secret value.', yes: 'migration', no: '$escalate' },
      migration: { title: 'Database migration', text: 'Did the release migration finish successfully?', yes: 'health', no: '$escalate' },
      health: { title: 'Readiness', text: 'Does the canary return HTTP 200 on its readiness endpoint?', yes: 'traffic', no: '$escalate' },
      traffic: { title: 'First requests', text: 'Are the canary’s error rate and latency within the healthy release’s range?', yes: '$fixed', no: 'rollback' },
      rollback: { title: 'Safe fallback', text: 'Is the previous release still healthy and compatible with the current database schema?', yes: '$escalate', no: '$escalate' },
    } }),
    onAction(action, ctx) {
      if (action.type === 'troubleshoot') { const cause = diagnose(record(action.payload).path); return { text: recovery[cause].intro + '\n\n' + runbook(ctx.scope, cause) }; }
      if (action.type === 'stuck') {
        const step = record(action.payload).title || record(action.context.props).title;
        return { text: `Let’s pause${step ? ' at “' + safe(step) + '”' : ' on this step'}. Keep traffic on the last healthy release. What was the first error from that command? A redacted line or two is enough; don’t include connection strings or secrets.` };
      }
      return fallback('the recovery', action);
    },
    onMessage(text, ctx) {
      if (/\b(?:not|never|still|unfixed|broken|errors?|fail(?:ed|ing|ure)?|(?:isn|aren|wasn|weren|hasn|haven|didn)['’]t)\b/i.test(text)) return { text: recovery.unknown.intro + '\n\n' + runbook(ctx.scope, 'unknown') };
      if (/\b(?:done|finished|healthy|fixed)\b/i.test(text)) return { text: 'Good recovery. Give the canary ten quiet minutes before closing the incident, then record the cause and the exact change that fixed it. A small preflight check is worth adding so the next release catches this before traffic moves.' };
      return /\b(?:log|no|yes)\b/i.test(text) ? { text: recovery.unknown.intro + '\n\n' + runbook(ctx.scope, 'unknown') } : undefined;
    },
  },
  {
    id: 'landing', title: 'A landing page direction', prompt: 'Mock up a landing page', keywords: ['landing page', 'mock up', 'mockup', 'website design'], components: ['mockup'],
    opening: scope => 'For Fieldnotes, I’d lead with the relief of a calmer workday—not another list of features. These two directions share that promise: A feels like a thoughtful notebook; B has a darker, more confident product feel. Both keep one clear invitation to start a pilot.\n\n' + ['A', 'B'].map(v => '```mockup:html {id=' + scope + '-' + v + ' group=' + scope + '-directions variant=' + v + ' title="Fieldnotes landing"}\n' + html(v) + '\n```').join('\n\n'),
    onAction(action, ctx) {
      if (action.type !== 'feedback' && action.type !== 'choose' && action.type !== 'prefer') return fallback('the landing page', action);
      const p = record(action.payload), direction = (p.preferred ?? p.variant) === 'B' ? 'B' : 'A';
      const comments = [...(Array.isArray(p.items) ? p.items : []), ...(Array.isArray(p.variants) ? p.variants.flatMap((v: any) => v.items ?? []) : [])];
      const feedback = safe(p.overall || comments.map((item: any) => item.comment).filter(Boolean).join('; '));
      return { text: `I’d carry direction ${direction} forward: ${direction === 'B' ? 'the deep green gives the page confidence without making it loud' : 'the warm background and editorial rhythm make the product feel approachable'}.${feedback ? ' I’ve kept your note—“' + feedback + '”—with the handoff so it doesn’t get lost.' : ' I’ve kept the headline short and the pilot invitation as the only primary action.'} Here’s the HTML prototype; it hasn’t been published.\n\n` + '```artifact:html {id=' + ctx.scope + '-handoff title="Revised Fieldnotes landing"}\n' + html(direction, feedback) + '\n```' };
    },
  },
  {
    id: 'offsite', title: 'Six-person offsite', prompt: 'Budget a 6-person team offsite', keywords: ['offsite', 'team retreat', 'six person', '6-person'], components: ['num', 'calc', 'estimate'],
    opening: scope => `I’d make this a day away, not a travel project: a comfortable room, good food and a facilitator who lets everyone participate. For six people, ${money(1320)} covers the essentials; a ${money(200)} reserve would leave room for dietary needs or a last-minute change. No flights or overnight stay included.\n\nPeople: :num[6]{id=${scope}.people min=1 max=30 step=1}. Allowance each: :num[275]{id=${scope}.allowance min=100 max=1000 step=25 format=currency}. Planning ceiling: :calc[${scope}.people * ${scope}.allowance]{format=currency}.\n\n` + ui('estimate', { id: scope + '-budget', title: 'A day together · working budget', items: [{ id: 'seats', label: 'Venue & catering · per person', price: 170, qty: 6, min: 1, max: 30 }, { id: 'facilitator', label: 'Workshop facilitator', price: 300, qty: 1, min: 1, max: 1 }, { id: 'buffer', label: 'Contingency', price: 200, qty: 1, min: 1, max: 1, optional: true, enabled: false }] }),
    onAction(action, ctx) {
      if (action.component !== 'estimate' || !['use', 'send'].includes(action.type)) return fallback('the offsite', action);
      const p = record(action.payload), items = Array.isArray(p.items) ? p.items : [], seats = items.find((item: any) => item.id === 'seats'), buffer = items.find((item: any) => item.id === 'buffer');
      const count = positive(seats?.qty, 6), total = Number(p.total), known = p.total != null && Number.isFinite(total) && total >= 0;
      const included = !!buffer && buffer.enabled !== false;
      const reserve = included ? 0 : positive(buffer?.price, 200) * positive(buffer?.qty, 1);
      return { text: `${known ? money(total) + ' for ' : 'The working plan for '}${count} people looks workable. ${included ? 'The contingency is already included, so I’ve left it in place.' : 'I’ve included the ' + money(reserve) + ' contingency in the estimate above' + (known ? ', bringing the total to ' + money(total + reserve) : '') + '.'} That gives the team a little breathing room without turning the day into a big production. Next I’d confirm dietary and access needs, then ask the venue for a hold and its cancellation terms. Nothing has been booked.`, patch: included ? undefined : { set: { [action.id + '.items.buffer.enabled']: true } } };
    },
  },
  {
    id: 'research', title: 'Customer research brief', prompt: 'Summarize our customer research', keywords: ['customer research', 'interviews', 'research', 'customer insights'], components: ['summary', 'chart'],
    opening: scope => 'The useful question is what to do differently—not just what people said. In this sample set, customers spend too much time reconstructing what changed. I’d test a short daily digest before investing in another dashboard. These are illustrative interviews; your own notes may tell a different story.\n\n' + ui('summary', { id: scope + '-findings', title: 'Less catching up, more moving forward', points: [{ text: 'Scattered updates make a simple status check feel like detective work.', source: { title: 'Sample interview · operations lead', quote: 'I check three places before I know what changed.' } }, { text: 'People want a short list of what needs attention, not more reporting to maintain.', source: { title: 'Sample interview · project manager', quote: 'Just tell me what needs my attention today.' } }], actions: [{ text: 'Test a daily digest with five customers', owner: 'Maya', due: 'Next week' }] }) + '\n\n' + chart(scope),
    onAction(action, ctx) {
      const p = record(action.payload);
      if (action.type === 'ask') return { text: `${p.text ? 'On “' + safe(p.text) + '”: ' : ''}the useful distinction is between finding an update and knowing whether it needs action. ${record(p.source).quote ? 'The quote “' + safe(record(p.source).quote) + '” captures that friction, but one voice isn’t proof of demand.' : 'The sample points toward a digest, but it doesn’t establish demand on its own.'} I’d look for customers who prefer the existing workflow before committing to a build.\n\n` + chart(ctx.scope) };
      if (action.type === 'send') {
        const actions = Array.isArray(p.actions) ? p.actions : [], described = actions.map((item: any) => `${safe(item.text) || 'Untitled action'}${item.owner ? ' — ' + safe(item.owner) : ''}${item.due ? ', ' + safe(item.due) : ''}${item.done ? ' (complete)' : ''}`);
        return { text: actions.length ? `Here’s the ${actions.length === 1 ? '1 action' : actions.length + ' actions'} we’re carrying forward:\n\n${described.map((item: string) => '- ' + item).join('\n')}\n\nFor the digest test, I’d measure whether customers can name their next step faster—not just whether they like the concept. This stays here until you share it with the team.` : 'There aren’t any action items in that handoff yet. I’d start with one: test a daily digest with five customers and watch whether it makes their next step clearer.' };
      }
      if (action.type === 'select' || action.type === 'pivot') return { text: `${p.label || p.x ? 'For “' + safe(p.label || p.x) + '”, ' : 'For that selection, '}the interview quotes matter more than the bar height. A mention is a clue to investigate, not a vote or evidence of willingness to pay.` };
      return fallback('the research', action);
    },
  },
];
