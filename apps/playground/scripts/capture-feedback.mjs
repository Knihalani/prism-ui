import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const outIndex = process.argv.indexOf('--out');
const out = outIndex < 0 ? '/home/ubuntu/shots/after-feedback' : process.argv[outIndex + 1];
const browser = await chromium.connectOverCDP(process.env.CDP_URL || 'http://localhost:29229');
const errors = [];
try {
  for (const [width, mode] of [[760, 'light'], [320, 'dark']]) {
    const context = await browser.newContext({ viewport: { width: width + 64, height: 1100 }, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(`http://localhost:5173/motion.html?only=feedback&instant=1&width=${width}&mode=${mode}`, { waitUntil: 'networkidle' });
      await page.locator('[data-demo="feedback"]').hover();
      await page.getByRole('button', { name: 'Give feedback', exact: true }).click();
      const canvas = page.getByRole('application');
      const bounds = await canvas.boundingBox();
      if (!bounds?.width || !bounds.height) throw Error('Missing feedback canvas');
      await canvas.click({ position: { x: bounds.width * .18, y: bounds.height * .2 } });
      await page.getByPlaceholder('Add a comment…').fill('Keep this overview easy to scan.');
      const dir = path.join(out, `${width}-${mode}`); await mkdir(dir, { recursive: true });
      const settled = () => page.waitForFunction(() => {
        const popover = document.querySelector('[role="dialog"]');
        return popover && getComputedStyle(popover).opacity === '1' && getComputedStyle(popover).scale === '1';
      });
      await settled(); await page.screenshot({ path: path.join(dir, 'pin-open.png'), fullPage: true });
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('[data-closing]'));
      await page.mouse.move(bounds.x + bounds.width * .4, bounds.y + bounds.height * .55);
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width * .88, bounds.y + bounds.height * .82, { steps: 8 });
      await page.mouse.up();
      await page.getByPlaceholder('Add a comment…').fill('Give this region a clearer hierarchy.');
      await settled();
      if (await page.locator('[data-kind="pin"]').count() !== 1 || await page.locator('[data-kind="region"]').count() !== 1) throw Error('Missing pin or region');
      await page.screenshot({ path: path.join(dir, 'pin-region-open.png'), fullPage: true });
      await page.getByRole('button', { name: 'Submit feedback', exact: true }).click();
      await page.waitForFunction(() => {
        const pill = document.querySelector('[data-feedback-submit][data-sent]');
        return pill && getComputedStyle(pill.lastElementChild).opacity === '1' && !document.querySelector('[data-closing]');
      });
      await page.screenshot({ path: path.join(dir, 'sent.png'), fullPage: true });
      console.log(`${width}-${mode}: pin + region popovers and sent receipt captured`);
    } finally { await context.close(); }
  }
  console.log(`Feedback capture: ${errors.length} console/page errors`);
  if (errors.length) throw Error(errors.join('\n'));
} finally { await browser.close(); }
