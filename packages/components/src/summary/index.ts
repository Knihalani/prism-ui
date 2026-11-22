import { defineComponent, registerComponent } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { Summary, SummarySkeleton } from './summary';

export { Summary, useSummary } from './summary';
export type { SummaryProps, SummaryPoint, SummarySource, SummaryAction } from './summary';
export const summaryDef = defineComponent({
  name: 'summary', component: Summary, skeleton: SummarySkeleton, syntax: 'fence',
  schema: s.object({
    id: s.string().optional().describe('Stable identifier for checklist state'),
    title: s.string().optional().describe('Summary title'),
    points: s.array(s.object({
      text: s.string().default('').describe('Key takeaway'),
      source: s.object({ quote: s.string().optional().describe('Supporting quotation'), title: s.string().optional().describe('Source document title'), url: s.string().optional().describe('HTTP or HTTPS source URL') }).optional().describe('Evidence for this point'),
    })).optional().describe('Summary bullets with optional inline citations'),
    actions: s.array(s.object({ text: s.string().default('').describe('Action item'), owner: s.string().optional().describe('Person responsible'), due: s.string().optional().describe('Due date, preferably YYYY-MM-DD') })).optional().describe('Checklist of follow-up actions'),
  }),
  docs: 'Summarize findings with expandable source quotations and an undoable owner-assigned checklist. Send action items includes every action and its completion flag.',
  examples: ['```ui:summary\n{"id":"review","title":"Launch review","points":[{"text":"The launch is ready.","source":{"quote":"All checks passed.","title":"Readiness report","url":"https://example.com/report"}}],"actions":[{"text":"Schedule the launch","owner":"Maya Chen","due":"2027-01-15"}]}\n```'],
  message(action) {
    if (action.type === 'send') {
      const payload = action.payload as { actions: { text: string }[] };
      return 'Please send these ' + payload.actions.length + ' action items: ' + payload.actions.map(item => item.text).join('; ') + '.';
    }
    if (action.type === 'ask' && action.payload && typeof action.payload === 'object' && 'text' in action.payload) return 'Tell me more about this point: ' + String(action.payload.text);
    return 'Tell me more about this summary…';
  },
});
registerComponent(summaryDef);
