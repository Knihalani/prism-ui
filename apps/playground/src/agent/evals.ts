export const evals = [
  { id: 'dashboard', prompt: 'Build a bespoke interactive team topology dashboard as an adaptive inline HTML artifact. Show six people connected across three projects, with clickable nodes to inspect their current work. No built-in covers this spatial view. Use host tokens and container queries.', anyOf: ['artifact'] },
  { id: 'custom-input', prompt: 'Build an adaptive inline HTML artifact for choosing a meeting room on a small floor plan. Clicking a room updates planning.room and a confirm button sends my choice to you. Use host tokens and container queries; this spatial input is not a standard form.', anyOf: ['artifact'] },
  { id: 'mockup', prompt: 'Mock up two landing-page design directions for a quiet team-planning app using mockup fences. Let me annotate them and give feedback. Keep the copy concise.', anyOf: ['mockup'] },
  { id: 'estimate', prompt: 'Budget a six-person team offsite with an editable estimate: travel, lunch and an optional workshop. Let me revise quantities and send my estimate back. Include contingency.', anyOf: ['estimate'] },
  { id: 'pick', prompt: 'Help me pick a laptop for coding and travel. Compare three options with weighted battery, portability and performance criteria. Let me choose.', anyOf: ['pick'] },
  { id: 'trip', prompt: 'Plan four days in Kyoto with tabs for each day. Ask for my pace and dietary preferences inline before refining the plan.', anyOf: ['tabs', 'ask'] },
  { id: 'troubleshoot', prompt: 'Help troubleshoot a failed deploy: npm run build exits with missing DATABASE_URL. Give me an interactive diagnostic flow, not an artifact, and safe commands.', anyOf: ['troubleshoot'] },
  { id: 'research', prompt: 'Summarize these customer research findings with a summary and chart: 8 of 12 wanted fewer status meetings, 6 wanted shared priorities, 3 wanted more notifications. Distinguish evidence from interpretation.', anyOf: ['summary', 'chart'] },
  { id: 'data-table', prompt: 'Use the dataTable component to compare six pilot expenses with sortable item, owner and cost columns: interviews 350, hosting 48, review 240, workshop 180, incentives 125, audit 320 dollars. Allow row selection.', anyOf: ['dataTable'] },
  { id: 'view', prompt: 'Use the view component to make a compact pricing calculator with billing-period choice, seat count, and a reactive total. Monthly price is $24 per seat; annual billing saves 20%.', anyOf: ['view'] },
] as const;
export type EvalId = typeof evals[number]['id'];
export interface RecordedEval { id: string; prompt: string; output: string; error?: string }
export interface EvalRecording { version: 1; provider: string; model: string; date: string; baseUrl?: string; systemPrompt?: string; records: RecordedEval[] }
