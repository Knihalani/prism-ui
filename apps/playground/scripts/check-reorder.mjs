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
      for (const demo of ['pick', 'table']) {
        await page.goto(`${base}/motion.html?only=${demo}&instant=1`, { waitUntil: 'networkidle' });
        await page.evaluate(async ({ demo, mode }) => {
          const api = await import('/scripts/replay-entry.ts');
          const host = document.createElement('div'); host.style.width = '760px'; document.body.replaceChildren(host);
          const entry = api.demos.find(entry => entry.id === demo);
          let source = api.demoSource(entry, `reorder-${demo}`);
          if (demo === 'table') source = source.replace('"pageSize":4', '"pageSize":10');
          api.flushSync(() => api.createRoot(host).render(api.React.createElement(api.Prism, { source, animate: mode !== 'disabled', plugins: api.playgroundPlugins, renderers: api.motionRenderers, locale: 'en-US' })));
          window.reorderProbe = { selector: demo === 'pick' ? '.prism-pick__item' : '.prism-datatable__row' };
          window.reorderProbe.nodes = [...document.querySelectorAll(window.reorderProbe.selector)];
        }, { demo, mode });
        const initial = await page.evaluate(() => document.getAnimations().filter(a => window.reorderProbe.nodes.includes(a.effect?.target) && a.transitionProperty === 'opacity').length);
        if (mode !== 'disabled') assert(initial > 0, `${demo}: first appearance must still enter`);
        await page.waitForFunction(() => document.getAnimations().every(a => a.effect?.getTiming().iterations === Infinity || a.playState === 'finished'));
        await page.evaluate(() => {
          window.reorderProbe.before = window.reorderProbe.nodes.map(node => node.getAttribute('data-option') ?? node.getAttribute('data-index'));
        });
        for (const pass of ['reorder', 'interrupt']) {
          if (mode === 'normal' && pass === 'interrupt') await page.waitForFunction(() => document.getAnimations().some(a => window.reorderProbe.nodes.includes(a.effect?.target) && a.effect.getKeyframes().some(frame => frame.transform !== undefined) && a.currentTime >= 80 && a.playState === 'running'));
          const result = await page.evaluate(async ({ demo, mode, pass }) => {
            const { selector, nodes, before } = window.reorderProbe;
            const previousTransforms = document.getAnimations().filter(a => nodes.includes(a.effect?.target) && a.effect.getKeyframes().some(frame => frame.transform !== undefined)).length;
            const criterion = pass === 'reorder' ? 'Reach,' : 'Learning,';
            const button = demo === 'pick' ? [...document.querySelectorAll('.prism-pick__chip')].find(node => node.getAttribute('aria-label')?.startsWith(criterion)) : [...document.querySelectorAll('.prism-datatable__sort')].find(node => node.textContent.includes('Cost'));
            button.click();
            await new Promise(requestAnimationFrame);
            await new Promise(requestAnimationFrame);
            const animations = document.getAnimations().filter(a => nodes.includes(a.effect?.target));
            const transforms = animations.filter(a => a.effect.getKeyframes().some(frame => frame.transform !== undefined));
            const opacity = animations.filter(a => a.effect.getKeyframes().some(frame => frame.opacity !== undefined));
            const reenter = animations.filter(a => ['opacity', 'filter', 'translate'].includes(a.transitionProperty));
            const current = [...document.querySelectorAll(selector)];
            return {
              demo, mode, pass, previousTransforms, sameNodes: current.length === nodes.length && current.every(node => nodes.includes(node)),
              before, after: current.map(node => node.getAttribute('data-option') ?? node.getAttribute('data-index')),
              transformAnimations: transforms.length, opacityAnimations: opacity.length, streamingReenter: reenter.length,
              frames: transforms.map(a => a.effect.getKeyframes().map(({ transform }) => transform)),
            };
          }, { demo, mode, pass });
          console.log(JSON.stringify({ ...result, initialEntryOpacity: initial }));
          assert(result.sameNodes, `${demo}: reorder must preserve keyed nodes`);
          assert.equal(result.opacityAnimations, 0, `${demo}: opacity must not re-enter`);
          assert.equal(result.streamingReenter, 0, `${demo}: streaming entry must not replay`);
          if (mode === 'normal') assert(result.transformAnimations > 0, `${demo}: FLIP must animate transform`);
          else assert.equal(result.transformAnimations, 0, `${demo}/${mode}: FLIP must not animate`);
          if (mode === 'normal' && pass === 'interrupt') assert(result.previousTransforms > 0, `${demo}: interruption must happen in flight`);
          if (pass === 'reorder') assert.notDeepEqual(result.after, result.before, `${demo}: interaction must actually reorder`);
          if (shots && mode === 'normal' && pass === 'interrupt') await page.screenshot({ path: `${shots}/${demo}-reorder.png`, fullPage: true });
        }
      }
    } finally { await context.close(); }
  }
  assert.deepEqual(errors, []);
  console.log('Reorder probe: pick + datatable, normal/reduced/disabled, initial entry + reorder + interruption, 0 violations, 0 console/page errors');
} finally { await browser.close(); }
