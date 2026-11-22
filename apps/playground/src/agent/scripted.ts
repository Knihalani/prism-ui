import { demos, demoSource, replyFor } from '../catalogue';
import { realistic, streamText, type Pace } from './pace';
import { scenarios, type Scenario } from './scenarios';
import type { Agent, AgentEvent, Reply } from './types';

export type Route = { kind: 'scenario'; scenario: Scenario } | { kind: 'gallery'; demo: typeof demos[number] } | { kind: 'fallback' };
export function routeMessage(text: string): Route {
  const requestedDemo = demos.find(demo => text.trim() === 'gallery:' + demo.id || text.trim() === demo.id);
  if (requestedDemo) return { kind: 'gallery', demo: requestedDemo };
  const query = text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim();
  if (!query) return { kind: 'fallback' };
  let best: Scenario | undefined, score = 0;
  for (const scenario of scenarios) {
    const keywords = scenario.keywords.reduce((sum, word) => sum + (query.includes(word) ? word.split(' ').length * 3 : 0), 0);
    const title = scenario.prompt.toLowerCase().split(/\W+/).filter(word => word.length > 3 && query.split(/\W+/).includes(word)).length;
    if (keywords && keywords + title > score) { best = scenario; score = keywords + title; }
  }
  if (best) return { kind: 'scenario', scenario: best };
  const demo = replyFor(text);
  return demo ? { kind: 'gallery', demo } : { kind: 'fallback' };
}
const fallback: Reply = { text: 'I can help you choose a laptop, plan four days in Kyoto, debug a deploy, design a landing page, budget a team offsite, or synthesize customer research. Pick a starting point, or ask to explore a component from the gallery.' };
export function createScriptedAgent({ pace = realistic }: { pace?: Pace } = {}): Agent {
  const session = crypto.randomUUID().replaceAll('-', '');
  let turn = 0, active: { scenario: Scenario; scope: string } | undefined;
  const owners = new Map<string, { scenario: Scenario; scope: string }>();
  return {
    id: 'scripted', label: 'Prism guide',
    async *respond(input, signal): AsyncIterable<AgentEvent> {
      if (signal.aborted || (input.kind === 'action' && input.action.type === 'copy')) return;
      if (!input.history.length && input.kind === 'message') { active = undefined; owners.clear(); }
      const scope = 's' + session + 't' + ++turn;
      let reply: Reply | undefined, title: string | undefined;
      if (input.kind === 'action') {
        const owner = [...owners.values()].find(item => input.action.id.startsWith(item.scope + '-') || input.action.id.startsWith(item.scope + '.'));
        if (owner) {
          active = owner;
          reply = owner.scenario.onAction(input.action, { scope, ownerScope: owner.scope, history: input.history });
          owners.set(scope, { scenario: owner.scenario, scope });
        } else reply = { text: 'I’ve noted that update. What would you like to change next?' };
      } else {
        const route = routeMessage(input.text);
        const switching = route.kind === 'scenario' && route.scenario.id !== active?.scenario.id;
        const gallery = route.kind === 'gallery' && (input.text.trim().startsWith('gallery:') || input.text.trim() === route.demo.id);
        if (!switching && !gallery) reply = active?.scenario.onMessage?.(input.text, { scope, ownerScope: active.scope, history: input.history });
        if (reply && active) owners.set(scope, { scenario: active.scenario, scope });
        if (!reply) {
          if (route.kind === 'scenario') {
            active = { scenario: route.scenario, scope }; owners.set(scope, active);
            title = route.scenario.title; reply = { text: route.scenario.opening(scope) };
          } else if (route.kind === 'gallery') { reply = { text: demoSource(route.demo, scope) }; title = route.demo.label; }
          else reply = fallback;
        }
      }
      if (!reply || signal.aborted) return;
      yield { type: 'thinking' };
      if (title) yield { type: 'title', title };
      for await (const delta of streamText(reply.text, signal, pace)) yield { type: 'text', delta };
      if (!signal.aborted && reply.patch) yield { type: 'patch', patch: reply.patch };
    },
  };
}
