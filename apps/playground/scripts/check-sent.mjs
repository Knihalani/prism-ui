import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = process.env.BASE_URL || 'http://localhost:5174';
const shots = process.env.SHOTS_DIR;
if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.connectOverCDP(process.env.CDP_URL || 'http://localhost:29229');
const errors = [];
try {
  for (const mode of ['normal', 'reduced', 'disabled']) {
    const context = await browser.newContext({ viewport: { width: 824, height: 1100 }, reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' });
    try {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(`${base}/motion.html?only=estimate&instant=1`, { waitUntil: 'networkidle' });
      if (mode === 'disabled') await page.evaluate(async () => {
        const api = await import('/scripts/replay-entry.ts');
        const host = document.createElement('div'); host.style.width = '760px'; document.body.replaceChildren(host);
        const demo = api.demos.find(demo => demo.id === 'estimate');
        api.flushSync(() => api.createRoot(host).render(api.React.createElement(api.Prism, {
          source: api.demoSource(demo, 'disabled-estimate'), animate: false, plugins: api.playgroundPlugins,
          renderers: api.motionRenderers, locale: 'en-US', onAction() {}, middleware: [(action, next) => { setTimeout(() => next(action), 400); }],
        })));
      });
      await page.waitForTimeout(700);
      await page.evaluate(() => {
        const button = document.querySelector('[data-prism="estimate"][data-part="submit"]');
        const state = window.sentProbe = { widths: [], before: button.getBoundingClientRect().width, button, started: performance.now() };
        const sample = () => { state.widths.push(button.getBoundingClientRect().width); state.frame = requestAnimationFrame(sample); };
        sample();
      });
      await page.getByRole('button', { name: 'Use this estimate', exact: true }).click();
      const immediate = await page.getByRole('button', { name: 'Use this estimate', exact: true }).count();
      await page.waitForFunction(() => document.querySelector('[data-prism="estimate"][data-part="submit"][data-sent]'));
      const report = await page.evaluate(mode => {
        const state = window.sentProbe, path = state.button.querySelector('.prism-check-mark path');
        const animations = document.getAnimations().filter(animation => animation.effect?.target === path).map(animation => ({
          name: animation.animationName, properties: [...new Set(animation.effect.getKeyframes().flatMap(frame => Object.keys(frame)).filter(key => !['offset', 'computedOffset', 'easing', 'composite'].includes(key)))],
          frames: animation.effect.getKeyframes().map(frame => frame.strokeDashoffset), duration: animation.effect.getTiming().duration,
        }));
        return { mode, sentLabel: state.button.querySelector('span:last-child').textContent, receiptAfterMs: Math.round(performance.now() - state.started), checkAnimations: animations };
      }, mode);
      await page.waitForTimeout(700);
      const geometry = await page.evaluate(() => {
        const state = window.sentProbe; cancelAnimationFrame(state.frame);
        return { widthBefore: state.before, widthAfter: state.button.getBoundingClientRect().width, widthSpread: Math.max(...state.widths) - Math.min(...state.widths) };
      });
      assert.equal(immediate, 1); assert.equal(report.sentLabel, 'Sent');
      assert.ok(geometry.widthSpread < 0.5, JSON.stringify(geometry));
      if (mode === 'normal') assert.ok(report.checkAnimations.some(animation => animation.properties.includes('strokeDashoffset') && animation.frames[0] !== animation.frames.at(-1)));
      else assert.equal(report.checkAnimations.length, 0);
      if (shots) await page.screenshot({ path: `${shots}/estimate-${mode}-sent.png`, fullPage: true });
      console.log(JSON.stringify({ ...report, ...geometry }));
    } finally { await context.close(); }
  }
  assert.deepEqual(errors, []);
  console.log('Sent probe: estimate pending → sent, stable width, stroke-dashoffset draw, reduced/disabled opt-outs, 0 console/page errors');
} finally { await browser.close(); }
