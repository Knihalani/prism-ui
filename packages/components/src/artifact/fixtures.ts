const reactStyle = `<style>{\`
  main{padding:24px}section{max-width:610px;margin:auto}h2,p{margin:0}
  h2{font-size:26px;letter-spacing:-.045em}small, label,p{color:var(--prism-muted)}
  .bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
  .tag{border:1px solid var(--prism-border);border-radius:30px;padding:5px 10px;font-size:11px}
  .stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .stat{display:grid;gap:8px;border:1px solid var(--prism-border);padding:12px;border-radius:var(--prism-radius-md);background:var(--prism-bg)}
  output,b{font-size:23px;letter-spacing:-.035em;font-variant-numeric:tabular-nums}
  input{width:100%;accent-color:var(--prism-accent);margin:8px 0}button{border:0;border-radius:var(--prism-radius-sm);padding:8px 12px;color:var(--prism-surface);background:var(--prism-accent);cursor:pointer}
\`}</style>`;

export const calculator = `import { useState } from 'react';
const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
export default function Calculator() {
  const [months, setMonths] = useState(36);
  const amount = 24000, rate = .065/12;
  const payment = amount * rate / (1 - (1 + rate) ** -months);
  return <><section>
    <div className="bar"><div><small>FINANCING</small><h2>Loan calculator</h2></div><span className="tag">6.5% APR</span></div>
    <div className="stats"><div className="stat"><small>Monthly payment</small><output>{money(payment)}</output></div>
    <div className="stat"><small>Lifetime interest</small><b>{money(payment * months - amount)}</b></div></div>
    <label htmlFor="term">Term: {months} months</label>
    <input id="term" type="range" min="12" max="72" step="6" value={months} onChange={e=>setMonths(+e.target.value)} />
    <button onClick={()=>window.prism.send('use-financing',{months, amount, apr: .065})}>Use this term</button>
  </section>${reactStyle}</>;
}`;

export const dashboard = `import { useSyncExternalStore } from 'react';
const path = 'monthlyBudget';
const state = window.prism.state;
const currency = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
export default function Dashboard() {
  const budget = useSyncExternalStore(state.subscribe.bind(null,path), () => state.get(path) ?? 1600);
  const paid = 980, remaining = budget - paid;
  return <><section>
    <div className="bar"><div><small>PERSONAL FINANCE</small><h2>September spending</h2></div><span className="tag">Current month</span></div>
    <div className="stats"><div className="stat"><small>Monthly budget</small><output>{currency(budget)}</output></div>
      <div className="stat"><small>Left to spend</small><b>{currency(remaining)}</b></div></div>
    <p style={{margin:'12px 0'}}>{Math.round(paid / budget * 100)}% of budget used</p>
    <button onClick={()=>state.set(path, budget + 100)}>Add $100 to budget</button>
  </section>${reactStyle}</>;
}`;

export const landing = `<!doctype html><html><head><style>
  body{padding:24px 30px;background:linear-gradient(115deg,#10152c,#29244b);color:#f2edff}
  header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;color:#c7bdea;font-size:13px}
  h1{font-size:clamp(30px,6vw,62px);letter-spacing:-.075em;line-height:.95;max-width:9em;margin:0}
  p{color:#d2c9ee;font-size:14px}button{border:0;padding:9px 14px;border-radius:7px;background:#d2bdff;color:#211941;font-weight:650;cursor:pointer}
  small{color:#d1bfed;margin-left:9px}
</style></head><body>
  <header><b>◉ Orbit Studio</b><span>Field notes / 01</span></header>
  <h1>Make room for better ideas.</h1>
  <p>A quiet workspace for your most ambitious projects.</p>
  <button id="access">Request access</button><small id="confirmation"></small>
  <script>document.getElementById('access').onclick = () => {
    document.getElementById('confirmation').textContent = 'You’re on the list.';
    prism.send('request-access',{ product: 'Orbit Studio' });
  };</script>
</body></html>`;

