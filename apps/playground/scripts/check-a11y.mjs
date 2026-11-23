import { chromium } from 'playwright-core';
import axe from 'axe-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const base = process.env.BASE_URL || 'http://localhost:5173';
const output = process.env.A11Y_OUTPUT || '/home/ubuntu/shots/a11y-audit';
const themes = (process.env.A11Y_THEMES || 'host,refraction').split(',');
const profiles = (process.env.A11Y_PROFILES || 'normal,reduced,forced-colors').split(',');
const only = process.env.A11Y_ONLY && new RegExp(process.env.A11Y_ONLY);
const keyboard = [], scans = [], interactions = [], errors = [];
await mkdir(output, { recursive: true });
const browser = await chromium.connectOverCDP(process.env.CDP_URL || 'http://localhost:29229');

async function auditFrames(page) {
  const frames = [];
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) { frames.push(frame); continue; }
    const element = await frame.frameElement();
    if (await element.evaluate(node => !node.closest('[inert],[hidden]') && (!document.fullscreenElement || document.fullscreenElement.contains(node)) && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden')) frames.push(frame);
    await element.dispose();
  }
  return frames;
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  for (const target of await page.locator('[data-artifact-shell], .prism-mockup__viewport').all()) if (await target.isVisible()) await target.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('[data-artifact-shell] [aria-busy="true"]'), undefined, { timeout: 15000 });
  await page.waitForFunction(() => document.getAnimations().every(a => a.effect?.getTiming().iterations === Infinity || a.playState === 'finished'), undefined, { timeout: 10000 });
  for (const frame of page.frames()) await frame.evaluate(() => document.fonts.ready).catch(() => {});
}

async function scan(page, label) {
  const results = [];
  for (const [index, frame] of (await auditFrames(page)).entries()) {
    try {
      const background = index ? await (await frame.frameElement()).evaluate(node => {
        for (let el = node; el; el = el.parentElement) {
          const color = getComputedStyle(el).backgroundColor;
          if (color !== 'transparent' && !color.endsWith(', 0)') && !color.includes('/ 0)')) return color;
        }
        return getComputedStyle(document.documentElement).colorScheme === 'dark' ? '#151515' : '#fff';
      }) : null;
      await frame.evaluate(axe.source);
      const result = await frame.evaluate(async ({ background, forced }) => {
        const root = document.documentElement, original = root.style.backgroundColor;
        const transparent = color => color === 'transparent' || color === 'rgba(0, 0, 0, 0)';
        if (background && transparent(getComputedStyle(root).backgroundColor)) root.style.backgroundColor = background;
        const rules = {};
        if (forced) rules['color-contrast'] = { enabled: false };
        // Embedded authored fragments are not standalone pages. Keep all WCAG and metadata checks.
        if (background) for (const id of ['region', 'landmark-one-main', 'page-has-heading-one']) rules[id] = { enabled: false };
        let result;
        try { result = await axe.run(document, { iframes: false, rules }); }
        finally { root.style.backgroundColor = original; }
        const reduce = rules => rules.map(({ id, impact, description, helpUrl, nodes }) => ({ id, impact, description, helpUrl, nodes: nodes.map(({ target, html, failureSummary }) => ({ target, html, failureSummary })) }));
        return { violations: reduce(result.violations), incomplete: reduce(result.incomplete), passes: result.passes.length };
      }, { background, forced: label.profile === 'forced-colors' });
      results.push({ frame: index, url: frame.url(), ...result });
    } catch (error) { errors.push({ ...label, frame: index, stage: 'axe', error: error.message }); }
  }
  scans.push({ ...label, results });
}

