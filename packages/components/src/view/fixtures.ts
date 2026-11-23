/** Realistic `ui:view` sources used as test fixtures, playground demos and screenshots. */
const fence = (value: unknown) => '```ui:view\n' + JSON.stringify(value, null, 1) + '\n```';

export const dashboard = {
  id: 'revenue', title: 'Revenue · last 30 days',
  state: { range: '30d', series: [{ label: 'Wk 1', mrr: 38200 }, { label: 'Wk 2', mrr: 40100 }, { label: 'Wk 3', mrr: 41900 }, { label: 'Wk 4', mrr: 44700 }] },
  children: [
    { type: 'row', justify: 'between', align: 'center', children: [
      { type: 'heading', text: '$44.7k MRR', subtitle: 'Up from $38.2k four weeks ago', level: 2 },
      { type: 'segmented', value: { $bind: 'range' }, options: [{ value: '7d', label: '7D' }, { value: '30d', label: '30D' }, { value: '90d', label: '90D' }] },
    ] },
    { type: 'grid', cols: 4, children: [
      { type: 'stat', label: 'MRR', value: 44700, format: 'currency:USD', delta: 0.081, icon: 'dollar' },
      { type: 'stat', label: 'Active seats', value: 1284, delta: 0.042, icon: 'users' },
      { type: 'stat', label: 'Churn', value: 0.018, format: 'percent:1', delta: -0.004, deltaFormat: 'percent:1', invert: true, icon: 'trending-down' },
      { type: 'stat', label: 'NPS', value: 61, delta: 3, deltaFormat: 'integer', hint: 'vs last month', icon: 'star' },
    ] },
    { type: 'chart', kind: 'area', title: 'Weekly MRR (USD)', data: { $ref: 'series' }, x: 'label', series: [{ key: 'mrr', label: 'MRR' }], format: 'compact' },
    { type: 'table', columns: [{ key: 'plan', label: 'Plan' }, { key: 'accounts', label: 'Accounts', align: 'end' }, { key: 'mrr', label: 'MRR', align: 'end', format: 'currency' }, { key: 'growth', label: 'Growth', align: 'end', format: 'percent' }],
      rows: [{ plan: 'Enterprise', accounts: 42, mrr: 21800, growth: 0.12 }, { plan: 'Team', accounts: 318, mrr: 16900, growth: 0.06 }, { plan: 'Starter', accounts: 924, mrr: 6000, growth: -0.02 }] },
  ],
};
export const settings = {
  id: 'prefs', title: 'Notification settings',
  state: { email: true, digest: 'weekly', quiet: false, quietFrom: '22:00', volume: 60, name: 'Ada Lovelace' },
  children: [
    { type: 'input', label: 'Display name', value: { $bind: 'name' }, placeholder: 'Your name' },
    { type: 'divider' },
    { type: 'toggle', label: 'Email notifications', description: 'Mentions, assignments and replies', value: { $bind: 'email' } },
    { type: 'select', label: 'Digest', value: { $bind: 'digest' }, when: 'email', options: [{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'never', label: 'Never' }] },
    { type: 'toggle', label: 'Quiet hours', description: 'Pause push notifications overnight', value: { $bind: 'quiet' } },
    { type: 'input', label: 'Starting at', inputType: 'time', value: { $bind: 'quietFrom' }, when: 'quiet' },
    { type: 'slider', label: 'Sound volume', value: { $bind: 'volume' }, min: 0, max: 100, step: 5, unit: '%' },
  ],
  actions: [{ type: 'button', label: 'Save preferences', variant: 'primary', icon: 'check', onClick: { action: 'save', payload: { name: { $ref: 'name' }, email: { $ref: 'email' }, digest: { $ref: 'digest' }, quiet: { $ref: 'quiet' }, quietFrom: { $ref: 'quietFrom' }, volume: { $ref: 'volume' } } } }],
};
export const pricing = {
  id: 'pricing', title: 'Choose a plan',
  state: { annual: true, plan: 'pro', seats: 5 },
  children: [
    { type: 'row', justify: 'between', align: 'center', wrap: true, children: [
      { type: 'segmented', value: { $bind: 'annual' }, options: [{ value: false, label: 'Monthly' }, { value: true, label: 'Annual', hint: '−20%' }] },
      { type: 'slider', label: 'Seats', value: { $bind: 'seats' }, min: 1, max: 50, width: 'third' },
    ] },
    { type: 'grid', cols: 3, children: [
      { type: 'card', title: 'Starter', subtitle: 'For individuals', selected: "plan == 'starter'", onClick: { set: { plan: 'starter' } }, children: [
        { type: 'heading', level: 1, text: '{{ annual ? 8 : 10 | currency }}', subtitle: 'per seat / month' },
        { type: 'text', text: '✓ 3 projects\n✓ Community support', tone: 'muted', size: 'sm' } ] },
      { type: 'card', title: 'Pro', subtitle: 'For growing teams', badge: 'Popular', selected: "plan == 'pro'", onClick: { set: { plan: 'pro' } }, children: [
        { type: 'heading', level: 1, text: '{{ annual ? 16 : 20 | currency }}', subtitle: 'per seat / month' },
        { type: 'text', text: '✓ Unlimited projects\n✓ Priority support', tone: 'muted', size: 'sm' } ] },
      { type: 'card', title: 'Enterprise', subtitle: 'Security & scale', selected: "plan == 'enterprise'", onClick: { set: { plan: 'enterprise' } }, children: [
        { type: 'heading', level: 1, text: '{{ annual ? 40 : 50 | currency }}', subtitle: 'per seat / month' },
        { type: 'text', text: '✓ SSO & audit log\n✓ Dedicated CSM', tone: 'muted', size: 'sm' } ] },
    ] },
    { type: 'row', justify: 'between', align: 'center', children: [
      { type: 'text', text: '**{{ seats }} seats** · billed {{ annual ? \'yearly\' : \'monthly\' }}', tone: 'muted' },
      { type: 'stat', label: 'Total per month', value: { $calc: "seats * if(plan == 'starter', 10, if(plan == 'pro', 20, 50)) * if(annual, 0.8, 1)" }, format: 'currency', align: 'end' },
    ] },
  ],
  actions: [{ type: 'button', label: 'Continue with {{ plan | upper }}', variant: 'primary', iconRight: 'arrow-right', onClick: { action: 'choose_plan', payload: { plan: { $ref: 'plan' }, annual: { $ref: 'annual' }, seats: { $ref: 'seats' } } } }],
};
export const booking = {
  id: 'booking', title: 'Book a table at Lumière',
  state: { day: 'Fri 14', time: '19:30', guests: 2, notes: '' },
  children: [
    { type: 'row', gap: 3, align: 'center', children: [
      { type: 'avatar', name: 'Lumière Bistro', size: 'lg' },
      { type: 'stack', gap: 1, grow: true, children: [{ type: 'text', text: '**Lumière Bistro** · French · $$$' }, { type: 'row', gap: 2, children: [{ type: 'badge', text: '4.8', icon: 'star', tone: 'warning' }, { type: 'badge', text: '12 Rue Oberkampf', icon: 'map-pin' }] }] },
    ] },
    { type: 'segmented', label: 'Day', value: { $bind: 'day' }, options: ['Thu 13', 'Fri 14', 'Sat 15', 'Sun 16'] },
    { type: 'segmented', label: 'Time', value: { $bind: 'time' }, options: ['18:00', '18:30', '19:30', '20:00', '21:15'] },
    { type: 'slider', label: 'Guests', value: { $bind: 'guests' }, min: 1, max: 8, unit: 'guests' },
    { type: 'input', label: 'Special requests', value: { $bind: 'notes' }, placeholder: 'Allergies, celebrations…', multiline: true, rows: 2 },
    { type: 'box', variant: 'soft', pad: 3, children: [{ type: 'row', gap: 2, align: 'center', children: [{ type: 'icon', name: 'calendar', tone: 'accent' }, { type: 'text', text: '{{ day }} at **{{ time }}** for {{ guests }} {{ guests == 1 ? \'guest\' : \'guests\' }}' }] }] },
  ],
  actions: [{ type: 'button', label: 'Reserve', variant: 'primary', icon: 'check', onClick: { action: 'book', payload: { day: { $ref: 'day' }, time: { $ref: 'time' }, guests: { $ref: 'guests' }, notes: { $ref: 'notes' } } } }],
};
export const todos = {
  id: 'launch', title: 'Launch checklist',
  state: { draft: '', show: 'all', items: [{ id: 'a', text: 'Freeze the release branch', done: true }, { id: 'b', text: 'Run the smoke suite on staging', done: false }, { id: 'c', text: 'Draft the changelog', done: false }] },
  children: [
    { type: 'progress', label: '{{ sum(items.*.done) }} of {{ items.length }} done', value: { $calc: 'sum(items.*.done) / max(items.length, 1)' }, tone: 'success' },
    { type: 'row', gap: 2, children: [
      { type: 'input', value: { $bind: 'draft' }, placeholder: 'Add a task and press Enter', grow: true, onSubmit: { push: { items: { text: { $ref: 'draft' }, done: false } }, set: { draft: '' } } },
      { type: 'button', icon: 'plus', label: 'Add', disabled: "draft == ''", onClick: { push: { items: { text: { $ref: 'draft' }, done: false } }, set: { draft: '' } } },
    ] },
    { type: 'tabs', value: { $bind: 'show' }, tabs: [
      { label: 'All', value: 'all', badge: '{{ items.length }}', children: [{ type: 'list', each: 'items', divided: true, empty: 'No tasks yet', item: { type: 'row', align: 'center', children: [
        { type: 'checkbox', label: '{{ $item.text }}', value: { $bind: '$item.done' }, strike: true, grow: true },
        { type: 'button', icon: 'trash', variant: 'ghost', size: 'sm', ariaLabel: 'Remove', onClick: { remove: '$item' } } ] } }] },
      { label: 'Open', value: 'open', badge: '{{ items.length - sum(items.*.done) }}', children: [{ type: 'list', each: 'items', filter: '!$item.done', divided: true, empty: 'All done 🎉', item: { type: 'checkbox', label: '{{ $item.text }}', value: { $bind: '$item.done' } } }] },
    ] },
  ],
  actions: [{ type: 'button', label: 'Send status', variant: 'primary', onClick: { action: 'status', payload: { items: { $ref: 'items' } } } }],
};
export const comparison = {
  id: 'phones', title: 'Pixel 9 vs iPhone 16',
  state: { pick: '' },
  children: [
    { type: 'grid', cols: 2, children: [
      { type: 'card', title: 'Pixel 9 Pro', subtitle: '$999 · 221 g', icon: 'sparkles', selected: "pick == 'pixel'", onClick: { set: { pick: 'pixel' } }, children: [
        { type: 'progress', label: 'Camera', value: 0.94 }, { type: 'progress', label: 'Battery', value: 0.82 }, { type: 'progress', label: 'Value', value: 0.76 }] },
      { type: 'card', title: 'iPhone 16 Pro', subtitle: '$999 · 199 g', icon: 'zap', selected: "pick == 'iphone'", onClick: { set: { pick: 'iphone' } }, children: [
        { type: 'progress', label: 'Camera', value: 0.92 }, { type: 'progress', label: 'Battery', value: 0.88 }, { type: 'progress', label: 'Value', value: 0.71 }] },
    ] },
    { type: 'table', sortable: false, columns: [{ key: 'spec', label: 'Spec' }, { key: 'pixel', label: 'Pixel 9 Pro' }, { key: 'iphone', label: 'iPhone 16 Pro' }], rows: [
      { spec: 'Display', pixel: '6.3″ 120 Hz LTPO', iphone: '6.3″ 120 Hz ProMotion' },
      { spec: 'Zoom', pixel: '**5×** optical', iphone: '**5×** optical' },
      { spec: 'Updates', pixel: '**7 years**', iphone: '~6 years' },
      { spec: 'Wireless charging', pixel: true, iphone: true },
      { spec: 'Satellite SOS', pixel: true, iphone: true },
    ] },
    { type: 'text', when: "pick != ''", text: 'You picked **{{ pick == \'pixel\' ? \'Pixel 9 Pro\' : \'iPhone 16 Pro\' }}**', tone: 'accent' },
  ],
  actions: [{ type: 'button', label: 'Go with this one', variant: 'primary', disabled: "pick == ''", onClick: { action: 'pick', payload: { pick: { $ref: 'pick' } } } }],
};
export const views = { dashboard, settings, pricing, booking, todos, comparison };
export const gallery = /* @__PURE__ */ (() => Object.fromEntries(Object.entries(views).map(([name, value]) => [name, fence(value)])))() as Record<keyof typeof views, string>;