export const infographic = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 260" role="img" aria-label="Clean energy shares by source: wind 42%, solar 31%, hydro 19%, other 8%">
  <rect width="660" height="260" fill="var(--prism-surface)" />
  <g font-family="system-ui,sans-serif" fill="var(--prism-text)">
    <text x="27" y="31" font-size="12" letter-spacing="2" fill="var(--prism-muted)">REGIONAL POWER MIX · 2025</text>
    <text x="26" y="65" font-size="31" font-weight="710" letter-spacing="-1">Where clean power comes from</text>
    <g font-size="15">
      <text x="28" y="112">Wind</text><rect x="112" y="97" width="383" height="19" rx="5" fill="var(--prism-accent)"/><text x="509" y="112">42%</text>
      <text x="28" y="153">Solar</text><rect x="112" y="138" width="283" height="19" rx="5" fill="var(--prism-success)"/><text x="409" y="153">31%</text>
      <text x="28" y="194">Hydro</text><rect x="112" y="179" width="173" height="19" rx="5" fill="var(--prism-info)"/><text x="299" y="194">19%</text>
      <text x="28" y="235">Other</text><rect x="112" y="220" width="73" height="19" rx="5" fill="var(--prism-muted)"/><text x="199" y="235">8%</text>
    </g>
  </g>
</svg>`;

export const canvasGame = `const root = document.querySelector('#app');
root.innerHTML = '<section style="padding:16px 24px"><header style="display:flex;justify-content:space-between;align-items:center"><div><b>Moonhop</b><p style="margin:4px 0 8px;color:var(--prism-muted)">Collect the stars before you run out of hops.</p></div><button type="button">New game</button></header><canvas width="580" height="150" tabindex="0" aria-label="Moonhop game; arrow keys to move" style="display:block;max-width:100%;border-radius:10px"></canvas><p role="status" style="margin:8px 0 0">0 of 5 stars collected</p></section>';
const canvas = root.querySelector('canvas'), ctx = canvas.getContext('2d'), status = root.querySelector('[role=status]');
const stars = [1, 4, 6, 9, 11];
let cursor, collected, hops;
function draw() {
  ctx.fillStyle='#161d35';ctx.fillRect(0,0,580,150);
  ctx.fillStyle='#293658';
  for(let n=0;n<12;n++)ctx.fillRect(15+n*47,116,33,3);
  ctx.font='24px system-ui';ctx.fillStyle='#ffe18a';
  for(const star of stars)if(!collected.has(star))ctx.fillText('✦',18+star*47,95);
  ctx.fillStyle='#bfa8ff';ctx.beginPath();ctx.arc(31+cursor*47,96,11,0,Math.PI*2);ctx.fill();
  ctx.font='13px system-ui';ctx.fillStyle='#d5dcf4';ctx.fillText(hops+' hops left',18,24);
  status.textContent=collected.size+' of 5 stars collected';
}
function reset() { cursor=0;collected=new Set();hops=16;draw(); }
root.querySelector('button').onclick=()=>{reset();canvas.focus();};
function step(direction) {
  if(!hops || collected.size===5)return;
  cursor=Math.max(0, Math.min(11, cursor+direction)); hops--;
  if(stars.includes(cursor))collected.add(cursor); draw();
  if(!hops || collected.size===5)prism.send('game-result',{stars:collected.size,hops});
}
canvas.onkeydown=event=>{ if(event.key==='ArrowLeft'||event.key==='ArrowRight'){ event.preventDefault();step(event.key==='ArrowLeft'?-1:1); } };
canvas.onclick=event=>step(event.offsetX<canvas.clientWidth/2?-1:1);
reset();`;

export const markdown = `# Setup notes

Check these points before publishing the **September report**:

- [x] Reconcile the ledger
- [x] Review the forecast with Finance
- [ ] Publish a read-only copy

> Leave the editable original in the shared workspace.`;

export const fence = (kind: string, meta: string, source: string) => '```artifact:' + kind + ' {' + meta + '}\n' + source + '\n```\n';
export const fixtureSources = [
  fence('react', 'title="Loan calculator" id=loan height=290', calculator),
  fence('js', 'title="Moonhop" height=260', canvasGame),
  fence('html', 'title="Orbit Studio" height=290', landing),
  fence('svg', 'title="Clean power mix" height=310', infographic),
  'Adjust the monthly budget in this reply: :num[1600]{id=monthlyBudget min=500 max=5000 step=100 format=currency}\n\n' +
    fence('react', 'title="September dashboard" id=dashboard height=280', dashboard),
  fence('markdown', 'title="Launch checklist" size=sm', markdown),
];