async function tabInventory(page, label, preserveFocus = false) {
  const expected = [];
  const frames = await auditFrames(page);
  for (const [frameIndex, frame] of frames.entries()) {
    try {
      expected.push(...await frame.evaluate(frameIndex => {
        const selector = node => {
          const parts = [];
          for (let el = node; el && el !== document.body && parts.length < 5; el = el.parentElement) {
            if (el.id) { parts.unshift('#' + CSS.escape(el.id)); break; }
            parts.unshift(el.localName + [...el.classList].slice(0, 2).map(c => '.' + CSS.escape(c)).join('') + ':nth-child(' + ([...el.parentElement.children].indexOf(el) + 1) + ')');
          }
          return parts.join(' > ');
        };
        const transparent = color => color === 'transparent' || /rgba\([^)]*,\s*0\)/.test(color);
        const inspect = node => {
          const style = getComputedStyle(node), rect = node.getBoundingClientRect();
          let visible = rect.width > 0 && rect.height > 0;
          for (let el = node; el; el = el.parentElement) {
            const s = getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < .05 || el.hidden || el.inert) visible = false;
          }
          const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 && !transparent(style.outlineColor);
          const border = ['Top', 'Right', 'Bottom', 'Left'].some(side => parseFloat(style['border' + side + 'Width']) > 0 && style['border' + side + 'Style'] !== 'none' && !transparent(style['border' + side + 'Color']) && style['border' + side + 'Color'] !== style.backgroundColor);
          const ancestors = []; for (let el = node.parentElement; el && el !== document.body; el = el.parentElement) ancestors.push(getComputedStyle(el));
          const ancestorOutline = ancestors.some(s => s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && !transparent(s.outlineColor));
          const parentBorder = ancestors[0] && ['Top', 'Right', 'Bottom', 'Left'].some(side => parseFloat(ancestors[0]['border' + side + 'Width']) > 0 && ancestors[0]['border' + side + 'Style'] !== 'none' && !transparent(ancestors[0]['border' + side + 'Color']));
          return { visible, outline, border, ancestorOutline, parentBorder, ancestorShadows: ancestors.map(s => s.boxShadow).join('|'), outlineValue: style.outline, shadow: style.boxShadow, focusVisible: node.matches(':focus-visible'), color: style.color, background: style.backgroundColor, forcedColorAdjust: style.forcedColorAdjust };
        };
        const candidates = [...document.querySelectorAll('a[href],button,input,textarea,select,iframe,[tabindex],[role="button"],[role="slider"],[role="spinbutton"]')].filter(node => {
          const s = getComputedStyle(node);
          return node !== document.body && node.tabIndex >= 0 && (!document.fullscreenElement || document.fullscreenElement.contains(node)) && !node.disabled && !node.closest('[inert],[hidden],[aria-hidden="true"]') && s.display !== 'none' && s.visibility !== 'hidden' && node.getClientRects().length;
        });
        const controls = candidates.map((node, i) => {
          node.dataset.a11yKey = `${frameIndex}-${i}`;
          return { key: node.dataset.a11yKey, frame: frameIndex, selector: selector(node), name: node.getAttribute('aria-label') || node.getAttribute('title') || node.textContent.trim().slice(0, 100), tag: node.localName, role: node.getAttribute('role'), tabIndex: node.tabIndex, reveal: !!node.closest('[data-prism-reveal]'), ...inspect(node) };
        });
        window.a11yKeyboard = { inspect, controls };
        return controls;
      }, frameIndex));
    } catch (error) { errors.push({ ...label, stage: 'keyboard-setup', error: error.message }); }
  }
  if (!preserveFocus) await page.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); });
  await page.mouse.move(759, 1);
  const visits = [], seen = new Set();
  let first, repeated = 0, previous;
  for (let step = 0; step < expected.length * 2 + 12; step++) {
    await page.keyboard.press('Tab');
    let state;
    for (const frame of frames) {
      state = await frame.evaluate(() => {
        const node = document.activeElement;
        if (!document.hasFocus() || !node || node.tagName === 'IFRAME' || !node.dataset.a11yKey || !window.a11yKeyboard) return;
        return { key: node.dataset.a11yKey, ...window.a11yKeyboard.inspect(node) };
      }).catch(() => undefined);
      if (state) break;
    }
    if (!state) continue;
    if (!state.visible) {
      await page.waitForTimeout(250);
      for (const frame of frames) {
        const settled = await frame.evaluate(() => {
          const node = document.activeElement;
          if (document.hasFocus() && node?.dataset.a11yKey && node.tagName !== 'IFRAME') return { key: node.dataset.a11yKey, ...window.a11yKeyboard.inspect(node) };
        }).catch(() => undefined);
        if (settled) { state = settled; break; }
      }
    }
    if (state.key === first && visits.length) break;
    first ??= state.key;
    repeated = state.key === previous ? repeated + 1 : 0; previous = state.key;
    visits.push(state); seen.add(state.key);
    if (repeated >= 10) break;
  }
  const findings = visits.flatMap(state => {
    const control = expected.find(item => item.key === state.key);
    const issues = [];
    if (!state.visible) issues.push('focused-but-invisible');
    if (state.focusVisible && !state.outline && !state.ancestorOutline && state.ancestorShadows === control?.ancestorShadows && (state.shadow === 'none' || state.shadow === control?.shadow)) issues.push('no-outline-or-changed-shadow');
    if (label.profile !== 'normal' && !state.border && !state.parentBorder && !state.outline && !state.ancestorOutline) issues.push(`${label.profile}-no-border-or-outline`);
    return issues.map(issue => ({ issue, ...control, focused: state }));
  });
  const unreachedSequential = expected.filter(item => item.tabIndex >= 0 && item.tag !== 'iframe' && !seen.has(item.key));
  keyboard.push({ ...label, controls: expected, visits, findings, unreachedSequential, negativeTabIndex: expected.filter(item => item.tabIndex < 0), suspectedTrap: repeated >= 10 && unreachedSequential.length > 0 });
}

