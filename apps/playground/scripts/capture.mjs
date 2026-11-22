import { mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

// Install playwright-core locally, or set PLAYWRIGHT_MODULE to its absolute entry path.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright-core');
const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing value for ${name}`);
  return args[index + 1];
}
const out = resolve(option('--out', 'shots'));
const base = option('--url', 'http://localhost:5173/motion.html');
const frames = option('--frames');
let browser;
try {
  try { browser = await chromium.connectOverCDP(process.env.CDP_URL || 'http://localhost:29229'); }
  catch { browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) }); }
  for (const width of [760, 320]) for (const mode of ['light', 'dark']) {
    const dir = join(out, `${width}-${mode}`);
    await mkdir(dir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: width + 64, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = new URL(base);
    url.searchParams.set('width', String(width)); url.searchParams.set('mode', mode);
    if (frames) url.searchParams.set('only', frames); else url.searchParams.set('instant', '1');
    await page.goto(url.href, { waitUntil: 'networkidle' });
    await page.locator('section[data-demo]').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    if (frames) {
      // Restart after module loading so the sequence includes the first streamed characters.
      await page.getByRole('button', { name: 'Replay', exact: true }).click();
      const start = performance.now();
      for (let i = 0; i < 38; i++) {
        await new Promise(resolve => setTimeout(resolve, Math.max(0, start + i * 80 - performance.now())));
        await page.screenshot({ path: join(dir, `frame-${String(i).padStart(3, '0')}.png`), fullPage: true });
      }
      await page.locator('.prism-root[data-state="ready"]').waitFor();
    } else {
      await page.locator('.prism-root[data-state="streaming"]').waitFor({ state: 'detached' });
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: join(dir, 'full.png'), fullPage: true });
    for (const section of await page.locator('section[data-demo]').all()) {
      const id = await section.getAttribute('data-demo');
      await section.screenshot({ path: join(dir, `${id}.png`) });
      const reply = section.locator('.prism-root');
      console.log(`${width}-${mode}/${id}: ${await reply.count() ? (await reply.innerText()).length + ' text chars' : 'NO REPLY'}`);
    }
    const alerts = await page.getByRole('alert').allTextContents();
    if (errors.length || alerts.length) {
      const issues = [];
      for (const section of await page.locator('section[data-demo]').all()) {
        const alerts = await section.getByRole('alert').allTextContents();
        if (alerts.length) issues.push({ demo: await section.getAttribute('data-demo'), alerts });
      }
      console.error(JSON.stringify({ width, mode, errors, issues }));
    }
    await context.close();
  }
} finally {
  if (browser) await browser.close();
}
