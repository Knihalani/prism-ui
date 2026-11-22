import manrope from '../public/fonts/manrope-latin.woff2?inline';
import inter from '../public/fonts/inter-latin.woff2?inline';

const common = `<style>
@font-face{font-family:"Shell Manrope";src:url("${manrope}") format("woff2");font-weight:200 800;font-display:swap}
@font-face{font-family:"Shell Inter";src:url("${inter}") format("woff2");font-weight:100 900;font-display:swap}
main{animation:artifact-arrive var(--prism-motion-base,240ms) var(--prism-motion-ease,ease-out) both}
@keyframes artifact-arrive{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
[data-reduced-motion] main{animation:none}
@media(prefers-reduced-motion:reduce){main{animation:none}}
body{font:inherit;line-height:1.5;color:var(--prism-text)}main{padding:16px 0}h2{font-size:clamp(18px,5cqi,28px);letter-spacing:-.035em;margin:0 0 6px}p{margin:0;color:var(--prism-text-muted)}small{font-size:clamp(11px,2.5cqi,12px);color:var(--prism-text-muted)}button{font:inherit;border:1px solid var(--prism-border);background:transparent;color:inherit;border-radius:var(--prism-radius-sm);padding:8px 12px;cursor:pointer}button:focus-visible{outline:2px solid var(--prism-focus)}button[aria-pressed=true]{background:var(--prism-accent);color:var(--prism-on-accent);border-color:transparent}strong{font-variant-numeric:tabular-nums} @container(min-width:520px){main{padding-block:20px}h2{font-size:28px}}
</style>`;
const dashboard = common + `<main><small>WORKSPACE / THIS WEEK</small><h2>A little more momentum.</h2><p>A snapshot of your team’s week.</p>
<style>.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:18px}.stat{padding-block:10px;border-top:1px solid var(--prism-border)}.stat>small{display:block}.stat>small:first-child{min-height:2.8em;line-height:1.4}.stat strong{display:block;font-size:clamp(24px,6cqi,36px);line-height:1.3;margin-block:4px;letter-spacing:-.05em}.chart{display:flex;align-items:end;gap:8px;height:80px;margin-block:16px 10px}.bar{flex:1;transform-origin:bottom;animation:artifact-bar var(--prism-motion-slow,400ms) var(--prism-motion-ease,ease-out) both;border-radius:4px 4px 0 0;background:color-mix(in srgb,var(--prism-accent) 28%,transparent)}.bar:last-child{background:var(--prism-accent)}.caption{display:flex;justify-content:space-between;gap:8px;font-size:clamp(10px,2.5cqi,12px);color:var(--prism-text-muted)}@keyframes artifact-bar{from{transform:scaleY(.15);opacity:.3}to{transform:scaleY(1);opacity:1}}[data-reduced-motion] .bar{animation:none}@media(prefers-reduced-motion:reduce){.bar{animation:none}}@container(min-width:520px){.stat>small:first-child{min-height:1.4em}.stats{grid-template-columns:repeat(3,minmax(0,1fr))}.chart{height:142px;gap:14px}}</style>
<div class="stats"><div class="stat"><small>Projects shipped</small><strong>12</strong><small>↑ 3 from last week</small></div><div class="stat"><small>Focus hours</small><strong>86.5</strong><small>Across your team</small></div><div class="stat"><small>Open decisions</small><strong>4</strong><small>Ready when you are</small></div></div>
<div class="chart" aria-label="Team activity increased through Friday">${[32, 64, 48, 79, 60, 88, 100].map(n => `<div class="bar" style="height:${n}%"></div>`).join('')}</div><div class="caption"><span>Monday</span><span>Team activity · +24%</span><span>Sunday</span></div></main>`;
const input = common + `<main><small>YOUR CALL</small><h2>What should we tackle first?</h2><p>Place the next idea by impact and effort.</p><style>.matrix{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:20px}.matrix button{min-height:42px;aspect-ratio:1.5;font-size:clamp(11px,3cqi,13px);line-height:1.3;padding:6px 4px;transition:background var(--prism-motion-fast,140ms),border-color var(--prism-motion-fast,140ms)}.matrix button:hover{border-color:var(--prism-accent)}.axis{display:flex;justify-content:space-between;font-size:12px;margin-top:8px;color:var(--prism-text-muted)}output{display:block;margin-top:16px;font-size:14px}@container(min-width:520px){.matrix button{aspect-ratio:3.2}}</style>
<div class="matrix" role="group" aria-label="Priority and effort">${['Quick win', 'Worth a look', 'Big bet', 'Small lift', 'Steady work', 'Plan ahead', 'Nice to have', 'Later', 'Not now'].map((label, i) => `<button data-index="${i}" aria-pressed="false">${label}</button>`).join('')}</div><div class="axis"><span>← Less effort</span><span>More effort →</span></div><output aria-live="polite">Choose a position.</output></main><script>
const buttons=[...document.querySelectorAll('.matrix button')];
function update(value){buttons.forEach((button,index)=>button.setAttribute('aria-pressed',String(index===value?.index)));document.querySelector('output').textContent=value?'Selected: '+value.label:'Choose a position.'}
update(prism.state.get('planning.selection'));prism.state.subscribe('planning.selection',update);
buttons.forEach((button,index)=>button.onclick=()=>{const value={index,label:button.textContent,effort:index%3,impact:2-Math.floor(index/3)};prism.state.set('planning.selection',value);prism.emit('select',value);update(value)});
</script>`;
const fence = (id: string, source: string) => '```artifact:html {id=' + id + ' height=auto}\n' + source + '\n```';
export const agentSource = 'Here’s your team’s week at a glance. Choose where to focus next.\n\n' + fence('adaptive-dashboard', dashboard) + '\n\nLet’s turn that into a decision.\n\n' + fence('adaptive-input', input);
export const adaptiveArtifactOptions = { statePaths: ['planning'] };

export function scopedAgentSource(scope: string) {
  return agentSource.replaceAll('{id=adaptive-', '{id=' + scope + '-adaptive-');
}