async function feedbackOpen(page) {
  const trigger = page.getByRole('button', { name: 'Give feedback', exact: true }).last();
  if (!await trigger.count()) return false;
  await trigger.focus(); await page.keyboard.press('Enter');
  const canvas = page.getByRole('application').last();
  await canvas.waitFor(); await canvas.focus(); await page.keyboard.press('Enter');
  await page.getByPlaceholder('Add a comment…').last().fill('Accessibility audit comment');
  await settle(page);
  return true;
}

async function exercise(page, label) {
  const result = { ...label };
  const popover = page.getByPlaceholder('Add a comment…').last();
  if (await popover.count() && await popover.isVisible()) {
    await popover.focus(); await page.keyboard.press('Escape');
    await settle(page);
    result.popoverEscape = { closed: !await popover.isVisible(), active: await page.evaluate(() => ({ tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute('aria-label') })) };
    const canvas = page.getByRole('application').last();
    if (await canvas.count()) {
      await canvas.focus(); await page.keyboard.press('Enter');
      await page.getByPlaceholder('Add a comment…').last().fill('Saved with keyboard');
      await page.keyboard.press('Enter');
      await settle(page);
      result.pinCreated = await page.locator('[data-kind="pin"]').count();
      const submit = page.getByRole('button', { name: 'Submit feedback', exact: true }).last();
      if (await submit.count() && await submit.isEnabled()) {
        await submit.focus(); await page.keyboard.press('Enter'); await settle(page);
        result.feedbackSubmitted = await page.locator('[data-feedback-submit][data-sent]').count() > 0;
      }
    }
  }
  const full = page.getByRole('button', { name: 'Open fullscreen', exact: true }).last();
  if (await full.count()) {
    await full.focus(); await page.keyboard.press('Enter');
    await settle(page);
    result.fullscreenEntered = await page.evaluate(() => !!document.fullscreenElement);
    if (result.fullscreenEntered) {
      await tabInventory(page, { ...label, state: 'fullscreen' });
      const exit = page.getByRole('button', { name: 'Exit fullscreen', exact: true }).last();
      await exit.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.fullscreenElement);
      result.fullscreenButtonExited = true;
      await full.focus(); await page.keyboard.press('Enter'); await settle(page);
      await page.keyboard.press('Escape'); await page.waitForTimeout(150);
      result.fullscreenEscapeExited = await page.evaluate(() => !document.fullscreenElement);
      if (!result.fullscreenEscapeExited) await page.evaluate(() => document.exitFullscreen());
    }
  }
  interactions.push(result);
}

async function overflowInventory(page, label) {
  const triggers = await page.getByRole('button', { name: 'More tools', exact: true }).all();
  for (const [index, trigger] of triggers.entries()) {
    if (!await trigger.isVisible()) continue;
    await trigger.focus(); await page.keyboard.press('Enter'); await settle(page);
    const open = { ...label, state: `overflow-${index}` };
    const expanded = await trigger.getAttribute('aria-expanded');
    await scan(page, open); await tabInventory(page, open, true);
    await trigger.focus();
    if (await trigger.getAttribute('aria-expanded') !== 'true') await page.keyboard.press('Enter');
    const content = page.locator('[id=' + JSON.stringify(await trigger.getAttribute('aria-controls')) + ']');
    const first = content.locator('button:not([disabled])').first();
    if (await first.count()) await first.focus();
    await page.keyboard.press('Escape'); await settle(page);
    interactions.push({ ...open, overflowOpened: expanded === 'true', overflowEscapeClosed: await trigger.getAttribute('aria-expanded') === 'false', overflowFocusReturned: await trigger.evaluate(node => document.activeElement === node) });
    if (await trigger.getAttribute('aria-expanded') === 'true') { await trigger.focus(); await page.keyboard.press('Enter'); }
    await trigger.focus(); await page.keyboard.press('Enter');
    const fullscreen = page.getByRole('button', { name: 'Fullscreen', exact: true }).last();
    if (await fullscreen.count() && await fullscreen.isVisible()) {
      await fullscreen.focus(); await page.keyboard.press('Enter'); await settle(page);
      const entered = await page.evaluate(() => ({ native: !!document.fullscreenElement, fallback: !!document.querySelector('[data-expanded]') }));
      await tabInventory(page, { ...label, state: `mockup-fullscreen-${index}` });
      await page.keyboard.press('Escape'); await settle(page);
      const closed = await page.evaluate(() => !document.fullscreenElement && !document.querySelector('[data-expanded]'));
      interactions.push({ ...open, mockupFullscreenEntered: entered, mockupEscapeClosed: closed });
      if (await page.evaluate(() => !!document.fullscreenElement)) await page.evaluate(() => document.exitFullscreen());
    } else { await trigger.focus(); await page.keyboard.press('Escape'); }
  }
}

