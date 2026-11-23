import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const base = process.env.BASE_URL || 'http://localhost:5173';
const output = process.env.TRACE_OUTPUT || '/home/ubuntu/shots/reply-trace.json';
const directory = dirname(output);
await mkdir(directory, { recursive: true });
const browser = await chromium.connectOverCDP(process.env.CDP_URL || 'http://localhost:29229');
const traces = [], reports = [];
try {
  for (const width of [760, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'no-preference', colorScheme: 'light' });
    try {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(`${base}/?shell=chat&theme=host&mode=light`, { waitUntil: 'networkidle' });
      await page.evaluate(async () => {
        const { React, createRoot, flushSync } = await import('/scripts/replay-entry.ts');
        const { App } = await import('/src/App.tsx');
        document.getElementById('root').hidden = true;
        const host = document.createElement('div'); host.dataset.replyTrace = ''; document.body.append(host);
        const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
        const paragraph = 'A quiet team offsite leaves room for real conversation. Keep the plan local, give everyone a useful role, and leave enough time between activities for ideas to connect. Confirm access needs early and leave a little room in the budget for practical adjustments. ';
        const intro = Array.from({ length: 12 }, () => paragraph.repeat(2)).join('\n\n') + '\n\n';
        const summary = '```ui:summary\n' + JSON.stringify({ id: 'trace-brief', title: 'A day together · decision brief', points: ['Venue and catering', 'Facilitation', 'Materials', 'Accessible transport'].map(text => ({ text: text + ': confirm the details with the team before booking.' })), actions: [{ text: 'Share the plan', owner: 'Maya' }] }) + '\n```\n\n';
        const artifact = '```artifact:html {title="Live offsite report" id=trace-preview}\n<main id="reply-card" style="height:180px;padding:24px;box-sizing:border-box;background:var(--prism-surface);color:var(--prism-text)"><h1 style="margin:0 0 12px;font-size:22px">Space to think together</h1><p>A local venue, a shared meal, and time for useful conversation.</p><p>Live preview · all practical details in one place.</p></main>\n```\n\n';
        const tail = paragraph.repeat(3);
        const probe = window.replyTrace = { frames: [], longtasks: [], loaf: [], observers: [], rootAnimations: [], resizeSamples: [], fresh: false, skeleton: false, ghost: false, phase: 'idle', active: false };
        const nativeAnimate = Element.prototype.animate;
        Element.prototype.animate = function (frames, options) {
          if (this.matches('.reply-content > .prism-root')) probe.rootAnimations.push({ phase: probe.phase, frames, options });
          return nativeAnimate.call(this, frames, options);
        };
        const mutation = new MutationObserver(() => {
          probe.skeleton ||= !!host.querySelector('[data-prism-skeleton]');
          probe.ghost ||= !!host.querySelector('[data-prism-skeleton-exit][aria-hidden="true"][inert]');
        });
        mutation.observe(host, { childList: true, subtree: true });
        probe.start = () => {
          probe.active = true; probe.phase = 'stream';
          for (const [type, key] of [['longtask', 'longtasks'], ['long-animation-frame', 'loaf']]) {
            if (!PerformanceObserver.supportedEntryTypes.includes(type)) throw Error(`Unsupported observer: ${type}`);
            const observer = new PerformanceObserver(list => probe[key].push(...list.getEntries().map(entry => entry.toJSON())));
            observer.observe({ type }); probe.observers.push(observer);
          }
          let previous;
          const sample = now => {
            if (!probe.active) return;
            if (previous !== undefined) probe.frames.push(now - previous);
            previous = now;
            probe.fresh ||= !!host.querySelector('[data-prism-fresh]');
            if (probe.phase === 'resize') {
              const root = host.querySelector('.reply-content > .prism-root'), flow = root.querySelector('[data-prism-flow]');
              const viewport = host.querySelector('.prism-artifact__viewport'), iframe = viewport.querySelector('iframe');
              probe.resizeSamples.push({ height: viewport.getBoundingClientRect().height, rootGap: root.getBoundingClientRect().height - flow.getBoundingClientRect().height - probe.inset, iframeTop: iframe.getBoundingClientRect().top - viewport.getBoundingClientRect().top, transitions: viewport.getAnimations().map(animation => ({ property: animation.transitionProperty, duration: animation.effect.getTiming().duration })) });
            }
            probe.frame = requestAnimationFrame(sample);
          };
          probe.frame = requestAnimationFrame(sample);
        };
        probe.stop = () => {
          probe.active = false; cancelAnimationFrame(probe.frame); mutation.disconnect();
          for (const observer of probe.observers) { const key = observer.takeRecords(); for (const entry of key) probe[entry.entryType === 'longtask' ? 'longtasks' : 'loaf'].push(entry.toJSON()); observer.disconnect(); }
          Element.prototype.animate = nativeAnimate;
        };
        const root = createRoot(host);
        flushSync(() => root.render(React.createElement(App, { agentFactory: () => ({ id: 'trace-reply', label: 'Reply trace', async *respond() {
          yield { type: 'title', title: 'A quiet day together' };
          for (let end = 0; end < intro.length; end += 48) { yield { type: 'text', delta: intro.slice(end, end + 48) }; await pause(16); }
          yield { type: 'text', delta: summary.slice(0, 110) }; await pause(180);
          yield { type: 'text', delta: summary.slice(110) }; await pause(240);
          for (let end = 0; end < artifact.length; end += 96) { yield { type: 'text', delta: artifact.slice(end, end + 96) }; await pause(32); }
          for (let end = 0; end < tail.length; end += 48) { yield { type: 'text', delta: tail.slice(end, end + 48) }; await pause(16); }
        } }) })));
        await document.fonts.ready;
      });
      const app = page.locator('.chat-app:visible');
      await app.getByRole('textbox', { name: 'Message Prism' }).fill('Plan a quiet local team offsite');
      const cdp = await context.newCDPSession(page);
      if (process.env.PROFILE_REPLY) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
      await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,v8', transferMode: 'ReturnAsStream' });
      await page.evaluate(() => window.replyTrace.start());
      await app.getByRole('button', { name: 'Send message', exact: true }).click();
      await app.getByRole('heading', { name: 'A day together · decision brief' }).waitFor();
      const artifact = app.locator('[data-artifact-shell]').first();
      const iframe = artifact.locator('iframe');
      await iframe.waitFor();
      const frame = await (await iframe.elementHandle()).contentFrame();
      await frame.locator('#reply-card').waitFor();
      await app.getByRole('button', { name: 'Send message', exact: true }).waitFor({ timeout: 30000 });
      await artifact.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        const probe = window.replyTrace, root = document.querySelector('[data-reply-trace] .reply-content > .prism-root'), style = getComputedStyle(root);
        probe.inset = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((sum, key) => sum + (parseFloat(style[key]) || 0), 0);
        probe.phase = 'resize';
      });
      await frame.evaluate(() => { document.getElementById('reply-card').style.height = '640px'; });
      await page.waitForTimeout(80);
      await frame.evaluate(() => { document.getElementById('reply-card').style.height = '480px'; });
      await page.waitForTimeout(600);
      const metrics = await page.evaluate(() => {
        const probe = window.replyTrace; probe.stop();
        const sorted = [...probe.frames].sort((a, b) => a - b), percentile = p => sorted[Math.floor((sorted.length - 1) * p)] ?? 0;
        return { frameCount: sorted.length, p50: percentile(.5), p95: percentile(.95), max: sorted.at(-1) ?? 0, over33: sorted.filter(time => time > 33).length, longTasks: probe.longtasks.filter(entry => entry.duration > 50), loaf: probe.loaf.filter(entry => entry.duration > 50), fresh: probe.fresh, skeleton: probe.skeleton, ghost: probe.ghost, resizeRootAnimations: probe.rootAnimations.filter(animation => animation.phase === 'resize').length, maxRootGap: Math.max(0, ...probe.resizeSamples.map(sample => Math.abs(sample.rootGap))), maxIframeTop: Math.max(0, ...probe.resizeSamples.map(sample => Math.abs(sample.iframeTop))), heightTransitions: probe.resizeSamples.some(sample => sample.transitions.some(transition => transition.property === 'height' && transition.duration > 0)) };
      });
      const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
      await cdp.send('Tracing.end');
      if (process.env.PROFILE_REPLY) { const { profile } = await cdp.send('Profiler.stop'); await writeFile(join(directory, `reply-trace-${width}.cpuprofile`), JSON.stringify(profile)); }
      const { stream } = await complete;
      let json = '';
      for (;;) { const chunk = await cdp.send('IO.read', { handle: stream }); json += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString() : chunk.data; if (chunk.eof) break; }
      await cdp.send('IO.close', { handle: stream });
      const trace = JSON.parse(json);
      traces.push(trace);
      await writeFile(join(directory, `reply-trace-${width}.json`), json);
      await writeFile(join(directory, `reply-trace-${width}-metrics.json`), JSON.stringify({ ...metrics, errors }, null, 2));
      await frame.evaluate(() => { document.getElementById('reply-card').style.height = '240px'; });
      await page.waitForTimeout(350);
      await frame.evaluate(() => { document.getElementById('reply-card').style.height = '480px'; });
      await page.waitForTimeout(80);
      await page.screenshot({ path: join(directory, `reply-artifact-resize-${width}.png`) });
      await page.waitForTimeout(350);
      const feedback = app.locator('.prism-inline-feedback').filter({ has: page.locator('[data-artifact-shell]') }).first();
      await feedback.getByRole('button', { name: 'Give feedback', exact: true }).click({ force: true });
      await feedback.getByRole('application').focus();
      await feedback.getByRole('application').press('Enter');
      await page.getByPlaceholder('Add a comment…').fill('Keep the report calm and easy to scan.');
      await page.waitForTimeout(550);
      await page.screenshot({ path: join(directory, `reply-feedback-popover-${width}.png`) });
      const report = { width, ...metrics, errors };
      reports.push(report);
      console.log(`${width}px light: ${metrics.frameCount} frames; p50 ${metrics.p50.toFixed(2)}ms, p95 ${metrics.p95.toFixed(2)}ms, max ${metrics.max.toFixed(2)}ms; >33ms ${metrics.over33}; long tasks >50ms ${metrics.longTasks.length}; LoAF >50ms ${metrics.loaf.length}; artifact height transitions ${metrics.heightTransitions}, resize root animations ${metrics.resizeRootAnimations}, max root gap ${metrics.maxRootGap.toFixed(2)}px, iframe top ${metrics.maxIframeTop.toFixed(2)}px; errors ${errors.length}`);
      if (!metrics.fresh || !metrics.skeleton || !metrics.ghost || !metrics.heightTransitions || metrics.resizeRootAnimations || metrics.maxRootGap > 1 || metrics.maxIframeTop > 1 || errors.length) process.exitCode = 1;
    } finally { await context.close(); }
  }
} finally {
  await writeFile(output, JSON.stringify({ traceEvents: traces.flatMap(trace => trace.traceEvents), metadata: { reports } }));
  await browser.close();
}
