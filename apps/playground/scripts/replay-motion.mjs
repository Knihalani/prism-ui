import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP(process.env.CDP_URL || 'http://localhost:29229');
const context = await browser.newContext({ viewport: { width: 824, height: 1000 } });
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await fetch('http://localhost:5173/scripts/replay-entry.ts');
  await page.goto('http://localhost:5173/motion.html?only=markdown&instant=1', { waitUntil: 'networkidle' });
  const result = await page.evaluate(async () => {
    const { React, createRoot, flushSync, Prism, demos, demoSource, playgroundPlugins } = await import('/scripts/replay-entry.ts');
    const host = document.createElement('div'); document.body.append(host);
    const failures = [], root = createRoot(host, { onUncaughtError: error => failures.push(error.message) });
    const reports = [];
    for (const demo of demos) {
      const source = demoSource(demo, `prefix-${demo.id}`);
      for (let prefix = 0; prefix <= source.length; prefix++) {
        flushSync(() => root.render(React.createElement(Prism, { key: demo.id, source: source.slice(0, prefix), done: false, plugins: playgroundPlugins, locale: 'en-US' })));
        if (prefix % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
      reports.push({ demo: demo.id, prefixes: source.length + 1, fullText: host.innerText.length, alerts: [...host.querySelectorAll('[role="alert"]')].map(element => element.textContent) });
    }
    root.unmount(); host.remove();
    return { reports, failures };
  });
  console.log(JSON.stringify({ ...result, errors }, null, 2));
  if (result.failures.length || errors.length || result.reports.some(report => !report.fullText)) process.exitCode = 1;
} finally {
  await context.close(); await browser.close();
}