async function fixtures(page, config) {
  const entries = await page.evaluate(async () => {
    const api = await import('/scripts/replay-entry.ts');
    const { examples, kitchenSink } = await import('/src/fixtures.ts');
    const { kitchen } = await import('/src/catalogue.ts');
    return [...api.demos.map(d => ({ id: 'demo/' + d.id, components: d.components || [d.id], source: api.demoSource(d, 'a11y-' + d.id) })), ...examples().map(d => ({ ...d, id: 'fixture/' + d.id, components: [d.id] })), { id: 'fixture/kitchen-sink', components: ['mixed'], source: kitchenSink }, { id: 'demo/kitchen-sink', components: kitchen.components, source: api.demoSource(kitchen, 'a11y-kitchen') }];
  });
  for (const entry of entries.filter(entry => !only || only.test(entry.id))) {
    const label = { ...config, id: entry.id, components: entry.components, state: 'settled' };
    try {
      await page.evaluate(async ({ entry, config }) => {
        const api = await import('/scripts/replay-entry.ts');
        const { availableThemes } = await import('/src/themes.ts');
        window.a11yRoot?.unmount();
        const main = document.createElement('main'), heading = document.createElement('h1'), title = document.createElement('h2'), host = document.createElement('div');
        heading.textContent = 'Prism component accessibility audit'; title.textContent = entry.id; main.append(heading, title, host); document.body.replaceChildren(main);
        document.documentElement.lang = 'en'; document.documentElement.style.colorScheme = config.mode;
        document.body.style.cssText = `margin:0;padding:0;background:${config.mode === 'dark' ? '#151515' : '#fff'};color:${config.mode === 'dark' ? '#fff' : '#111'}`;
        window.a11yRoot = api.createRoot(host);
        api.flushSync(() => window.a11yRoot.render(api.React.createElement(api.Prism, { source: entry.source, done: true, theme: availableThemes.find(t => t.name === config.theme), mode: config.mode, plugins: api.playgroundPlugins, renderers: api.motionRenderers, feedback: entry.id === 'demo/feedback', onAction() {} })));
      }, { entry, config });
      await settle(page); await scan(page, label);
      await tabInventory(page, label);
      await overflowInventory(page, label);
      if (entry.id === 'demo/feedback' && await feedbackOpen(page)) {
        const open = { ...label, state: 'feedback-popover' };
        await scan(page, open); await tabInventory(page, open); await exercise(page, open);
      }
    } catch (error) { errors.push({ ...label, stage: 'fixture', error: error.message }); }
    console.log(`${config.theme}/${config.mode}/${config.profile}: ${entry.id}`);
  }
}

async function shell(page, config, name) {
  const label = { ...config, id: 'shell/' + name, components: ['shell', 'artifact', 'feedback'], state: 'finished-reply-feedback-popover' };
  try {
    await page.goto(`${base}/?shell=${name}&theme=${config.theme}&mode=${config.mode}`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      const { React, createRoot, flushSync, demos, demoSource } = await import('/scripts/replay-entry.ts');
      const { App } = await import('/src/App.tsx');
      const source = '# Accessibility audit reply\n\nA finished reply with an interactive preview.\n\n' + demoSource(demos.find(d => d.id === 'artifact-html'), 'a11y-shell');
      const host = document.getElementById('root');
      window.a11yRoot = createRoot(host);
      flushSync(() => window.a11yRoot.render(React.createElement(App, { agentFactory: () => ({ id: 'a11y-audit', label: 'Audit fixture', async *respond() { yield { type: 'text', delta: source }; } }) })));
    });
    const app = page.locator('.chat-app:visible');
    await app.getByRole('textbox', { name: 'Message Prism' }).fill('Show the accessibility audit reply');
    await app.getByRole('button', { name: 'Send message', exact: true }).click();
    await app.locator('[data-message="assistant"][data-state="ready"]').waitFor();
    await settle(page);
    await tabInventory(page, { ...label, state: 'finished-reply' });
    if (!await feedbackOpen(page)) throw Error('Missing artifact feedback trigger');
    await scan(page, label); await tabInventory(page, label);
    await page.screenshot({ path: join(output, `${name}-${config.theme}-${config.mode}-${config.profile}.png`) });
    await exercise(page, label);
  } catch (error) { errors.push({ ...label, stage: 'shell', error: error.message }); }
}

