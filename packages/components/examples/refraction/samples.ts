const q = JSON.stringify;
const teams = [
  ['Northstar', 'Maya Chen', 8, 480, 'Ready'],
  ['Common Ground', 'Ellis Jones', 5, 300, 'Ready'],
  ['Daybreak', 'Noor Ali', 3, 180, 'Exploring'],
  ['Studio June', 'Sam Rivera', 7, 420, 'Ready'],
  ['Good Measure', 'Ari Patel', 2, 120, 'Exploring'],
  ['Evergreen', 'Lee Park', 6, 360, 'Ready'],
];
const table = {
  id: 'next-six',
  title: 'The next six teams',
  subtitle: 'People already making room for the work.',
  actionLabel: 'Invite selected',
  actionHint: 'A personal invitation, not a mailing list.',
  columns: [
    { key: 'name', label: 'Team', type: 'text' },
    { key: 'lead', label: 'Lead', type: 'text', detail: true },
    { key: 'sessions', label: 'Sessions', type: 'number', magnitude: true },
    { key: 'spend', label: 'Budget', type: 'currency', format: 'text', align: 'right' },
    { key: 'status', label: 'Status', type: 'text', detail: true, badge: true },
  ],
  rows: teams.map(([name, lead, sessions, spend, status]) => ({ name, lead, sessions, spend: `$${spend}`, status })),
  pageSize: 4,
  selectable: true,
};

const panels = [
  ['Before', 'Make it easy to say yes.',
    'Send one personal invitation. Share the question you’re exploring, why their perspective matters, and how little time you need.',
    'Choose one question worth fifteen minutes.', 'Leave room for a story you didn’t expect.', 'Ask permission before taking notes.'],
  ['During', 'Follow the last real example.',
    '“Tell me about the last time” is a better opening than “Would you use this?” Listen for the workaround, not just the wish.',
    'Ask what happened, step by step.', 'Notice where the energy changes.', 'Leave a little silence after the answer.'],
  ['After', 'Close the loop while it’s fresh.',
    'Write one observation in their words. Add what surprised you and the next small thing the team could try.',
    'Separate evidence from interpretation.', 'Thank the person, not just the participant.', 'Share one useful finding by Friday.'],
];

const cards = [
  ['20 minutes', 'Notice the friction', 'Watch a teammate try to find the last useful research note. Don’t help just yet.', 'Choose observation'],
  ['A good first step', 'Have one conversation', 'Invite someone who does the work. Ask about the last time context went missing.', 'Choose conversation'],
  ['45 minutes', 'Make the signal shared', 'Turn three scattered notes into one finding the whole team can act on.', 'Choose synthesis'],
];

export const samples = {
  'code-block': [
    '```ts {lines title="invite-pilot.ts" highlight="5-7"}',
    'import { Fieldnotes } from "@fieldnotes/sdk";',
    '',
    'const pilot = new Fieldnotes(process.env.API_KEY);',
    '',
    'await pilot.invitations.send({',
    '  cohort: "week-one",',
    '  idempotencyKey: "pilot-week-one",',
    '  message: "One question. Fifteen minutes. Your perspective.",',
    '  seats: 6,',
    '});',
    '```',
  ].join('\n'),
  'data-table': ['```ui:table', q(table), '```'].join('\n'),
  callout: ':::callout{tone=tip}\nStart with a question.\n:::',
  tabs: [
    '::::tabs{title="A conversation, not a questionnaire" label="Interview guide"}',
    ...panels.map(([label, title, body, ...items]) => [
      `:::tab{label=${q(label)}}`, `### ${title}`, '', body, '',
      ...items.map(item => `- ${item}`), ':::',
    ].join('\n')),
    '::::',
  ].join('\n'),
  'card-grid': [
    '::::grid{cols=3 title="Three ways to move the work forward" meta="One afternoon"}',
    ...cards.map(([badge, title, body, action]) => [
      `:::card{title=${q(title)} badge=${q(badge)} action=${q(action + ' →')} actionVariant=quiet}`,
      body,
      ':::',
    ].join('\n')),
    '::::',
  ].join('\n'),
};
