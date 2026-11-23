import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function checkAnnouncements(browser, { base, output }) {
  const context = await browser.newContext({ viewport: { width: 760, height: 1100 } });
  try {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
    await page.route('**/src/main.tsx', async route => {
      const response = await route.fetch(), entry = await response.text();
      const styles = [...entry.matchAll(/(?:from\s*|import\s*)["']([^"']+\.css(?:\?[^"']*)?)["']/g)];
      if (!styles.length) throw Error('Playground entry contains no stylesheet imports');
      await route.fulfill({ contentType: 'application/javascript', body: styles.map(([, path]) => `import ${JSON.stringify(path)};`).join('\n') });
    });
    await page.goto(`${base}/?shell=chat&theme=host&mode=light`, { waitUntil: 'networkidle' });
    const expected = ['Settled reply', 'A quiet answer arrives as complete words.', 'Final metrics. Completed 42', 'Everything is ready.'];
    await page.evaluate(async () => {
      const { React, createRoot, flushSync } = await import('/scripts/replay-entry.ts');
      const { App } = await import('/src/App.tsx');
      const source = '# Settled reply\n\nA quiet answer arrives as complete words.\n\n```ui:view\n' + JSON.stringify({ id: 'announcement-metrics', title: 'Final metrics', children: [{ type: 'stat', label: 'Completed', value: 42 }] }) + '\n```\n\nEverything is ready.';
      const probe = window.announcementProbe = { samples: [], busy: false };
      const observer = new MutationObserver(records => {
        const regions = new Set();
        for (const record of records) {
          const node = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
          const region = node?.closest('[data-prism-announcer]');
          if (region) regions.add(region);
          for (const added of record.addedNodes) if (added.nodeType === Node.ELEMENT_NODE) {
            if (added.matches('[data-prism-announcer]')) regions.add(added);
            added.querySelectorAll('[data-prism-announcer]').forEach(item => regions.add(item));
          }
        }
        for (const region of regions) if (region.textContent) probe.samples.push(region.textContent);
        probe.busy ||= document.querySelector('.thread')?.getAttribute('aria-busy') === 'true';
      });
      observer.observe(document.getElementById('root'), { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-busy'] });
      window.announcementRoot = createRoot(document.getElementById('root'));
      flushSync(() => window.announcementRoot.render(React.createElement(App, { agentFactory: () => ({ id: 'announcement-probe', label: 'Announcement probe', async *respond() {
        for (let offset = 0; offset < source.length; offset += 3) {
          yield { type: 'text', delta: source.slice(offset, offset + 3) };
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      } }) })));
    });
    const app = page.locator('.chat-app:visible');
    await app.getByRole('textbox', { name: 'Message Prism' }).fill('Stream an accessible reply');
    await app.getByRole('button', { name: 'Send message', exact: true }).click();
    await app.locator('[data-message="assistant"][data-state="ready"]').waitFor();
    await page.waitForTimeout(800);
    const result = await page.evaluate(() => {
      const reply = document.querySelector('[data-message="assistant"]'), thread = document.querySelector('.thread');
      return { ...window.announcementProbe, blocks: reply.querySelector('[data-prism-flow]').children.length, announcers: reply.querySelectorAll('[data-prism-announcer]').length, threadLive: thread.getAttribute('aria-live'), threadRole: thread.getAttribute('role'), busyAfter: thread.getAttribute('aria-busy') };
    });
    const spoken = result.samples.flatMap(sample => sample.split('\n'));
    if (result.announcers !== 1 || result.threadLive !== null || result.threadRole === 'log' || !result.busy || result.busyAfter !== 'false') throw Error('Streaming shell/live-region contract failed: ' + JSON.stringify(result));
    if (!result.samples.length || result.samples.length > result.blocks + 1) throw Error('Announcement count exceeds block bound: ' + JSON.stringify(result));
    if (JSON.stringify(spoken) !== JSON.stringify(expected)) throw Error('Partial, duplicate or missing block announcement: ' + JSON.stringify(spoken));
    if (errors.length) throw Error('Announcement probe page errors: ' + errors.join('; '));
    await mkdir(output, { recursive: true });
    await writeFile(join(output, 'announcements.json'), JSON.stringify(result, null, 2));
    console.log('Sampled announcement sequence: ' + JSON.stringify(result.samples));
    console.log(`Settled announcements: ${result.samples.length} updates / ${result.blocks} blocks, 0 partial fragments, 0 duplicates, 0 page errors`);
    return result;
  } finally { await context.close(); }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const browser = await chromium.connectOverCDP(process.env.CDP_URL || 'http://localhost:29229');
  try { await checkAnnouncements(browser, { base: process.env.BASE_URL || 'http://localhost:5173', output: process.env.A11Y_OUTPUT || '/home/ubuntu/shots/a11y-audit' }); }
  finally { await browser.close(); }
}