try {
  for (const theme of themes) for (const mode of ['light', 'dark']) for (const profile of profiles) {
    const config = { theme, mode, profile };
    const context = await browser.newContext({ viewport: { width: 760, height: 1100 }, colorScheme: mode, reducedMotion: profile === 'reduced' ? 'reduce' : 'no-preference', forcedColors: profile === 'forced-colors' ? 'active' : 'none' });
    try {
      const page = await context.newPage();
      await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
      await page.route('**/src/main.tsx', async route => {
        const response = await route.fetch(), entry = await response.text();
        const styles = [...entry.matchAll(/(?:from\s*|import\s*)["']([^"']+\.css(?:\?[^"']*)?)["']/g)];
        if (!styles.length) throw Error('Playground entry contains no stylesheet imports');
        await route.fulfill({ contentType: 'application/javascript', body: styles.map(([, path]) => `import ${JSON.stringify(path)};`).join('\n') });
      });
      page.on('pageerror', error => errors.push({ ...config, stage: 'page', error: error.message }));
      await page.goto(`${base}/motion.html?only=markdown&instant=1`, { waitUntil: 'networkidle' });
      await fixtures(page, config);
      for (const name of ['chat', 'editor', 'workspace']) if (!only || only.test('shell/' + name)) await shell(page, config, name);
      await writeFile(join(output, 'report-partial.json'), JSON.stringify({ scans, keyboard, interactions, errors }, null, 2));
      console.log(`${theme}/${mode}/${profile}: ${scans.filter(s => s.theme === theme && s.mode === mode && s.profile === profile).length} scans complete`);
    } finally { await context.close(); }
  }
} finally {
  const groups = new Map();
  for (const scan of scans) for (const result of scan.results) for (const violation of result.violations) {
    const key = violation.id;
    if (!groups.has(key)) groups.set(key, { rule: key, impact: violation.impact, count: 0, affected: new Set(), selectors: new Set() });
    const group = groups.get(key); group.count += violation.nodes.length; group.affected.add(scan.id);
    for (const node of violation.nodes) group.selectors.add(node.target.join(' > '));
  }
  const grouped = [...groups.values()].map(group => ({ ...group, affected: [...group.affected].sort(), selectors: [...group.selectors].sort() })).sort((a, b) => b.count - a.count);
  // Menus close on blur; reconcile their initial inventory with the separately opened-menu walk.
  for (const entry of keyboard) entry.unreachedSequential = entry.unreachedSequential.filter(control => !keyboard.some(other =>
    ['theme', 'mode', 'profile', 'id'].every(key => entry[key] === other[key]) && other.controls.some(candidate =>
      candidate.selector === control.selector && other.visits.some(visit => visit.key === candidate.key))));
  const summary = { axe: axe.version, scans: scans.length, rules: grouped.length, violations: grouped.reduce((sum, g) => sum + g.count, 0), keyboardFindings: keyboard.reduce((sum, k) => sum + k.findings.length, 0), unreachedSequential: keyboard.reduce((sum, k) => sum + k.unreachedSequential.length, 0), suspectedTraps: keyboard.filter(k => k.suspectedTrap).length, errors: errors.length };
  await writeFile(join(output, 'report.json'), JSON.stringify({ summary, grouped, scans, keyboard, interactions, errors }, null, 2));
  console.log(JSON.stringify({ summary, grouped, errors }, null, 2));
  console.log(`Accessibility audit: ${summary.scans} scans, ${summary.rules} rules / ${summary.violations} affected node occurrences, ${summary.keyboardFindings} keyboard flags, ${summary.errors} audit errors`);
  await browser.close();
  if (summary.violations || summary.keyboardFindings || summary.unreachedSequential || summary.suspectedTraps || errors.length) process.exitCode = 1;
}
