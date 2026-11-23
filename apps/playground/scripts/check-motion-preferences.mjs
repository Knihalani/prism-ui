import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP(process.env.CDP_URL || 'http://localhost:29229');
const errors = [], reports = [], violations = [];
try {
  for (const [width, mode] of [[760, 'light'], [320, 'dark']]) {
    for (const preference of ['reduced', 'disabled']) {
      const context = await browser.newContext({ viewport: { width: width + 64, height: 1100 }, reducedMotion: preference === 'reduced' ? 'reduce' : 'no-preference' });
      try {
        const page = await context.newPage();
        await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.goto(`${process.env.BASE_URL || 'http://localhost:5173'}/motion.html?only=markdown&instant=1&width=${width}&mode=${mode}`, { waitUntil: 'networkidle' });
        const count = await page.evaluate(async ({ preference, width, mode }) => {
          const api = await import('/scripts/replay-entry.ts');
          const host = document.createElement('div');
          host.style.width = `${width}px`; document.body.replaceChildren(host);
          const root = api.createRoot(host), failures = [], seen = new Set();
          const moving = /^(transform|translate|rotate|scale|filter|height|width|maxHeight|maxWidth|gridTemplateRows|left|top|right|bottom|strokeDashoffset|clipPath)$/;
          let animations = 0;
          const inspect = (frames, label, duration) => {
            const properties = [...new Set(frames.flatMap(frame => Object.keys(frame)))];
            const changed = properties.filter(key => moving.test(key) && new Set(frames.map(frame => frame[key]).filter(value => value !== undefined)).size > 1);
            if ((preference === 'disabled' && duration > 0) || (preference === 'reduced' && changed.length)) {
              const failure = `${label}: ${preference === 'disabled' ? `duration ${duration}` : changed.join(', ')}`;
              if (!seen.has(failure)) { seen.add(failure); failures.push(failure); }
            }
          };
          const nativeAnimate = Element.prototype.animate;
          Element.prototype.animate = function (keyframes, options) {
            if (host.contains(this) || this.closest('.prism-inline-feedback__popover-layer')) {
              const frames = Array.isArray(keyframes) ? keyframes : Object.entries(keyframes).flatMap(([key, values]) => (Array.isArray(values) ? values : [values]).map(value => ({ [key]: value })));
              inspect(frames, `${window.motionProbe?.label}: WAAPI ${this.className}`, Number(typeof options === 'number' ? options : options?.duration) || 0);
            }
            return nativeAnimate.call(this, keyframes, options);
          };
          window.motionProbe = {
            label: '', failures,
            render(index, phase) {
              const demo = api.demos[index], source = api.demoSource(demo, `preferences-${demo.id}`);
              this.label = `${demo.id}/${phase}`;
              api.flushSync(() => root.render(api.React.createElement(api.Prism, { key: demo.id, source: phase === 'partial' ? source.slice(0, Math.floor(source.length / 2)) : source, done: phase === 'done', animate: preference !== 'disabled', mode, plugins: api.playgroundPlugins, renderers: api.motionRenderers, feedback: demo.id === 'feedback', locale: 'en-US' })));
              host.scrollIntoView();
            },
            async sample(label = this.label) {
              const end = performance.now() + 300;
              do {
                for (const animation of document.getAnimations()) {
                  const target = animation.effect?.target;
                  if (!(target instanceof Element) || (!host.contains(target) && !target.closest('.prism-inline-feedback__popover-layer'))) continue;
                  animations++;
                  inspect(animation.effect.getKeyframes(), `${label}: ${target.className}`, Number(animation.effect.getTiming().duration) || 0);
                }
                for (const ghost of document.querySelectorAll('[data-closing]')) {
                  if (ghost.getAttribute('aria-hidden') !== 'true' || !ghost.inert) failures.push(`${label}: exit is not aria-hidden + inert`);
                }
                await new Promise(requestAnimationFrame);
              } while (performance.now() < end);
            },
            result() { return { failures, animations }; },
            close() { root.unmount(); Element.prototype.animate = nativeAnimate; },
          };
          return api.demos.length;
        }, { preference, width, mode });
        for (let index = 0; index < count; index++) {
          for (const phase of ['partial', 'streaming', 'done']) {
            await page.evaluate(async ({ index, phase }) => { window.motionProbe.render(index, phase); await window.motionProbe.sample(); }, { index, phase });
          }
        }
        await page.getByRole('button', { name: 'Give feedback', exact: true }).click({ force: true });
        const canvas = page.getByRole('application');
        await canvas.focus(); await canvas.press('Enter');
        await page.getByPlaceholder('Add a comment…').fill('Preference check pin');
        await page.evaluate(() => window.motionProbe.sample('feedback/pin-enter'));
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.evaluate(() => window.motionProbe.sample('feedback/pin-exit'));
        await page.getByRole('button', { name: 'Region', exact: true }).click();
        const bounds = await canvas.boundingBox();
        if (!bounds) throw Error('Missing feedback canvas');
        await page.mouse.move(bounds.x + bounds.width * .2, bounds.y + bounds.height * .3);
        await page.mouse.down();
        await page.mouse.move(bounds.x + bounds.width * .7, bounds.y + bounds.height * .6, { steps: 8 });
        await page.evaluate(() => window.motionProbe.sample('feedback/region-drag'));
        await page.mouse.up();
        await page.getByPlaceholder('Add a comment…').fill('Preference check region');
        await page.evaluate(() => window.motionProbe.sample('feedback/region-enter'));
        await page.getByRole('button', { name: /^Send \d+ comments?$/ }).click();
        await page.evaluate(() => window.motionProbe.sample('feedback/sent'));
        await page.waitForFunction(() => !document.querySelector('[data-closing]'));
        const result = await page.evaluate(() => { const result = window.motionProbe.result(); window.motionProbe.close(); return result; });
        violations.push(...result.failures.map(failure => `${width}-${mode}/${preference}: ${failure}`));
        reports.push({ width, mode, preference, demos: count, phases: ['partial', 'streaming', 'done'], feedback: ['pin-enter', 'pin-exit', 'region-drag', 'region-enter', 'sent'], animationSamples: result.animations });
      } finally { await context.close(); }
    }
  }
  console.log(JSON.stringify({ reports, violations, errors }, null, 2));
  console.log(`Motion preferences: ${reports.length} configurations × 27 demos, ${violations.length} violations, ${errors.length} console/page errors`);
  if (violations.length || errors.length) process.exitCode = 1;
} finally { await browser.close(); }
